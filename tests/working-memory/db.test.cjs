// DB-level acceptance tests for the isolated wm_* core data layer.
// Uses the repository's SQL.js/WASM build and synthetic records only.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');
const initSqlJs = require(path.resolve(__dirname, '../../sql-wasm.js'));
const WASM = fs.readFileSync(path.resolve(__dirname, '../../sql-wasm.wasm'));
const ROOT = path.resolve(__dirname, '../..');
const WM = require(path.join(ROOT, 'working-memory.js'));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const results = [];
let SQL;

async function T(id, name, fn) {
  try { await fn(); results.push([id, 'PASS', name]); console.log(`PASS  [${id}] ${name}`); }
  catch (error) { results.push([id, 'FAIL', name, error.message]); console.log(`FAIL  [${id}] ${name}\n      ${error.stack.split('\n').slice(0, 4).join('\n      ')}`); }
}
function makeDb() { return new SQL.Database(); }
function count(db, sql, params) { const r = db.exec(sql, params || []); return r.length ? r[0].values[0][0] : 0; }
function dump(db, table) { return JSON.stringify(db.exec(`SELECT * FROM ${table} ORDER BY 1`)); }
function byteCopy(value) { return value ? new Uint8Array(value).slice() : null; }
function bytesEqual(a, b) { return !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]); }
function makeStore(db, persistence) {
  let sequence = 0;
  const saves = [];
  const persist = persistence || (async currentDb => {
    const bytes = byteCopy(currentDb.export());
    saves.push(bytes);
    return { verified: bytesEqual(bytes, byteCopy(bytes)), bytes: bytes.length, method: 'test-readback' };
  });
  const store = WM.create(db, { persist: () => persist(db), idFactory: prefix => prefix + String(++sequence).padStart(6, '0') });
  return { store, saves };
}
function ok(response, label) { assert(response && response.ok && response.saved, `${label || 'mutation'} not durably saved: ${JSON.stringify(response)}`); return response.data; }
function makeItem(workId, title, extra) { return Object.assign({ work_id: workId, title }, extra || {}); }

(async () => {
  SQL = await initSqlJs({ wasmBinary: WASM });

  await T('schema', 'schema init is additive, idempotent, and contains the requested wm_* tables and item columns', async () => {
    const db = makeDb();
    db.run('CREATE TABLE unrelated_sentinel(id TEXT PRIMARY KEY, value TEXT)');
    db.run("INSERT INTO unrelated_sentinel VALUES('keep','unchanged')");
    WM.initSchema(db); WM.initSchema(db);
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.flat();
    for (const name of ['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes','wm_items_fts','unrelated_sentinel']) assert(tables.includes(name), name + ' missing');
    const before = db.exec("SELECT type,name,sql FROM sqlite_master WHERE name LIKE 'wm_%' ORDER BY type,name")[0].values;
    WM.initSchema(db);
    assert.deepStrictEqual(db.exec("SELECT type,name,sql FROM sqlite_master WHERE name LIKE 'wm_%' ORDER BY type,name")[0].values, before);
    const columns = db.exec('PRAGMA table_info(wm_items)')[0].values.map(row => row[1]);
    for (const name of WM.ITEM_COLUMNS) assert(columns.includes(name), `wm_items.${name} missing`);
    assert.strictEqual(count(db, "SELECT count(*) FROM unrelated_sentinel WHERE value='unchanged'"), 1);
    assert.strictEqual(count(db, "SELECT count(*) FROM sqlite_master WHERE name LIKE 'wiz_ref_%'"), 0);
  });

  await T('startup', 'app SQLite startup initializes the WM schema/store without changing the legacy save path', async () => {
    const a = INDEX.indexOf('async function wizInitSQLite()');
    const b = INDEX.indexOf('// ── Инициализация при старте', a);
    assert(a >= 0 && b > a, 'SQLite startup block missing');
    assert(INDEX.includes('<script src="working-memory.js"></script>'), 'WM module not loaded by index.html');
    const db = makeDb(), ctx = { console, Date, Math, JSON, Uint8Array, Promise, Object, Array, Set, Number, String, Error, TextEncoder, crypto: globalThis.crypto };
    ctx.window = ctx; ctx.globalThis = ctx; ctx._wizDB = db; ctx.initSqlJs = async () => SQL;
    ctx._wizIDBGet = async () => null; ctx._wizIDBSet = () => {};
    ctx._wizSaveDBAsync = async () => ({ verified: true });
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'working-memory.js'), 'utf8'), ctx, { filename: 'working-memory.js' });
    const start = INDEX.slice(a, b);
    vm.runInContext(start, ctx, { filename: 'index.html#sqlite-startup' });
    ctx._wizInitMemSchema();
    assert(ctx.WmStore, 'WmStore not initialized');
    for (const table of ['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes','wm_items_fts']) assert.strictEqual(count(db, 'SELECT count(*) FROM sqlite_master WHERE name=?', [table]), 1, table);
    assert.strictEqual(count(db, "SELECT count(*) FROM sqlite_master WHERE name LIKE 'wiz_ref_%'"), 0, 'WM init touched wiz_ref namespace');
  });

  await T(1, 'project/source/item create and stable unique IDs', async () => {
    const db = makeDb(), { store } = makeStore(db);
    const project = ok(await store.createProject({ project_id: 'project-a', name: 'A project' }), 'project');
    assert.strictEqual(project.project_id, 'project-a');
    const source = ok(await store.createSource({ source_id: 'source-a', title: 'A source', project_id: project.project_id }), 'source');
    assert.strictEqual(source.project_id, project.project_id);
    const first = ok(await store.createItem({ title: 'First item', project_id: project.project_id }), 'first item');
    const second = ok(await store.createItem({ title: 'Second item' }), 'second item');
    assert.match(first.work_id, /^wm_/); assert.match(second.work_id, /^wm_/); assert.notStrictEqual(first.work_id, second.work_id);
    assert.strictEqual(store.getItem(first.work_id).work_id, first.work_id, 'generated ID was not stable after read-back');
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_sources'), 1);
  });

  await T(2, 'invalid type/status/priority/provenance and relation enums are rejected', async () => {
    const db = makeDb(), { store } = makeStore(db);
    const badType = await store.createItem(makeItem('bad-type', 'Bad', { type: 'CANON' }));
    const badStatus = await store.createItem(makeItem('bad-status', 'Bad', { status: 'DONE' }));
    const badPriority = await store.createItem(makeItem('bad-priority', 'Bad', { priority: 'P0' }));
    const badProvenance = await store.createItem(makeItem('bad-provenance', 'Bad', { provenance_class: 'MADE_UP' }));
    assert(!badType.ok && badType.code === 'INVALID_ENUM'); assert(!badStatus.ok && badStatus.code === 'INVALID_ENUM');
    assert(!badPriority.ok && badPriority.code === 'INVALID_ENUM'); assert(!badProvenance.ok && badProvenance.code === 'INVALID_ENUM');
    ok(await store.createItem(makeItem('valid-a', 'A'))); ok(await store.createItem(makeItem('valid-b', 'B')));
    const relation = await store.addRelation({ from_work_id: 'valid-a', to_work_id: 'valid-b', relation_type: 'INFERRED' });
    assert(!relation.ok && relation.code === 'INVALID_ENUM');
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_items'), 2);
  });

  await T(3, 'non_canon is always true and cannot be changed in SQL or through the API', async () => {
    const db = makeDb(), { store } = makeStore(db);
    const denied = await store.createItem(makeItem('false-canon', 'Forbidden', { non_canon: false }));
    assert(!denied.ok && denied.code === 'NON_CANON_INVARIANT');
    const item = ok(await store.createItem(makeItem('always-non-canon', 'Working note')));
    assert.strictEqual(item.non_canon, 1);
    assert.throws(() => db.run("UPDATE wm_items SET non_canon=0 WHERE work_id='always-non-canon'"));
    assert.strictEqual(store.getItem(item.work_id).non_canon, 1);
  });

  await T(4, 'BLOCKED and RESOLVED require status_note; RESOLVED also receives resolved_at', async () => {
    const db = makeDb(), { store } = makeStore(db);
    const blocked = await store.createItem(makeItem('blocked-invalid', 'Blocked', { status: 'BLOCKED' }));
    const resolved = await store.createItem(makeItem('resolved-invalid', 'Resolved', { status: 'RESOLVED' }));
    assert(!blocked.ok && blocked.code === 'STATUS_NOTE_REQUIRED');
    assert(!resolved.ok && resolved.code === 'STATUS_NOTE_REQUIRED');
    const b = ok(await store.createItem(makeItem('blocked-valid', 'Blocked', { status: 'BLOCKED', status_note: 'Waiting for access' })));
    const r = ok(await store.createItem(makeItem('resolved-valid', 'Resolved', { status: 'RESOLVED', status_note: 'Verified complete' })));
    assert(b.status_note.trim()); assert(r.status_note.trim()); assert(r.resolved_at && Number.isFinite(Date.parse(r.resolved_at)));
    assert.throws(() => db.run("UPDATE wm_items SET status='RESOLVED', resolved_at=NULL WHERE work_id='blocked-valid'"));
  });

  await T(5, 'SUPERSEDED preserves the old row and explicit relation without inference', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('old-item', 'Prior approach')));
    ok(await store.createItem(makeItem('new-item', 'Replacement')));
    ok(await store.createItem(makeItem('third-item', 'Another item')));
    ok(await store.addRelation({ from_work_id: 'new-item', to_work_id: 'old-item', relation_type: 'SUPERSEDES' }));
    ok(await store.updateItem('old-item', { status: 'SUPERSEDED', status_note: 'Replaced by new-item' }));
    ok(await store.addRelation({ from_work_id: 'third-item', to_work_id: 'new-item', relation_type: 'DEPENDS_ON' }));
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_items WHERE work_id='old-item'"), 1);
    assert.strictEqual(store.getItem('old-item').status, 'SUPERSEDED');
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_relations WHERE from_work_id='third-item' AND to_work_id='old-item'"), 0, 'transitive graph edge was inferred');
  });

  await T(6, 'archive sets archived_at and preserves the row; hard deletion is blocked', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('archive-me', 'Keep row')));
    const archived = ok(await store.archiveItem('archive-me'));
    assert(archived.archived_at); assert.strictEqual(count(db, "SELECT count(*) FROM wm_items WHERE work_id='archive-me'"), 1);
    assert.throws(() => db.run("DELETE FROM wm_items WHERE work_id='archive-me'"));
    assert.strictEqual(store.listItems().length, 0);
    assert.strictEqual(store.searchItems('Keep row').length, 0);
  });

  await T(7, 'item-source links persist and enforce at most one explicit primary source', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('linked-item', 'Linked')));
    ok(await store.createSource({ source_id: 's-a', title: 'Source A' }));
    ok(await store.createSource({ source_id: 's-b', title: 'Source B' }));
    ok(await store.addItemSource({ work_id: 'linked-item', source_id: 's-a', is_primary: true }));
    ok(await store.addItemSource({ work_id: 'linked-item', source_id: 's-b', is_primary: true }));
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_item_sources WHERE work_id='linked-item'"), 2);
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_item_sources WHERE work_id='linked-item' AND is_primary=1"), 1);
    assert.strictEqual(count(db, "SELECT is_primary FROM wm_item_sources WHERE work_id='linked-item' AND source_id='s-a'"), 0);
  });

  await T(8, 'explicit relation types, endpoint checks, and self-relation rejection', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('rel-a', 'A'))); ok(await store.createItem(makeItem('rel-b', 'B')));
    const self = await store.addRelation({ from_work_id: 'rel-a', to_work_id: 'rel-a', relation_type: 'RELATED_TO' });
    assert(!self.ok && self.code === 'SELF_RELATION');
    const missing = await store.addRelation({ from_work_id: 'rel-a', to_work_id: 'missing', relation_type: 'RELATED_TO' });
    assert(!missing.ok && missing.code === 'NOT_FOUND');
    ok(await store.addRelation({ relation_id: 'rel-explicit', from_work_id: 'rel-a', to_work_id: 'rel-b', relation_type: 'BLOCKED_BY' }));
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_relations'), 1);
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_relations WHERE relation_type='BLOCKED_BY'"), 1);
  });

  await T(9, 'tags persist and deterministic search ranking is work ID, exact title, title contains, tag, summary, body', async () => {
    const db = makeDb(), { store } = makeStore(db);
    const records = [
      makeItem('needle', 'ID match'), makeItem('exact-title', 'needle'), makeItem('title-contains', 'Needle extended'),
      makeItem('tag-match', 'Tag record', { tags: ['needle'] }), makeItem('summary-match', 'Summary record', { summary: 'A needle in summary' }),
      makeItem('body-match', 'Body record', { body_md: 'A needle in body' }),
    ];
    for (const item of records) ok(await store.createItem(item));
    assert.deepStrictEqual(store.searchItems('needle').map(item => item.work_id), ['needle','exact-title','title-contains','tag-match','summary-match','body-match']);
    assert.deepStrictEqual(JSON.parse(store.getItem('tag-match').tags_json), ['needle']);
    assert.strictEqual(store.searchItems('needle', 2).length, 2);
  });

  await T(10, 'search defaults to 20 and caps the requested result count at 100', async () => {
    const db = makeDb(); WM.initSchema(db);
    const at = '2026-10-06T00:00:00.000Z';
    for (let i = 0; i < 105; i++) db.run(`INSERT INTO wm_items(work_id,type,status,priority,title,provenance_class,tags_json,non_canon,created_at,updated_at)
      VALUES(?, 'NOTE','OPEN','NORMAL',?,'UNKNOWN','[]',1,?,?)`, ['batch-' + String(i).padStart(3,'0'), 'batch search ' + i, at, at]);
    const { store } = makeStore(db);
    assert.strictEqual(store.searchItems('batch').length, 20);
    assert.strictEqual(store.searchItems('batch', 500).length, 100);
  });

  await T(11, 'search covers title, summary, body, tags, and exact work_id independently', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('exact-id-77', 'Unrelated title')));
    ok(await store.createItem(makeItem('summary-search', 'Title', { summary: 'quartz summary' })));
    ok(await store.createItem(makeItem('body-search', 'Other title', { body_md: 'quartz body' })));
    ok(await store.createItem(makeItem('tag-search', 'Different', { tags: ['quartz'] })));
    for (const query of ['exact-id-77','quartz']) assert(store.searchItems(query).length > 0, query);
    assert.strictEqual(store.searchItems('quartz').map(row => row.work_id).join(','), 'tag-search,summary-search,body-search');
  });

  await T(12, 'unresolved excludes resolved, superseded, and archived items; completed aliases resolved', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('open-q', 'Open question', { status: 'OPEN' })));
    ok(await store.createItem(makeItem('blocked-q', 'Blocked question', { status: 'BLOCKED', status_note: 'Waiting' })));
    ok(await store.createItem(makeItem('resolved-q', 'Resolved question', { status: 'RESOLVED', status_note: 'Done' })));
    ok(await store.createItem(makeItem('superseded-q', 'Superseded question', { status: 'SUPERSEDED' })));
    ok(await store.createItem(makeItem('archived-q', 'Archived question'))); ok(await store.archiveItem('archived-q'));
    assert.deepStrictEqual(store.listUnresolved().map(row => row.work_id).sort(), ['blocked-q','open-q']);
    assert.deepStrictEqual(store.listResolved().map(row => row.work_id), ['resolved-q']);
    assert.deepStrictEqual(store.listCompleted().map(row => row.work_id), ['resolved-q']);
  });

  await T(13, 'change log appends mutation records and rejects update/delete', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createProject({ project_id: 'log-p', name: 'Log project' }));
    ok(await store.createItem(makeItem('log-i', 'Log item')));
    ok(await store.updateItem('log-i', { summary: 'updated' }));
    const appended = ok(await store.appendChange({ work_id: 'log-i', change_type: 'MANUAL_NOTE', before_json: null, after_json: { detail: 'recorded' } }));
    assert(appended.change_id.startsWith('wmc_'));
    assert(store.listChanges('log-i').length >= 3);
    assert.throws(() => db.run("UPDATE wm_changes SET change_type='EDITED' WHERE change_id=?", [appended.change_id]));
    assert.throws(() => db.run("DELETE FROM wm_changes WHERE change_id=?", [appended.change_id]));
  });

  await T(14, 'duplicate create and failed transaction leave no partial rows', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('unique-id', 'Original')));
    const duplicate = await store.createItem(makeItem('unique-id', 'Second title'));
    assert(!duplicate.ok && duplicate.code === 'ID_CONFLICT');
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_items WHERE work_id='unique-id'"), 1);
    assert.strictEqual(store.getItem('unique-id').title, 'Original');
  });

  await T(15, 'SQLite transaction rolls back all newly staged import rows on a same-ID conflict', async () => {
    const donorDb = makeDb(), donor = makeStore(donorDb).store;
    ok(await donor.createProject({ project_id: 'new-project', name: 'Would be staged first' }));
    ok(await donor.createItem(makeItem('shared-item', 'Donor title')));
    const payload = JSON.parse(donor.exportJSON());
    const targetDb = makeDb(), target = makeStore(targetDb).store;
    ok(await target.createItem(makeItem('shared-item', 'Different title')));
    const before = target.exportJSON();
    const conflict = await target.importJSON(JSON.stringify(payload));
    assert(!conflict.ok && conflict.code === 'IMPORT_CONFLICT');
    assert.strictEqual(target.exportJSON(), before, 'partial import was not rolled back');
    assert.strictEqual(count(targetDb, "SELECT count(*) FROM wm_projects WHERE project_id='new-project'"), 0);
  });

  await T(16, 'awaited durable save and independent SQLite-byte reload preserve item rows and stable IDs', async () => {
    const db = makeDb(); let saved = null, acknowledgements = 0;
    const { store } = makeStore(db, async currentDb => {
      const written = byteCopy(currentDb.export()); saved = byteCopy(written); acknowledgements++;
      const readBack = byteCopy(saved);
      return { verified: bytesEqual(written, readBack), bytes: readBack.length, method: 'independent-test-readback' };
    });
    const item = ok(await store.createItem({ title: 'Durable row', tags: ['durable'] }));
    assert(saved && acknowledgements === 1);
    const reloaded = new SQL.Database(saved);
    const afterReload = WM.create(reloaded, { persist: async () => ({ verified: true }) });
    assert.strictEqual(afterReload.getItem(item.work_id).title, 'Durable row');
    assert.strictEqual(afterReload.getItem(item.work_id).non_canon, 1);
    assert.deepStrictEqual(JSON.parse(afterReload.getItem(item.work_id).tags_json), ['durable']);
  });

  await T(17, 'missing or failed persistence returns failure and restores the prior WM namespace', async () => {
    const db = makeDb(); let calls = 0;
    const { store } = makeStore(db, async currentDb => {
      calls++;
      if (calls === 1) throw new Error('simulated IndexedDB failure');
      return { verified: true, bytes: currentDb.export().length };
    });
    const failed = await store.createItem(makeItem('not-durable', 'Must roll back'));
    assert(!failed.ok && !failed.saved && failed.rolledBack && failed.rollbackDurable);
    assert.strictEqual(store.getItem('not-durable'), null);
    assert.strictEqual(calls, 2, 'compensating durable save did not run');
    const noPersistDb = makeDb(), noPersist = WM.create(noPersistDb);
    const noSave = await noPersist.createItem(makeItem('no-adapter', 'Must fail closed'));
    assert(!noSave.ok && !noSave.saved && noSave.code === 'PERSISTENCE_UNAVAILABLE');
    assert.strictEqual(count(noPersistDb, 'SELECT count(*) FROM wm_items'), 0);
  });

  await T(18, 'unverifiable persistence does not report saved; uncertain rollback poisons future writes', async () => {
    const db = makeDb();
    const { store } = makeStore(db, async () => ({ verified: false }));
    const first = await store.createItem(makeItem('uncertain-item', 'Unverified'));
    assert(!first.ok && !first.saved && !first.rollbackDurable && first.persistenceState === 'UNKNOWN');
    assert.strictEqual(store.getItem('uncertain-item'), null, 'in-memory state was not compensated');
    const second = await store.createItem(makeItem('another-item', 'Blocked until reload'));
    assert(!second.ok && second.code === 'PERSISTENCE_UNCERTAIN');
  });

  await T(19, 'single-tab write serialization is documented and concurrent same-instance commits both persist', async () => {
    const db = makeDb(); let saves = 0;
    const { store } = makeStore(db, async currentDb => { await Promise.resolve(); saves++; return { verified: currentDb.export().length > 0 }; });
    const results = await Promise.all([store.createItem(makeItem('parallel-a', 'Parallel A')), store.createItem(makeItem('parallel-b', 'Parallel B'))]);
    assert(results.every(entry => entry.ok && entry.saved)); assert.strictEqual(saves, 2);
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_items'), 2);
    assert.strictEqual(WM.MULTI_TAB_WRITES, 'NOT_SUPPORTED_IN_V0_1');
  });

  await T(20, 'versioned JSON export/import round-trips all six datasets; equivalent same-ID import is a no-op', async () => {
    const sourceDb = makeDb(), source = makeStore(sourceDb).store;
    ok(await source.createProject({ project_id: 'roundtrip-project', name: 'Roundtrip' }));
    ok(await source.createSource({ source_id: 'roundtrip-source', title: 'Source', project_id: 'roundtrip-project', metadata_json: { kind: 'fixture' } }));
    ok(await source.createItem(makeItem('roundtrip-a', 'Question', { project_id: 'roundtrip-project', type: 'QUESTION', tags: ['alpha','beta'] })));
    ok(await source.createItem(makeItem('roundtrip-b', 'Answer', { status: 'RESOLVED', status_note: 'Checked' })));
    ok(await source.addItemSource({ work_id: 'roundtrip-a', source_id: 'roundtrip-source', is_primary: true }));
    ok(await source.addRelation({ relation_id: 'roundtrip-rel', from_work_id: 'roundtrip-b', to_work_id: 'roundtrip-a', relation_type: 'DERIVED_FROM' }));
    ok(await source.appendChange({ work_id: 'roundtrip-a', change_type: 'FIXTURE', after_json: { source: 'synthetic' } }));
    const exportText = source.exportJSON(), decoded = JSON.parse(exportText);
    assert.strictEqual(decoded.format, 'eiti-working-memory-export/1');
    for (const key of ['projects','sources','items','item_sources','relations','changes']) assert(Array.isArray(decoded[key]), key);
    const targetDb = makeDb(), target = makeStore(targetDb).store;
    const imported = ok(await target.importJSON(exportText), 'import'); assert.strictEqual(imported.imported > 0, true);
    assert.deepStrictEqual(JSON.parse(target.exportJSON()), decoded);
    const before = target.exportJSON();
    const repeated = await target.importJSON(exportText);
    assert(repeated.ok && repeated.saved && repeated.noOp && repeated.data.unchanged > 0);
    assert.strictEqual(target.exportJSON(), before);
  });

  await T(21, 'same-ID/different-content import fails closed without overwriting or partial changes', async () => {
    const donorDb = makeDb(), donor = makeStore(donorDb).store;
    ok(await donor.createProject({ project_id: 'conflict-stage', name: 'Stage' }));
    ok(await donor.createItem(makeItem('conflict-id', 'Donor version')));
    const payload = JSON.parse(donor.exportJSON());
    const targetDb = makeDb(), target = makeStore(targetDb).store;
    ok(await target.createItem(makeItem('conflict-id', 'Local version')));
    const original = target.getItem('conflict-id'), before = target.exportJSON();
    const outcome = await target.importJSON(payload);
    assert(!outcome.ok && outcome.saved === false && outcome.code === 'IMPORT_CONFLICT');
    assert.strictEqual(target.getItem('conflict-id').title, original.title);
    assert.strictEqual(target.exportJSON(), before);
    assert.strictEqual(count(targetDb, "SELECT count(*) FROM wm_projects WHERE project_id='conflict-stage'"), 0);
  });

  await T(22, 'archive and relation updates maintain FTS index consistency; item update reindexes searchable text', async () => {
    const db = makeDb(), { store } = makeStore(db);
    ok(await store.createItem(makeItem('fts-update', 'Before text', { summary: 'old summary' })));
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_items_fts WHERE title MATCH 'Before'"), 1);
    ok(await store.updateItem('fts-update', { title: 'After text', summary: 'new summary', tags: ['newtag'] }));
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_items_fts WHERE title MATCH 'Before'"), 0);
    assert.strictEqual(count(db, "SELECT count(*) FROM wm_items_fts WHERE title MATCH 'After'"), 1);
    assert.strictEqual(store.searchItems('newtag')[0].work_id, 'fts-update');
  });

  await T(23, 'schema and module integration preserve the requested forbidden namespaces', async () => {
    const source = fs.readFileSync(path.join(ROOT, 'working-memory.js'), 'utf8');
    assert(!/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\s+(?:TABLE\s+)?(?:wiz_facts|wiz_ledger|ledger|wiz_ref_)/i.test(source));
    assert(!/case\s+['"]wm_[a-z_]+['"]\s*:/i.test(INDEX), 'WM agent tool was added');
    assert(!/<button\b[^>]*(?:working[- ]memory|wm_)/i.test(INDEX), 'WM UI was added');
    assert(!INDEX.includes('wm_items_fts') || INDEX.includes('working-memory.js'), 'WM application wiring missing');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert(sw.includes("BASE_PATH + '/working-memory.js'"));
  });

  console.log(`\n${results.filter(row => row[1] === 'PASS').length}/${results.length} tests passed.`);
  if (results.some(row => row[1] !== 'PASS')) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

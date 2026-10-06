// DB-level acceptance tests for the isolated wm_* core data layer.
// Uses the repository SQL.js/WASM build and synthetic records only.
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
const NOW = '2026-10-06T11:23:45.000Z';

async function T(id, name, fn) {
  try { await fn(); results.push([id, 'PASS', name]); console.log(`PASS  [${id}] ${name}`); }
  catch (error) { results.push([id, 'FAIL', name, error.message]); console.log(`FAIL  [${id}] ${name}\n      ${error.stack.split('\n').slice(0, 5).join('\n      ')}`); }
}
function makeDb() { return new SQL.Database(); }
function count(db, sql, params) { const r = db.exec(sql, params || []); return r.length ? r[0].values[0][0] : 0; }
function byteCopy(value) { return value ? new Uint8Array(value).slice() : null; }
function bytesEqual(a, b) { return !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]); }
function makeStore(db, persistence, options) {
  let sequence = 0;
  const saves = [];
  const persist = persistence || (async currentDb => {
    const bytes = byteCopy(currentDb.export()); saves.push(bytes);
    return { verified: bytesEqual(bytes, byteCopy(bytes)), bytes: bytes.length, method: 'test-readback' };
  });
  const store = WM.create(db, Object.assign({ now: () => NOW, actorClass: 'SYSTEM', persist: () => persist(db),
    idFactory: prefix => prefix + String(++sequence).padStart(6, '0') }, options || {}));
  return { store, saves };
}
function ok(response, label) { assert(response && response.ok && response.saved, `${label || 'mutation'} not durably saved: ${JSON.stringify(response)}`); return response.data; }
function projectData(project_id = 'test-project', code = 'EITI', extra = {}) {
  return Object.assign({ project_id, code, name: 'Synthetic project' }, extra);
}
function itemData(title, extra = {}) {
  return Object.assign({ project_id: 'test-project', title, provenance_class: 'USER_NOTE' }, extra);
}
async function createProject(store, id, code, extra) { return ok(await store.createProject(projectData(id, code, extra))); }
async function createItem(store, title, extra) { return ok(await store.createItem(itemData(title, extra))); }

(async () => {
  SQL = await initSqlJs({ wasmBinary: WASM });

  await T('schema-contract', 'schema is additive/idempotent and exposes exactly the corrected project, source, item, and change fields', async () => {
    const db = makeDb();
    db.run('CREATE TABLE unrelated_sentinel(id TEXT PRIMARY KEY, value TEXT)');
    db.run("INSERT INTO unrelated_sentinel VALUES('keep','unchanged')");
    WM.initSchema(db); WM.initSchema(db);
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.flat();
    for (const name of ['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes','wm_items_fts','unrelated_sentinel']) assert(tables.includes(name), name + ' missing');
    const before = db.exec("SELECT type,name,sql FROM sqlite_master WHERE name LIKE 'wm_%' ORDER BY type,name")[0].values;
    WM.initSchema(db);
    assert.deepStrictEqual(db.exec("SELECT type,name,sql FROM sqlite_master WHERE name LIKE 'wm_%' ORDER BY type,name")[0].values, before);
    for (const [table, expected] of Object.entries(WM.TABLE_COLUMNS)) {
      const actual = db.exec(`PRAGMA table_info(${table})`)[0].values.map(row => row[1]);
      assert.deepStrictEqual(actual, expected, `${table} fields/order`);
    }
    const sourceProjectColumn = db.exec('PRAGMA table_info(wm_sources)')[0].values.find(row => row[1] === 'project_id');
    assert.strictEqual(sourceProjectColumn[3], 1, 'wm_sources.project_id is NOT NULL');
    assert.deepStrictEqual(WM.ITEM_COLUMNS, ['work_id','project_id','thread','type','status','priority','title','summary','body_md','current_question','status_note','next_action','provenance_class','tags_json','non_canon','created_at','updated_at','resolved_at','archived_at']);
    assert.strictEqual(count(db, "SELECT count(*) FROM unrelated_sentinel WHERE value='unchanged'"), 1);
    assert.strictEqual(count(db, "SELECT count(*) FROM sqlite_master WHERE name LIKE 'wiz_ref_%'"), 0);
    const stale = makeDb();
    stale.run('CREATE TABLE wm_projects(project_id TEXT PRIMARY KEY,name TEXT,description TEXT,created_at TEXT,updated_at TEXT)');
    assert.throws(() => WM.initSchema(stale), error => error.code === 'WM_SCHEMA_MISMATCH');
    assert.strictEqual(count(stale, "SELECT count(*) FROM sqlite_master WHERE name LIKE 'wm_%'"), 1);
  });

  await T('exact-enums', 'all original TYPE, STATUS, PRIORITY, and PROVENANCE_CLASS values are accepted; invented values are rejected', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    assert.deepStrictEqual(WM.ENUMS.type, ['NOTE','QUOTE','VALUE','QUESTION','HYPOTHESIS','DECISION','MODEL_PROPOSAL','DONOR_CANDIDATE','EXPERIMENT','FINDING','SYSTEM','TASK','SOURCE_POINTER']);
    assert.deepStrictEqual(WM.ENUMS.status, ['CURRENT','OPEN','IN_PROGRESS','BLOCKED','UNKNOWN','RESOLVED','COMPLETED','REJECTED','SUPERSEDED']);
    assert.deepStrictEqual(WM.ENUMS.priority, ['P0','P1','P2','P3','TAIL']);
    assert.deepStrictEqual(WM.ENUMS.provenance_class, ['USER_NOTE','USER_DECISION','USER_QUOTE','MODEL_PROPOSAL','MODEL_SUMMARY','PROJECT_SOURCE','EXTERNAL_SOURCE','EXPERIMENT_RESULT']);
    assert.notStrictEqual(WM.ENUMS.provenance_class.indexOf('MODEL_SUMMARY'), WM.ENUMS.provenance_class.indexOf('USER_DECISION'));
    assert.notStrictEqual(WM.ENUMS.provenance_class.indexOf('MODEL_PROPOSAL'), WM.ENUMS.provenance_class.indexOf('USER_DECISION'));
    for (const type of WM.ENUMS.type) await createItem(store, 'Type ' + type, { type });
    for (const status of WM.ENUMS.status) {
      const extra = { status };
      if (['BLOCKED','RESOLVED','REJECTED'].includes(status)) extra.status_note = `${status} test reason`;
      await createItem(store, 'Status ' + status, extra);
    }
    for (const priority of WM.ENUMS.priority) await createItem(store, 'Priority ' + priority, { priority });
    for (const provenance_class of WM.ENUMS.provenance_class) await createItem(store, 'Provenance ' + provenance_class, { provenance_class });
    for (const type of ['RISK','BLOCKER','INSIGHT','RESEARCH','CANON']) {
      const response = await store.createItem(itemData('Invalid type ' + type, { type }));
      assert(!response.ok && response.code === 'INVALID_ENUM', type);
    }
    for (const status of ['DONE','COMPLETE','DEFERRED']) {
      const response = await store.createItem(itemData('Invalid status ' + status, { status }));
      assert(!response.ok && response.code === 'INVALID_ENUM', status);
    }
    for (const priority of ['LOW','NORMAL','HIGH','URGENT']) {
      const response = await store.createItem(itemData('Invalid priority ' + priority, { priority }));
      assert(!response.ok && response.code === 'INVALID_ENUM', priority);
    }
    for (const provenance_class of ['USER_STATED','SOURCE_DERIVED','AGENT_DERIVED','MIXED','UNKNOWN']) {
      const response = await store.createItem(itemData('Invalid provenance ' + provenance_class, { provenance_class }));
      assert(!response.ok && response.code === 'INVALID_ENUM', provenance_class);
    }
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_items'), WM.ENUMS.type.length + WM.ENUMS.status.length + WM.ENUMS.priority.length + WM.ENUMS.provenance_class.length);
  });

  await T('work-id', 'automatic WRK IDs are immutable, transaction-serialized, deterministic, and never reused after archive', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store, 'project-eiti', 'EITI');
    const first = await createItem(store, 'First', { project_id: 'project-eiti' });
    const second = await createItem(store, 'Second', { project_id: 'project-eiti' });
    assert.strictEqual(first.work_id, 'WRK-EITI-20261006-001');
    assert.strictEqual(second.work_id, 'WRK-EITI-20261006-002');
    assert.strictEqual(first.thread, '');
    const manual = await store.createItem(itemData('Manual ID', { work_id: 'WRK-EITI-20261006-099' }));
    assert(!manual.ok && manual.code === 'WORK_ID_IMMUTABLE');
    const updated = await store.updateItem(first.work_id, { work_id: 'WRK-EITI-20261006-099' });
    assert(!updated.ok && updated.code === 'VALIDATION');
    assert.throws(() => db.run('UPDATE wm_items SET work_id=? WHERE work_id=?', ['WRK-EITI-20261006-099', first.work_id]));
    ok(await store.archiveItem(first.work_id));
    const third = await createItem(store, 'Third', { project_id: 'project-eiti' });
    assert.strictEqual(third.work_id, 'WRK-EITI-20261006-003');
    const concurrent = await Promise.all([store.createItem(itemData('Concurrent A', { project_id: 'project-eiti' })), store.createItem(itemData('Concurrent B', { project_id: 'project-eiti' }))]);
    assert.deepStrictEqual(concurrent.map(r => r.data.work_id), ['WRK-EITI-20261006-004','WRK-EITI-20261006-005']);
    assert.strictEqual(WM.MULTI_TAB_WRITES, 'NOT_SUPPORTED_IN_V0_1');
  });

  await T('project-contract', 'project code is required, normalized, unique, and suitable for IDs; project_id is required on items', async () => {
    const db = makeDb(), { store } = makeStore(db);
    const project = await createProject(store, 'project-a', 'eiti', { summary: 'Quick project brief' });
    assert.strictEqual(project.code, 'EITI');
    assert.strictEqual(project.summary, 'Quick project brief');
    const duplicate = await store.createProject(projectData('project-b', 'EITI'));
    assert(!duplicate.ok && duplicate.code === 'PROJECT_CODE_CONFLICT');
    const badCode = await store.createProject(projectData('project-c', 'has spaces'));
    assert(!badCode.ok && badCode.code === 'VALIDATION');
    const absent = await store.createItem({ title: 'Missing project', provenance_class: 'USER_NOTE' });
    assert(!absent.ok && absent.code === 'VALIDATION');
    const unknown = await store.createItem(itemData('Unknown project', { project_id: 'not-created' }));
    assert(!unknown.ok && unknown.code === 'NOT_FOUND');
    const row = db.exec("SELECT project_id,code,name,summary,created_at,updated_at FROM wm_projects WHERE project_id='project-a'")[0].values[0];
    assert.deepStrictEqual(row.slice(0,4), ['project-a','EITI','Synthetic project','Quick project brief']);
  });

  await T('project-immutability', 'project_id cannot be retargeted through the API or SQLite and EITI export/import remains valid', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store, 'project-eiti', 'EITI');
    await createProject(store, 'project-crystal', 'CRYSTAL');
    const item = await createItem(store, 'EITI-owned item', { project_id: 'project-eiti' });
    assert.strictEqual(item.work_id, 'WRK-EITI-20261006-001');
    const rejected = await store.updateItem(item.work_id, { project_id: 'project-crystal' });
    assert(!rejected.ok && !rejected.saved && rejected.code === 'PROJECT_ID_IMMUTABLE');
    assert.strictEqual(store.getItem(item.work_id).project_id, 'project-eiti');
    assert.throws(() => db.run('UPDATE wm_items SET project_id=? WHERE work_id=?', ['project-crystal', item.work_id]));
    assert.strictEqual(store.getItem(item.work_id).project_id, 'project-eiti');
    const exported = JSON.parse(store.exportJSON());
    const target = makeStore(makeDb()).store;
    ok(await target.importJSON(exported), 'EITI project import');
    assert.strictEqual(target.getItem(item.work_id).project_id, 'project-eiti');
    assert.deepStrictEqual(JSON.parse(target.exportJSON()), exported);
  });

  await T('thread-quick-capture', 'thread defaults to an unambiguous empty string and summary/body export as normalized null-or-text values', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const quick = await createItem(store, 'Quick Capture', { summary: '', body_md: 'Captured body' });
    assert.strictEqual(quick.thread, '');
    assert.strictEqual(quick.summary, null);
    assert.strictEqual(quick.body_md, 'Captured body');
    const withSummary = await createItem(store, 'Quick Capture summary', { summary: 'One-line note', body_md: null });
    const exported = JSON.parse(store.exportJSON());
    assert.strictEqual(exported.items.find(row => row.work_id === quick.work_id).summary, null);
    assert.strictEqual(exported.items.find(row => row.work_id === quick.work_id).body_md, 'Captured body');
    assert.strictEqual(exported.items.find(row => row.work_id === withSummary.work_id).summary, 'One-line note');
    assert.strictEqual(exported.items.find(row => row.work_id === withSummary.work_id).body_md, null);
    assert(exported.items.every(row => typeof row.thread === 'string'));
  });

  await T('source-navigation', 'source surface, role, required locator, revision, and note implement the WHERE TO LOOK model', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const source = ok(await store.createSource({ source_id: 'source-one', project_id: 'test-project', surface: 'GITHUB', role: 'PRIMARY', title: 'Source navigation', locator: 'https://example.test/repo', revision: 'abc123', note: 'Pinned review location' }));
    assert.deepStrictEqual(WM.ENUMS.surface, ['GITHUB','NOTION','DRIVE','LOCAL','WEB','CHAT','OTHER']);
    assert.deepStrictEqual(WM.ENUMS.role, ['PRIMARY','EVIDENCE','CONTEXT','NAVIGATION','REFERENCE']);
    assert.strictEqual(source.locator, 'https://example.test/repo');
    assert.strictEqual(source.role, 'PRIMARY');
    assert.strictEqual(source.surface, 'GITHUB');
    for (const surface of WM.ENUMS.surface) {
      const accepted = await store.createSource({ project_id: 'test-project', title: 'Surface ' + surface, locator: 'fixture://' + surface.toLowerCase(), surface, role: 'REFERENCE' });
      assert(accepted.ok, surface);
    }
    for (const role of WM.ENUMS.role) {
      const accepted = await store.createSource({ project_id: 'test-project', title: 'Role ' + role, locator: 'fixture://' + role.toLowerCase(), surface: 'OTHER', role });
      assert(accepted.ok, role);
    }
    const missingProject = await store.createSource({ title: 'No project', locator: 'fixture://no-project', surface: 'WEB', role: 'REFERENCE' });
    assert(!missingProject.ok && missingProject.code === 'VALIDATION');
    const unknownProject = await store.createSource({ project_id: 'not-created', title: 'Unknown project', locator: 'fixture://unknown-project', surface: 'WEB', role: 'REFERENCE' });
    assert(!unknownProject.ok && unknownProject.code === 'NOT_FOUND');
    const missing = await store.createSource({ project_id: 'test-project', title: 'No locator', surface: 'WEB', role: 'REFERENCE' });
    assert(!missing.ok && missing.code === 'VALIDATION');
    const badSurface = await store.createSource({ project_id: 'test-project', title: 'Bad surface', locator: 'https://example.test', surface: 'EMAIL', role: 'REFERENCE' });
    assert(!badSurface.ok && badSurface.code === 'INVALID_ENUM');
    const badRole = await store.createSource({ project_id: 'test-project', title: 'Bad role', locator: 'https://example.test', surface: 'WEB', role: 'OWNER' });
    assert(!badRole.ok && badRole.code === 'INVALID_ENUM');
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_sources WHERE locator IS NULL OR trim(locator)=\'\''), 0);
    assert.deepStrictEqual(WM.TABLE_COLUMNS.wm_sources, ['source_id','project_id','surface','role','title','locator','revision','note','created_at','updated_at']);
  });

  await T('non-canon', 'non_canon=1 remains a hard invariant in API and SQL', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const denied = await store.createItem(itemData('Forbidden', { non_canon: false }));
    assert(!denied.ok && denied.code === 'NON_CANON_INVARIANT');
    const item = await createItem(store, 'Always non-canon');
    assert.strictEqual(item.non_canon, 1);
    assert.throws(() => db.run('UPDATE wm_items SET non_canon=0 WHERE work_id=?', [item.work_id]));
  });

  await T('lifecycle', 'UNRESOLVED is exactly OPEN/IN_PROGRESS/BLOCKED/UNKNOWN; RESOLVED and COMPLETED are distinct views', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const ids = {};
    for (const status of WM.UNRESOLVED_STATUSES) {
      const extra = { status };
      if (['BLOCKED','RESOLVED'].includes(status)) extra.status_note = 'Waiting on dependency';
      ids[status] = (await createItem(store, 'Unresolved ' + status, extra)).work_id;
    }
    for (const status of ['CURRENT','RESOLVED','COMPLETED','REJECTED','SUPERSEDED']) {
      const extra = { status };
      if (['RESOLVED','REJECTED'].includes(status)) extra.status_note = 'Lifecycle note/reason';
      ids[status] = (await createItem(store, 'Terminal or current ' + status, extra)).work_id;
    }
    assert.deepStrictEqual(store.listUnresolved().map(row => row.status).sort(), ['BLOCKED','IN_PROGRESS','OPEN','UNKNOWN']);
    assert(!store.listUnresolved().some(row => row.status === 'CURRENT'));
    assert.deepStrictEqual(store.listResolved().map(row => row.status), ['RESOLVED']);
    assert.deepStrictEqual(store.listCompleted().map(row => row.status), ['COMPLETED']);
    assert.notDeepStrictEqual(store.listResolved().map(row => row.work_id), store.listCompleted().map(row => row.work_id));
    assert.strictEqual(WM.UNRESOLVED_STATUSES.join(','), 'OPEN,IN_PROGRESS,BLOCKED,UNKNOWN');
    assert(!store.listUnresolved().some(row => ['CURRENT','RESOLVED','COMPLETED','REJECTED','SUPERSEDED'].includes(row.status)));
    const blocked = await store.createItem(itemData('Bad blocked', { status: 'BLOCKED' }));
    const rejected = await store.createItem(itemData('Bad rejected', { status: 'REJECTED' }));
    const badResolved = await store.createItem(itemData('Bad resolved', { status: 'RESOLVED' }));
    assert(!blocked.ok && blocked.code === 'STATUS_NOTE_REQUIRED');
    assert(!rejected.ok && rejected.code === 'STATUS_NOTE_REQUIRED');
    assert(!badResolved.ok && badResolved.code === 'STATUS_NOTE_REQUIRED');
    const resolved = store.getItem(ids.RESOLVED);
    assert(resolved.status_note && resolved.resolved_at);
  });

  await T('supersede-archive', 'SUPERSEDED retains the old row; archive changes archived_at only and blocks hard delete', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const old = await createItem(store, 'Prior approach');
    const newer = await createItem(store, 'Replacement');
    ok(await store.addRelation({ from_work_id: newer.work_id, to_work_id: old.work_id, relation_type: 'SUPERSEDES' }));
    ok(await store.updateItem(old.work_id, { status: 'SUPERSEDED', status_note: 'Replaced by a newer item' }));
    assert.strictEqual(store.getItem(old.work_id).status, 'SUPERSEDED');
    const before = store.getItem(newer.work_id);
    const archived = ok(await store.archiveItem(newer.work_id));
    assert(archived.archived_at);
    assert.strictEqual(archived.status, 'OPEN');
    assert.strictEqual(archived.updated_at, before.updated_at);
    const change = store.listChanges(newer.work_id).at(-1);
    assert.deepStrictEqual(JSON.parse(change.changed_fields_json), ['archived_at']);
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_items WHERE work_id=?', [newer.work_id]), 1);
    assert.throws(() => db.run('DELETE FROM wm_items WHERE work_id=?', [newer.work_id]));
    assert(!store.listItems().some(row => row.work_id === newer.work_id));
  });

  await T('change-history', 'change log is append-only and preserves actor_class plus changed_fields_json', async () => {
    const db = makeDb(), { store } = makeStore(db, null, { actorClass: 'USER' });
    await createProject(store);
    const item = await createItem(store, 'Actor record');
    const createChange = store.listChanges(item.work_id)[0];
    assert.strictEqual(createChange.actor_class, 'USER');
    assert(JSON.parse(createChange.changed_fields_json).includes('provenance_class'));
    ok(await store.updateItem(item.work_id, { summary: 'Updated summary' }));
    const updateChange = store.listChanges(item.work_id).at(-1);
    assert.strictEqual(updateChange.actor_class, 'USER');
    assert.deepStrictEqual(JSON.parse(updateChange.changed_fields_json), ['summary']);
    const manual = ok(await store.appendChange({ work_id: item.work_id, change_type: 'MODEL_REVIEW', actor_class: 'MODEL', changed_fields_json: ['summary'], before_json: { summary: null }, after_json: { summary: 'Updated summary' } }));
    assert.strictEqual(manual.actor_class, 'MODEL');
    assert.deepStrictEqual(JSON.parse(manual.changed_fields_json), ['summary']);
    assert.throws(() => db.run('UPDATE wm_changes SET change_type=\'EDITED\' WHERE change_id=?', [manual.change_id]));
    assert.throws(() => db.run('DELETE FROM wm_changes WHERE change_id=?', [manual.change_id]));
    const provenance = await createItem(store, 'Nonconflated provenance', { provenance_class: 'MODEL_SUMMARY' });
    const proposal = await createItem(store, 'Proposal provenance', { provenance_class: 'MODEL_PROPOSAL' });
    const decision = await createItem(store, 'User decision provenance', { provenance_class: 'USER_DECISION' });
    assert.deepStrictEqual([provenance.provenance_class, proposal.provenance_class, decision.provenance_class], ['MODEL_SUMMARY','MODEL_PROPOSAL','USER_DECISION']);
  });

  await T('search-ranking', 'search ranking is deterministic: exact WORK_ID, exact title, title contains, tag, summary, body', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const idMatch = await createItem(store, 'ID target');
    const exactTitle = await createItem(store, 'needle');
    const containsTitle = await createItem(store, 'Needle extended');
    const tag = await createItem(store, 'Tag record', { tags: ['needle'] });
    const summary = await createItem(store, 'Summary record', { summary: 'A needle in summary' });
    const body = await createItem(store, 'Body record', { body_md: 'A needle in body' });
    const idTitle = await createItem(store, idMatch.work_id);
    const results = store.searchItems('needle').map(row => row.work_id);
    assert.deepStrictEqual(results, [exactTitle.work_id, containsTitle.work_id, tag.work_id, summary.work_id, body.work_id]);
    assert.deepStrictEqual(store.searchItems(idMatch.work_id).map(row => row.work_id), [idMatch.work_id, idTitle.work_id]);
    assert.strictEqual(store.searchItems('needle', 2).length, 2);
    assert.strictEqual(JSON.parse(store.getItem(tag.work_id).tags_json)[0], 'needle');
  });

  await T('search-limits', 'search defaults to 20 and caps the requested result count at 100', async () => {
    const db = makeDb(); WM.initSchema(db);
    const raw = WM.create(db, { persist: async () => ({ verified: true }), now: () => NOW });
    await createProject(raw);
    for (let i = 0; i < 105; i++) await createItem(raw, 'batch search ' + i);
    assert.strictEqual(raw.searchItems('batch').length, 20);
    assert.strictEqual(raw.searchItems('batch', 500).length, 100);
  });

  await T('source-links-relations', 'source links and explicit relations validate endpoints without inferred edges', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const itemA = await createItem(store, 'A');
    const itemB = await createItem(store, 'B');
    const sourceA = ok(await store.createSource({ title: 'Source A', project_id: 'test-project', surface: 'WEB', role: 'EVIDENCE', locator: 'https://example.test/a' }));
    const sourceB = ok(await store.createSource({ title: 'Source B', project_id: 'test-project', surface: 'LOCAL', role: 'REFERENCE', locator: 'local://fixture/b' }));
    ok(await store.addItemSource({ work_id: itemA.work_id, source_id: sourceA.source_id, is_primary: true }));
    ok(await store.addItemSource({ work_id: itemA.work_id, source_id: sourceB.source_id, is_primary: true }));
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_item_sources WHERE work_id=? AND is_primary=1', [itemA.work_id]), 1);
    const self = await store.addRelation({ from_work_id: itemA.work_id, to_work_id: itemA.work_id, relation_type: 'RELATED_TO' });
    const missing = await store.addRelation({ from_work_id: itemA.work_id, to_work_id: 'WRK-EITI-20261006-099', relation_type: 'RELATED_TO' });
    assert(!self.ok && self.code === 'SELF_RELATION');
    assert(!missing.ok && missing.code === 'NOT_FOUND');
    ok(await store.addRelation({ from_work_id: itemB.work_id, to_work_id: itemA.work_id, relation_type: 'DEPENDS_ON' }));
    assert.strictEqual(count(db, 'SELECT count(*) FROM wm_relations'), 1);
  });

  await T('non-project-thread-db', 'SQLite itself rejects missing project_id, null thread, and invalid enum/locator values', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    assert.throws(() => db.run("INSERT INTO wm_items(work_id,project_id,thread,type,status,priority,title,provenance_class,tags_json,non_canon,created_at,updated_at) VALUES('WRK-EITI-20261006-901',NULL,'','NOTE','OPEN','P2','bad','USER_NOTE','[]',1,?,?)", [NOW,NOW]));
    assert.throws(() => db.run("INSERT INTO wm_items(work_id,project_id,thread,type,status,priority,title,provenance_class,tags_json,non_canon,created_at,updated_at) VALUES('WRK-EITI-20261006-902','test-project',NULL,'NOTE','OPEN','P2','bad','USER_NOTE','[]',1,?,?)", [NOW,NOW]));
    assert.throws(() => db.run("INSERT INTO wm_sources(source_id,surface,role,title,locator,created_at,updated_at) VALUES('no-locator','WEB','REFERENCE','Bad',NULL,?,?)", [NOW,NOW]));
    assert.throws(() => db.run("INSERT INTO wm_sources(source_id,project_id,surface,role,title,locator,created_at,updated_at) VALUES('null-source-project',NULL,'WEB','REFERENCE','Bad','fixture://bad',?,?)", [NOW,NOW]));
  });

  await T('export-roundtrip', 'eiti-working-memory-export/1 round-trips corrected schemas; equivalent imports no-op without overwrite', async () => {
    const sourceDb = makeDb(), source = makeStore(sourceDb).store;
    await createProject(source, 'roundtrip-project', 'RT', { summary: 'Roundtrip project' });
    const sourceRef = ok(await source.createSource({ source_id: 'roundtrip-source', project_id: 'roundtrip-project', surface: 'NOTION', role: 'PRIMARY', title: 'Source', locator: 'https://notion.example/page', revision: 'r7', note: 'Pinned source' }));
    const question = await createItem(source, 'Question', { project_id: 'roundtrip-project', type: 'QUESTION', status: 'OPEN', priority: 'P1', provenance_class: 'USER_QUOTE', summary: 'Question summary', body_md: 'Question body', thread: 'thread-a', tags: ['alpha','beta'] });
    await createItem(source, 'Resolved note', { project_id: 'roundtrip-project', status: 'RESOLVED', status_note: 'Verified', provenance_class: 'MODEL_SUMMARY' });
    await createItem(source, 'Completed note', { project_id: 'roundtrip-project', status: 'COMPLETED', provenance_class: 'USER_DECISION' });
    ok(await source.addItemSource({ work_id: question.work_id, source_id: sourceRef.source_id, is_primary: true }));
    const completed = source.listCompleted()[0];
    ok(await source.addRelation({ relation_id: 'roundtrip-rel', from_work_id: completed.work_id, to_work_id: question.work_id, relation_type: 'DERIVED_FROM' }));
    ok(await source.appendChange({ work_id: question.work_id, change_type: 'FIXTURE', actor_class: 'USER', changed_fields_json: ['summary'], after_json: { source: 'synthetic' } }));
    const exportText = source.exportJSON(), decoded = JSON.parse(exportText);
    assert.strictEqual(decoded.format, 'eiti-working-memory-export/1');
    for (const key of ['projects','sources','items','item_sources','relations','changes']) assert(Array.isArray(decoded[key]), key);
    assert.deepStrictEqual(Object.keys(decoded.projects[0]).sort(), WM.TABLE_COLUMNS.wm_projects.slice().sort());
    assert.deepStrictEqual(Object.keys(decoded.sources[0]).sort(), WM.TABLE_COLUMNS.wm_sources.slice().sort());
    assert(decoded.changes.every(row => row.actor_class && Array.isArray(JSON.parse(row.changed_fields_json))));
    const targetDb = makeDb(), target = makeStore(targetDb).store;
    const imported = ok(await target.importJSON(exportText), 'import'); assert(imported.imported > 0);
    assert.deepStrictEqual(JSON.parse(target.exportJSON()), decoded);
    const before = target.exportJSON();
    const repeated = await target.importJSON(exportText);
    assert(repeated.ok && repeated.saved && repeated.noOp && repeated.data.unchanged > 0);
    assert.strictEqual(target.exportJSON(), before);
    const bad = JSON.parse(exportText); bad.items[0].work_id = 'WRK-WRONG-20261006-001';
    const invalid = await makeStore(makeDb()).store.importJSON(bad);
    assert(!invalid.ok && invalid.code === 'INVALID_WORK_ID');
  });

  await T('import-conflict', 'same-ID/different-content import fails closed with no partial changes', async () => {
    const donorDb = makeDb(), donor = makeStore(donorDb).store;
    await createProject(donor, 'conflict-project', 'CF');
    const item = await createItem(donor, 'Donor version', { project_id: 'conflict-project' });
    const payload = JSON.parse(donor.exportJSON());
    const targetDb = makeDb(), target = makeStore(targetDb).store;
    const initial = await target.importJSON(payload);
    ok(initial);
    const before = target.exportJSON();
    const changed = JSON.parse(JSON.stringify(payload));
    changed.items.find(row => row.work_id === item.work_id).title = 'Different content';
    const outcome = await target.importJSON(changed);
    assert(!outcome.ok && outcome.saved === false && outcome.code === 'IMPORT_CONFLICT');
    assert.strictEqual(target.exportJSON(), before);
  });

  await T('export-validation', 'import rejects invalid/missing corrected fields and never silently overwrites', async () => {
    const db = makeDb(), { store } = makeStore(db);
    await createProject(store);
    const item = await createItem(store, 'Export item');
    const payload = JSON.parse(store.exportJSON());
    const badSource = JSON.parse(JSON.stringify(payload));
    badSource.sources.push({ source_id: 's', project_id: 'test-project', surface: 'WEB', role: 'REFERENCE', title: 'Bad source', locator: null, revision: null, note: null, created_at: NOW, updated_at: NOW });
    const rejected = await makeStore(makeDb()).store.importJSON(badSource);
    assert(!rejected.ok);
    const sourceWithoutProject = JSON.parse(JSON.stringify(payload));
    const validSource = { source_id: 'missing-project-source', project_id: 'test-project', surface: 'WEB', role: 'REFERENCE', title: 'Source ownership test', locator: 'fixture://source-ownership', revision: null, note: null, created_at: NOW, updated_at: NOW };
    sourceWithoutProject.sources.push(Object.assign({}, validSource));
    delete sourceWithoutProject.sources[0].project_id;
    const missingProject = await makeStore(makeDb()).store.importJSON(sourceWithoutProject);
    assert(!missingProject.ok && missingProject.code === 'INVALID_EXPORT');
    const sourceWithNullProject = JSON.parse(JSON.stringify(payload));
    sourceWithNullProject.sources.push(Object.assign({}, validSource, { source_id: 'null-project-source', project_id: null }));
    const nullProject = await makeStore(makeDb()).store.importJSON(sourceWithNullProject);
    assert(!nullProject.ok);
    const sourceWithUnknownProject = JSON.parse(JSON.stringify(payload));
    sourceWithUnknownProject.sources.push(Object.assign({}, validSource, { source_id: 'unknown-project-source', project_id: 'unknown-project' }));
    const unknownProject = await makeStore(makeDb()).store.importJSON(sourceWithUnknownProject);
    assert(!unknownProject.ok && unknownProject.code === 'INVALID_EXPORT');
    const missingActor = JSON.parse(JSON.stringify(payload));
    delete missingActor.changes[0].actor_class;
    const missing = await makeStore(makeDb()).store.importJSON(missingActor);
    assert(!missing.ok && missing.code === 'INVALID_EXPORT');
    const nullActor = JSON.parse(JSON.stringify(payload));
    nullActor.changes[0].actor_class = null;
    const actorLost = await makeStore(makeDb()).store.importJSON(nullActor);
    assert(!actorLost.ok && actorLost.code === 'INVALID_EXPORT');
    const missingChangeFields = JSON.parse(JSON.stringify(payload));
    missingChangeFields.changes[0].changed_fields_json = null;
    const fieldsLost = await makeStore(makeDb()).store.importJSON(missingChangeFields);
    assert(!fieldsLost.ok && fieldsLost.code === 'INVALID_EXPORT');
    const unsupported = JSON.parse(JSON.stringify(payload)); unsupported.format = 'eiti-working-memory-export/2';
    const version = await store.importJSON(unsupported);
    assert(!version.ok && version.code === 'INVALID_EXPORT');
    assert(store.getItem(item.work_id));
  });

  await T('durability', 'awaited byte persistence and independent SQLite reload preserve corrected rows and IDs', async () => {
    const db = makeDb(); let saved = null, acknowledgements = 0;
    const { store } = makeStore(db, async currentDb => {
      const written = byteCopy(currentDb.export()); saved = byteCopy(written); acknowledgements++;
      const readBack = byteCopy(saved);
      return { verified: bytesEqual(written, readBack), bytes: readBack.length, method: 'independent-test-readback' };
    });
    await createProject(store);
    const item = await createItem(store, 'Durable row', { tags: ['durable'], provenance_class: 'MODEL_PROPOSAL' });
    assert(saved && acknowledgements === 2);
    const reloaded = new SQL.Database(saved);
    const afterReload = WM.create(reloaded, { persist: async () => ({ verified: true }), now: () => NOW });
    assert.strictEqual(afterReload.getItem(item.work_id).title, 'Durable row');
    assert.strictEqual(afterReload.getItem(item.work_id).non_canon, 1);
    assert.strictEqual(afterReload.getItem(item.work_id).thread, '');
    assert.strictEqual(afterReload.getItem(item.work_id).provenance_class, 'MODEL_PROPOSAL');
  });

  await T('persistence-rollback', 'failed or unavailable persistence restores WM state and reports failure', async () => {
    const db = makeDb(); let calls = 0, failNext = false;
    const { store } = makeStore(db, async currentDb => {
      calls++; if (failNext && calls === 1) throw new Error('simulated IndexedDB failure');
      return { verified: true, bytes: currentDb.export().length };
    });
    await createProject(store);
    calls = 0; failNext = true;
    const failed = await store.createItem(itemData('Must roll back'));
    assert(!failed.ok && !failed.saved && failed.rolledBack && failed.rollbackDurable);
    assert.strictEqual(store.searchItems('Must roll back').length, 0);
    assert.strictEqual(calls, 2);
    const noPersistDb = makeDb(), noPersist = WM.create(noPersistDb, { now: () => NOW });
    const noProject = await noPersist.createProject(projectData());
    assert(!noProject.ok && noProject.code === 'PERSISTENCE_UNAVAILABLE');
    assert.strictEqual(count(noPersistDb, 'SELECT count(*) FROM wm_projects'), 0);
  });

  await T('persistence-uncertain', 'unverifiable rollback poisons future writes instead of claiming durability', async () => {
    const db = makeDb(), { store } = makeStore(db, async () => ({ verified: false }));
    const first = await store.createProject(projectData());
    assert(!first.ok && !first.saved && !first.rollbackDurable && first.persistenceState === 'UNKNOWN');
    const second = await store.createProject(projectData('second','SEC'));
    assert(!second.ok && second.code === 'PERSISTENCE_UNCERTAIN');
  });

  await T('single-tab', 'same-instance concurrent writes serialize and MULTI_TAB_WRITES stays unsupported', async () => {
    const db = makeDb(); let saves = 0; const { store } = makeStore(db, async currentDb => { await Promise.resolve(); saves++; return { verified: currentDb.export().length > 0 }; });
    await createProject(store);
    saves = 0;
    const results = await Promise.all([store.createItem(itemData('Parallel A')), store.createItem(itemData('Parallel B'))]);
    assert(results.every(entry => entry.ok && entry.saved));
    assert.strictEqual(saves, 2);
    assert.deepStrictEqual(results.map(entry => entry.data.work_id), ['WRK-EITI-20261006-001','WRK-EITI-20261006-002']);
    assert.strictEqual(WM.MULTI_TAB_WRITES, 'NOT_SUPPORTED_IN_V0_1');
  });

  await T('schema-startup', 'application SQLite startup initializes WM without altering legacy save path or forbidden namespaces', async () => {
    const a = INDEX.indexOf('async function wizInitSQLite()');
    const b = INDEX.indexOf('// ── Инициализация при старте', a);
    assert(a >= 0 && b > a);
    assert(INDEX.includes('<script src="working-memory.js"></script>'));
    const db = makeDb();
    const ctx = { console, Date, Math, JSON, Uint8Array, Promise, Object, Array, Set, Number, String, Error, TextEncoder, crypto: globalThis.crypto };
    ctx.window = ctx; ctx.globalThis = ctx; ctx._wizDB = db; ctx.initSqlJs = async () => SQL;
    ctx._wizIDBGet = async () => null; ctx._wizIDBSet = () => {};
    ctx._wizSaveDBAsync = async () => ({ verified: true });
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'working-memory.js'), 'utf8'), ctx, { filename: 'working-memory.js' });
    vm.runInContext(INDEX.slice(a, b), ctx, { filename: 'index.html#sqlite-startup' });
    ctx._wizInitMemSchema();
    assert(ctx.WmStore);
    for (const table of ['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes','wm_items_fts']) assert.strictEqual(count(db, 'SELECT count(*) FROM sqlite_master WHERE name=?', [table]), 1, table);
    assert.strictEqual(count(db, "SELECT count(*) FROM sqlite_master WHERE name LIKE 'wiz_ref_%'"), 0);
    const source = fs.readFileSync(path.join(ROOT, 'working-memory.js'), 'utf8');
    assert(!/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\s+(?:TABLE\s+)?(?:wiz_facts|wiz_ledger|ledger|wiz_ref_)/i.test(source));
    assert(!/case\s+['"]wm_[a-z_]+['"]\s*:/i.test(INDEX), 'WM agent tool was added');
    assert(!/<button\b[^>]*(?:working[- ]memory|wm_)/i.test(INDEX), 'WM UI was added');
    assert(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("BASE_PATH + '/working-memory.js'"));
  });

  console.log(`\n${results.filter(row => row[1] === 'PASS').length}/${results.length} tests passed.`);
  if (results.some(row => row[1] !== 'PASS')) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

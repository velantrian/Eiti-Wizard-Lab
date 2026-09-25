// DB-level acceptance tests for the wiz_ref_* reference namespace.
// Runs the REAL shipped code: wiz-ref-memory.js + the SQLite memory block
// extracted verbatim from index.html (wizInitSQLite … wizDecayTick), on the
// repo's own sql-wasm build. Usage: node tests/refmem/db.test.cjs
// Fixtures are SYNTHETIC (tests/refmem/fixtures) — no private data.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..', '..');
const FX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const initSqlJs = require(path.join(ROOT, 'sql-wasm.js'));
const WASM = fs.readFileSync(path.join(ROOT, 'sql-wasm.wasm'));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const REFJS = fs.readFileSync(path.join(ROOT, 'wiz-ref-memory.js'), 'utf8');

const results = [];
async function T(id, name, fn) {
  try { await fn(); results.push([id, 'PASS', name]); console.log(`PASS  [${id}] ${name}`); }
  catch (e) { results.push([id, 'FAIL', name, e.message]); console.log(`FAIL  [${id}] ${name}\n      ${e.stack.split('\n').slice(0, 3).join('\n      ')}`); }
}

function memBlock() {
  const a = INDEX.indexOf('async function wizInitSQLite()');
  const b = INDEX.indexOf('// ── Инициализация при старте');
  assert(a > 0 && b > a, 'memory block not found in index.html');
  return INDEX.slice(a, b);
}
function fnBody(name) {
  const a = INDEX.indexOf('function ' + name + '(');
  const b = INDEX.indexOf('\n}\n', a);
  return INDEX.slice(a, b + 2);
}
function caseBody(tool) {
  const a = INDEX.indexOf(`case '${tool}':`);
  assert(a > 0, 'case not found ' + tool);
  const b = INDEX.indexOf("\n      case '", a + 10);
  return INDEX.slice(a, b);
}

// Boot an app-like context: window === global, real memory block + real ref module.
async function bootApp(savedBytes) {
  const SQL = await initSqlJs({ wasmBinary: WASM });
  const idb = { saved: savedBytes || null };
  const ctx = { console: { log() {}, warn: console.warn, error: console.error }, Date, Math, JSON, Uint8Array, Promise, Object, Array, Set, Number, String, Error, TextEncoder, crypto: globalThis.crypto };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.initSqlJs = async () => SQL;
  ctx.indexedDB = {}; // not used: _wizIDBGet/_wizIDBSet are overridden below
  vm.createContext(ctx);
  vm.runInContext(REFJS, ctx, { filename: 'wiz-ref-memory.js' });
  vm.runInContext(memBlock(), ctx, { filename: 'index.html#memblock' });
  // replace the IndexedDB helpers with an in-memory KV (same call sites, same bytes)
  ctx._wizIDBGet = async k => (k === 'wiz_lab_sqlite_db' ? idb.saved : null);
  ctx._wizIDBSet = (k, v) => { if (k === 'wiz_lab_sqlite_db') idb.saved = new Uint8Array(v).slice(); };
  vm.runInContext(`_wizIDBGet = window._wizIDBGet; _wizIDBSet = window._wizIDBSet;`, ctx);
  await ctx.wizInitSQLite();
  return { ctx, db: ctx._wizDB, idb, SQL };
}
const q1 = (db, sql, p) => { const r = db.exec(sql, p || []); return r.length ? r[0].values[0][0] : null; };
const dump = (db, t) => JSON.stringify(db.exec(`SELECT * FROM ${t} ORDER BY 1`));
const MAIN_WIZ_FACTS_COLS = ['id', 'claim', 'tag', 'source', 'confidence', 'stability', 'memory_layer', 'epistemic_state', 'created_at', 'last_accessed', 'access_count'];

(async () => {
  const W = require(path.join(ROOT, 'wiz-ref-memory.js'));
  const v1 = FX('synthetic.v1.fixture.jsonl'), v2 = FX('synthetic.v2.fixture.jsonl');

  await T('mig', 'schema init creates wiz_ref_* + schema_version, is idempotent, and migrates an existing main-era DB without touching wiz_facts', async () => {
    const SQL = await initSqlJs({ wasmBinary: WASM });
    // simulate an existing user DB created by current main (only main's DDL)
    const old = new SQL.Database();
    old.run(`CREATE TABLE wiz_facts (id TEXT PRIMARY KEY, claim TEXT NOT NULL, tag TEXT DEFAULT 'general', source TEXT DEFAULT 'user', confidence REAL DEFAULT 0.8, stability REAL DEFAULT 1.0, memory_layer TEXT DEFAULT 'L1', epistemic_state TEXT DEFAULT 'Observed', created_at INTEGER, last_accessed INTEGER, access_count INTEGER DEFAULT 0)`);
    old.run(`CREATE VIRTUAL TABLE wiz_facts_fts USING fts5(id UNINDEXED, claim, tag, tokenize='unicode61')`);
    old.run(`INSERT INTO wiz_facts(id,claim,created_at,last_accessed) VALUES('f_old','I like tea',1,1)`);
    // and a partial, older wiz_ref_items table missing new columns
    old.run(`CREATE TABLE wiz_ref_items (item_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, item_type TEXT NOT NULL, claim TEXT NOT NULL)`);
    const factsBefore = dump(old, 'wiz_facts');
    const app = await bootApp(old.export());
    assert.strictEqual(dump(app.db, 'wiz_facts'), factsBefore, 'wiz_facts rows changed');
    const cols = app.db.exec('PRAGMA table_info(wiz_facts)')[0].values.map(v => v[1]);
    assert.deepStrictEqual(cols, MAIN_WIZ_FACTS_COLS, 'wiz_facts schema altered');
    for (const t of ['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations', 'wiz_ref_meta', 'wiz_ref_items_fts'])
      assert(q1(app.db, "SELECT count(*) FROM sqlite_master WHERE name=?", [t]) === 1, t + ' missing');
    const icols = app.db.exec('PRAGMA table_info(wiz_ref_items)')[0].values.map(v => v[1]);
    for (const c of ['lifecycle', 'record_hash', 'epistemic_state', 'provenance']) assert(icols.includes(c), 'migrated column missing ' + c);
    assert.strictEqual(W.getMeta(app.db, 'schema_version'), '1');
    const snap = app.db.exec("SELECT sql FROM sqlite_master ORDER BY name")[0].values.join('|');
    W.initSchema(app.db); W.initSchema(app.db); app.ctx._wizInitMemSchema();
    assert.strictEqual(app.db.exec("SELECT sql FROM sqlite_master ORDER BY name")[0].values.join('|'), snap, 'second init changed schema');
  });

  await T(1, 'app memory boot path (wizInitSQLite → _wizInitMemSchema → decay boot) runs unchanged with the ref module loaded [DB-level; full page boot in browser suite]', async () => {
    const app = await bootApp();
    assert(app.db, 'no DB');
    app.ctx.wizDecayTick();
    for (const t of ['wiz_facts', 'wiz_facts_fts', 'wiz_l2_digests', 'wiz_notes_fts']) assert(q1(app.db, "SELECT count(*) FROM sqlite_master WHERE name=?", [t]) === 1, t);
  });

  await T(2, 'wiz_facts works: wizMemAdd/List/Search/Delete/SetState/Access; schema identical to main', async () => {
    const { ctx, db } = await bootApp();
    const a = ctx.wizMemAdd('Я люблю зелёный чай', 'preference');
    assert(a && a.id.startsWith('f_'));
    ctx.wizMemAdd('My project is Eiti Wizard', 'project');
    assert.strictEqual(ctx.wizMemList().length, 2);
    assert.strictEqual(ctx.wizMemList('project').length, 1);
    assert.strictEqual(ctx.wizMemSearch('чай').length, 1);
    ctx.wizMemAccess(a.id);
    assert.strictEqual(q1(db, 'SELECT access_count FROM wiz_facts WHERE id=?', [a.id]), 1);
    assert(ctx.wizMemSetState('Eiti', 'Validated'));
    assert.strictEqual(q1(db, "SELECT epistemic_state FROM wiz_facts WHERE tag='project'"), 'Validated');
    assert.strictEqual(ctx.wizMemDelete('чай'), 1);
    assert.strictEqual(ctx.wizMemList().length, 1);
    assert.deepStrictEqual(db.exec('PRAGMA table_info(wiz_facts)')[0].values.map(v => v[1]), MAIN_WIZ_FACTS_COLS);
  });

  await T(4, 'mem_validate path (wizMemSetState) works on wiz_facts and has no code path to wiz_ref_* (static + runtime)', async () => {
    const mv = caseBody('mem_validate');
    assert(/wizMemSetState\(/.test(mv) && !/wiz_ref|WizRef|wizRef/.test(mv), 'mem_validate case references ref layer');
    const ss = fnBody('wizMemSetState');
    assert(!/wiz_ref|WizRef|wizRef/.test(ss) && /UPDATE wiz_facts/.test(ss), 'wizMemSetState touches something other than wiz_facts');
    for (const f of ['wizMemAdd', 'wizMemList', 'wizMemSearch', 'wizMemDelete', 'wizMemAccess', 'wizConsolidateL2'])
      assert(!/wiz_ref|WizRef|wizRef/.test(fnBody(f)), f + ' references ref layer');
    for (const t of ['mem_add', 'mem_list', 'mem_delete', 'mem_search']) assert(!/wiz_ref|WizRef|wizRef/.test(caseBody(t)), t);
    const { ctx, db } = await bootApp();
    await W.importJSONL(db, v1);
    const before = dump(db, 'wiz_ref_items');
    // mem_validate with text that matches a reference claim must not find/alter it
    const m = ctx.wizMemSetState('ATLAS ≠ TRUTH OWNER', 'Validated');
    assert.strictEqual(m, null, 'mem_validate matched a reference item');
    ctx.wizMemAdd('Atlas is my favourite book', 'interest');
    assert(ctx.wizMemSetState('Atlas', 'Validated'));
    assert.strictEqual(dump(db, 'wiz_ref_items'), before, 'wiz_ref_items altered by mem_validate');
    assert(!/Validated/.test(before));
  });

  await T(5, 'reference import does NOT write to wiz_facts / wiz_facts_fts / wiz_l2_digests', async () => {
    const { ctx, db } = await bootApp();
    ctx.wizMemAdd('personal fact one', 'general');
    const snap = ['wiz_facts', 'wiz_facts_fts', 'wiz_l2_digests'].map(t => dump(db, t)).join('|');
    const r = await W.importJSONL(db, v1);
    assert(r.committed && r.items_inserted === 14, JSON.stringify(r));
    assert.strictEqual(['wiz_facts', 'wiz_facts_fts', 'wiz_l2_digests'].map(t => dump(db, t)).join('|'), snap);
  });

  await T(6, 'reference survives reload via the existing SQLite→IndexedDB save path (_wizSaveDB bytes → new wizInitSQLite) [DB-level; real IndexedDB in browser suite]', async () => {
    const a = await bootApp();
    await a.ctx.WizRef.importJSONL(a.db, v1);
    a.ctx._wizSaveDB();
    const b = await bootApp(a.idb.saved);
    assert.strictEqual(q1(b.db, 'SELECT count(*) FROM wiz_ref_items'), 14);
    assert.strictEqual(W.getMeta(b.db, 'seed_version'), 'fx-1');
  });

  await T(7, 'import same bundle twice = zero duplicates (rows, FTS rows, relations), second run all unchanged', async () => {
    const { db } = await bootApp();
    const r1 = await W.importJSONL(db, v1);
    const snap = ['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations'].map(t => dump(db, t)).join('|');
    const r2 = await W.importJSONL(db, v1);
    assert.strictEqual(r2.items_inserted, 0); assert.strictEqual(r2.items_unchanged, r1.items_inserted);
    assert.strictEqual(r2.sources_inserted, 0); assert.strictEqual(r2.relations_inserted, 0);
    assert.strictEqual(r2.already_imported, true);
    assert.strictEqual(['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations'].map(t => dump(db, t)).join('|'), snap);
    assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_ref_items_fts'), q1(db, 'SELECT count(*) FROM wiz_ref_items'));
    assert.strictEqual(q1(db, 'SELECT count(*) - count(DISTINCT claim) FROM wiz_ref_items'), 0);
    assert(/^sha256:[0-9a-f]{64}$/.test(W.getMeta(db, 'seed_hash')));
    assert.strictEqual(W.getMeta(db, 'seed_as_of'), '2026-09-25');
  });

  await T('7b', 'new seed revision: revised item keeps old version (SUPERSEDED lineage), omitted item not deleted, statuses verbatim', async () => {
    const { db } = await bootApp();
    await W.importJSONL(db, v1);
    const r = await W.importJSONL(db, v2);
    assert.strictEqual(r.items_revised, 1); assert.strictEqual(r.items_inserted, 1); assert.strictEqual(r.not_in_this_seed, 1);
    assert.strictEqual(q1(db, "SELECT count(*) FROM wiz_ref_items WHERE item_id='fx:to-drop'"), 1, 'omitted item deleted');
    const arch = db.exec("SELECT item_id, lifecycle, superseded_by, claim FROM wiz_ref_items WHERE item_id LIKE 'fx:atlas-route@%'")[0].values;
    assert.strictEqual(arch.length, 1); assert.strictEqual(arch[0][1], 'SUPERSEDED'); assert.strictEqual(arch[0][2], 'fx:atlas-route');
    assert(/^Fixture route: memory/.test(arch[0][3]));
    const t = W.trace(db, 'fx:atlas-route');
    assert.strictEqual(t.lineage.older.length, 1);
    const r3 = await W.importJSONL(db, v2); // idempotent on the revision too
    assert.strictEqual(r3.items_inserted + r3.items_revised, 0);
    // explicit supersedes_item_id: hyp-1 kept, marked SUPERSEDED
    const h1 = db.exec("SELECT lifecycle, superseded_by, source_status, epistemic_state FROM wiz_ref_items WHERE item_id='fx:hyp-1'")[0].values[0];
    assert.deepStrictEqual(h1, ['SUPERSEDED', 'fx:hyp-2', 'OPEN', 'CANDIDATE']);
  });

  await T('imp', 'importer never qualifies: statuses verbatim, default SOURCE_ASSERTION, VERIFIED only kept verbatim with warning; invalid/HUMAN_LENS-violating/template records rejected', async () => {
    const { db } = await bootApp();
    const r = await W.importJSONL(db, v1);
    assert(r.warnings.some(w => /VERBATIM/.test(w.msg)));
    const rows = db.exec('SELECT item_id, source_status, epistemic_state FROM wiz_ref_items')[0].values;
    const src = v1.trim().split('\n').slice(1).map(JSON.parse).filter(o => o.item);
    for (const o of src) {
      const row = rows.find(x => x[0] === o.item.item_id);
      assert.strictEqual(row[1], o.item.source_status); assert.strictEqual(row[2], o.item.epistemic_state);
    }
    const bad = await W.importJSONL(db, FX('invalid.fixture.jsonl'));
    assert.strictEqual(bad.errors.length, 3); assert.strictEqual(q1(db, "SELECT count(*) FROM wiz_ref_items WHERE item_id LIKE 'fx:bad%'"), 0);
    const tpl = await W.importJSONL(db, fs.readFileSync(path.join(ROOT, 'reference-memory', 'velantrim_reference.private.template.jsonl'), 'utf8'));
    assert(tpl.errors.length >= 1 && tpl.items_inserted === 0, 'template placeholders must not import');
    const d = await W.importJSONL(db, '{"source":{"source_id":"s","title":"t","surface":"fixture","source_kind":"RESEARCH"},"item":{"item_id":"i","source_id":"s","item_type":"HYPOTHESIS","claim":"c"}}');
    assert.strictEqual(q1(db, "SELECT epistemic_state FROM wiz_ref_items WHERE item_id='i'"), 'SOURCE_ASSERTION');
    assert.strictEqual(q1(db, "SELECT privacy FROM wiz_ref_sources WHERE source_id='s'"), 'private');
  });

  await T('demo', 'public demo seed imports cleanly; every item is demo-labelled or GitHub-observed with repo@commit provenance', async () => {
    const { db } = await bootApp();
    const r = await W.importJSONL(db, fs.readFileSync(path.join(ROOT, 'reference-memory', 'eiti_reference.demo.public.jsonl'), 'utf8'));
    assert(r.ok && r.items_inserted === 10, JSON.stringify(r.errors));
    for (const b of W.search(db, '', { limit: 100, include_superseded: true })) {
      if (b.source_surface === 'github') assert(/^velantrian\/Eiti-Wizard-Lab@[0-9a-f]{7}/.test(b.provenance) && b.epistemic_state === 'OBSERVATION');
      else { assert.strictEqual(b.source_surface, 'demo'); assert.strictEqual(b.epistemic_state, 'DEMO_EXAMPLE'); assert(/DEMO\/EXAMPLE DATA/.test(b.block)); }
      assert.strictEqual(b.source_privacy, 'public');
    }
  });

  const REQUIRED = ['claim', 'project_id', 'item_type', 'epistemic_state', 'authority_class', 'source_kind', 'source_title', 'as_of', 'source_revision', 'source_id'];
  await T(8, 'FTS "UNKNOWN FALSE" returns the invariant with full provenance', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const r = W.search(db, 'UNKNOWN FALSE');
    assert(r.length >= 1 && r[0].item_id === 'fx:unknown-false', JSON.stringify(r.map(x => x.item_id)));
    for (const k of REQUIRED) assert(r[0][k] != null, 'missing ' + k);
    assert(/\[REFERENCE MEMORY\]/.test(r[0].block) && /source: /.test(r[0].block) && /as_of: 2026-09-25/.test(r[0].block));
    assert.strictEqual(r[0].item_type, 'INVARIANT'); assert.strictEqual(r[0].is_verified_truth, false);
    const txt = W.formatBlocks(r);
    for (const s of ['INVARIANT', 'SOURCE_ASSERTION', 'fx:src:guards', 'ARCHITECTURE_STATUS', 'as_of']) assert(txt.includes(s), s);
  });

  await T(9, '"Atlas truth" surfaces ATLAS ≠ TRUTH OWNER with NAVIGATION_ONLY', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const r = W.search(db, 'Atlas truth');
    assert(r.length && r[0].item_id === 'fx:atlas-not-truth');
    assert.strictEqual(r[0].authority_class, 'NAVIGATION_ONLY');
    assert(/ATLAS ≠ TRUTH OWNER/.test(r[0].claim) && /ROUTE ONLY/.test(r[0].block));
  });

  await T(10, '"synergy" returns HUMAN_LENS / HUMAN_REFERENCE_ONLY, never SYSTEM_PRIMITIVE', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const r = W.search(db, 'synergy');
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].authority_class, 'HUMAN_REFERENCE_ONLY'); assert.strictEqual(r[0].item_type, 'HUMAN_LENS');
    assert.strictEqual(r[0].is_system_primitive, false);
    assert(/HUMAN LENS ≠ SYSTEM PRIMITIVE/.test(r[0].block));
    assert(!/SYSTEM_PRIMITIVE/.test(JSON.stringify(db.exec('SELECT * FROM wiz_ref_items'))));
  });

  await T(11, 'synthetic historical-chronicle material keeps HISTORICAL status (through import, re-import, export round-trip)', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1); await W.importJSONL(db, v1);
    const chk = (d) => {
      const r = W.search(d, 'chronicle historical'); // synthetic historical fixture
      assert(r.length >= 1, 'no hit');
      for (const x of r) {
        assert.strictEqual(x.source_currentness, 'HISTORICAL'); assert.strictEqual(x.authority_class, 'HISTORICAL_ONLY');
        assert.strictEqual(x.source_status, 'HISTORICAL'); assert(/HISTORICAL NOTE ≠ CURRENT PROJECT TRUTH/.test(x.block));
      }
    };
    chk(db);
    const b = await bootApp(); await W.importJSONL(b.db, W.exportJSONL(db)); chk(b.db);
  });

  await T(12, 'Notion architecture claim is never returned as GitHub implementation evidence', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const all = W.search(db, 'implemented', { limit: 50 });
    const n = all.filter(x => x.source_surface === 'notion');
    assert(n.length === 2);
    for (const x of n) { assert.strictEqual(x.is_implementation_evidence, false); assert(/NOT IMPLEMENTATION EVIDENCE/.test(x.block)); }
    const ev = W.search(db, 'implemented', { implementation_evidence_only: true, limit: 50 });
    assert(ev.every(x => x.source_surface === 'github' && x.authority_class === 'IMPLEMENTATION_EVIDENCE'));
    assert(!ev.some(x => x.source_surface === 'notion'));
    const impl = W.search(db, '', { item_type: 'IMPLEMENTATION_FACT', implementation_evidence_only: true, limit: 50 });
    assert.deepStrictEqual(impl.map(x => x.item_id).sort(), ['fx:main-file', 'fx:pr-draft']);
  });

  await T(13, 'draft-branch info never becomes a main-state fact (cached, draft-flagged, status verbatim)', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const r = W.search(db, 'PR 202 DRAFT');
    const d = r.find(x => x.item_id === 'fx:pr-draft');
    assert(d, 'draft item not found');
    assert.strictEqual(d.is_main_state, false); assert.strictEqual(d.is_live_state, false); assert.strictEqual(d.is_draft_or_branch, true);
    assert.strictEqual(d.source_status, 'OPEN · DRAFT');
    assert(/DRAFT\/BRANCH STATE — not a main-branch fact/.test(d.block) && /CACHED STATE as-of 2026-09-25/.test(d.block));
    const m = W.search(db, 'relation.py')[0];
    assert.strictEqual(m.is_main_state, false); assert(/CACHED STATE as-of/.test(m.block), 'even main facts are cached-as-of');
  });

  await T(15, 'wizDecayTick() never touches wiz_ref_* (static inspection + runtime with forced deprecation)', async () => {
    assert(!/wiz_ref|WizRef|wizRef/.test(fnBody('wizDecayTick')), 'wizDecayTick references ref layer');
    assert(!/wiz_ref|WizRef|wizRef/.test(fnBody('wizMemList')));
    const { ctx, db } = await bootApp(); await W.importJSONL(db, v1);
    const f = ctx.wizMemAdd('ancient personal fact', 'general');
    db.run('UPDATE wiz_facts SET last_accessed=?, stability=0.1 WHERE id=?', [Date.now() - 1000 * 86400000, f.id]);
    db.run("UPDATE wiz_ref_items SET created_at=? ", [Date.now() - 1000 * 86400000]);
    const snap = ['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations', 'wiz_ref_meta', 'wiz_ref_items_fts'].map(t => dump(db, t)).join('|');
    for (let i = 0; i < 5; i++) ctx.wizDecayTick();
    ctx.wizConsolidateL2();
    assert.strictEqual(q1(db, 'SELECT epistemic_state FROM wiz_facts WHERE id=?', [f.id]), 'Deprecated', 'decay did not run');
    assert.strictEqual(['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations', 'wiz_ref_meta', 'wiz_ref_items_fts'].map(t => dump(db, t)).join('|'), snap);
  });

  await T(16, 'ref_search and mem_search return separate datasets', async () => {
    const { ctx, db } = await bootApp(); await W.importJSONL(db, v1);
    ctx.wizMemAdd('synergy between my hobbies', 'interest');
    const mem = ctx.wizMemSearch('synergy'); const ref = W.search(db, 'synergy');
    assert.strictEqual(mem.length, 1); assert(mem[0].id.startsWith('f_') && !('item_id' in mem[0]));
    assert.strictEqual(ref.length, 1); assert.strictEqual(ref[0].item_id, 'fx:lens-synergy'); assert.strictEqual(ref[0].namespace, 'reference');
    assert(!ref.some(x => /hobbies/.test(x.claim)) && !mem.some(x => /Lens/.test(x.claim)));
    // tool wiring: ref_* cases use WizRef only; mem_search case uses wizMemSearch only
    const rc = caseBody('ref_search'); assert(/W\.search\(/.test(rc) && !/wizMem/.test(rc));
    assert(/wizMemSearch\(/.test(caseBody('mem_search')));
  });

  await T(17, 'private bundle file deletable after import; SQLite copy persists across reload', async () => {
    const tmp = path.join(os.tmpdir(), 'refmem-test-' + process.pid + '.private.jsonl');
    fs.writeFileSync(tmp, v1);
    const a = await bootApp();
    await a.ctx.wizRefImportJSONL(fs.readFileSync(tmp, 'utf8')); // browser glue path → _wizSaveDB
    fs.unlinkSync(tmp); assert(!fs.existsSync(tmp));
    const b = await bootApp(a.idb.saved);
    assert.strictEqual(q1(b.db, 'SELECT count(*) FROM wiz_ref_items'), 14);
    assert.strictEqual(W.search(b.db, 'UNKNOWN FALSE')[0].item_id, 'fx:unknown-false');
  });

  await T(18, 'backup: reference JSONL export → import round-trip and full SQLite export are lossless; no status promotion', async () => {
    const a = await bootApp(); await W.importJSONL(a.db, v1); await W.importJSONL(a.db, v2);
    const cols = 'item_id,source_id,project_id,item_type,claim,source_section,source_status,epistemic_state,authority_scope,validity,confidence,as_of,supersedes_item_id,created_at,provenance,lifecycle,superseded_by,record_hash,seed_id,first_seed_version,last_seed_version';
    const items = d => JSON.stringify(d.exec(`SELECT ${cols} FROM wiz_ref_items ORDER BY item_id`));
    const srcs = d => JSON.stringify(d.exec('SELECT source_id,title,surface,source_kind,authority_class,project_id,locator,revision,as_of,currentness,privacy,content_hash,seed_id,first_seed_version,last_seed_version,record_hash FROM wiz_ref_sources ORDER BY 1'));
    const rels = d => JSON.stringify(d.exec('SELECT relation_id,from_item_id,to_item_id,relation_type,epistemic_status,source_id,scope,rationale,seed_id,created_at FROM wiz_ref_relations ORDER BY 1'));
    const exp = W.exportJSONL(a.db);
    const b = await bootApp(); const r = await W.importJSONL(b.db, exp);
    assert(r.ok, JSON.stringify(r.errors));
    assert.strictEqual(items(b.db), items(a.db)); assert.strictEqual(srcs(b.db), srcs(a.db)); assert.strictEqual(rels(b.db), rels(a.db));
    assert.strictEqual(W.getMeta(b.db, 'seed_version'), 'fx-2');
    // re-importing the backup into the original DB changes nothing
    const before = items(a.db); await W.importJSONL(a.db, exp); assert.strictEqual(items(a.db), before);
    // promotion attempt: record says ACTIVE for a SUPERSEDED item → stays SUPERSEDED
    const hyp1 = exp.split('\n').find(l => l.includes('"item_id":"fx:hyp-1"'));
    const o = JSON.parse(hyp1); o.item.lifecycle = 'ACTIVE'; delete o.item.superseded_by; o.item.claim += ' (tampered)';
    await W.importJSONL(a.db, JSON.stringify(o));
    assert.strictEqual(q1(a.db, "SELECT lifecycle FROM wiz_ref_items WHERE item_id='fx:hyp-1'"), 'SUPERSEDED');
    assert(!/Validated|QUALIFIED_CLAIM/.test(items(b.db)));
    // full SQLite export (db.export) round-trip
    const c = new b.SQL.Database(a.db.export());
    assert.strictEqual(items(c), items(a.db));
  });

  await T('tools', 'ref_* tools registered alongside (not replacing) mem_*; ref_* cases are read-only; no auto context injection', async () => {
    const spec = INDEX.slice(INDEX.indexOf('const AGENT_TOOLS_SPEC'), INDEX.indexOf('// Инструменты companion'));
    for (const t of ['mem_add', 'mem_list', 'mem_delete', 'mem_search', 'mem_validate', 'ref_search', 'ref_source', 'ref_project', 'ref_trace'])
      assert(spec.includes(`name:'${t}'`), t);
    const rc = caseBody('ref_search');
    assert(!/importJSONL|clearAll|INSERT|UPDATE|DELETE|_wizSaveDB/.test(rc), 'ref tools must be read-only');
    // the only non-definition uses of wizRef/WizRef in index.html: script tag, schema hook, tool specs/cases, UI card, panel render hook
    const lines = INDEX.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /WizRef|wizRef/.test(l));
    const bad = lines.filter(([, l]) => /system(Prompt|_prompt)|buildContext|messages\.(push|unshift)|injectMemory|contextBlock/i.test(l));
    assert.strictEqual(bad.length, 0, 'possible context injection: ' + JSON.stringify(bad));
    assert(!/formatBlocks|wizRefSearch|W\.search/.test(INDEX.replace(rc, '')), 'ref retrieval used outside ref tools');
  });

  const fail = results.filter(r => r[1] !== 'PASS');
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  fs.writeFileSync(path.join(os.tmpdir(), 'refmem-db-results.json'), JSON.stringify(results, null, 1));
  process.exit(fail.length ? 1 : 0);
})();

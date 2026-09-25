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
  // awaitable save: in-memory stand-in (the real IndexedDB version is exercised by the browser suite)
  ctx._wizSaveDBAsync = async () => { idb.saved = ctx._wizDB.export().slice(); return { bytes: idb.saved.byteLength, verified: true }; };
  vm.runInContext(`_wizIDBGet = window._wizIDBGet; _wizIDBSet = window._wizIDBSet; _wizSaveDBAsync = window._wizSaveDBAsync;`, ctx);
  await ctx.wizInitSQLite();
  return { ctx, db: ctx._wizDB, idb, SQL };
}
const q1 = (db, sql, p) => { const r = db.exec(sql, p || []); return r.length ? r[0].values[0][0] : null; };
const dump = (db, t) => JSON.stringify(db.exec(`SELECT * FROM ${t} ORDER BY 1`));
const MAIN_WIZ_FACTS_COLS = ['id', 'claim', 'tag', 'source', 'confidence', 'stability', 'memory_layer', 'epistemic_state', 'created_at', 'last_accessed', 'access_count'];

(async () => {
  const W0 = require(path.join(ROOT, 'wiz-ref-memory.js'));
  // every import in this suite also asserts the P1-1 invariant: errors ⇒ not committed
  const W = Object.assign({}, W0, { importJSONL: async (...a) => {
    const r = await W0.importJSONL(...a);
    assert(!(r.errors.length > 0 && r.committed), 'INVARIANT VIOLATED: errors but committed');
    assert.strictEqual(r.ok, r.committed && r.errors.length === 0);
    return r;
  } });
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
    assert.strictEqual(W.getMeta(app.db, 'schema_version'), '3');
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
    assert(/\[REFERENCE MEMORY\]/.test(r[0].block) && /source \(at capture\): /.test(r[0].block) && /as_of: 2026-09-25/.test(r[0].block));
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
    const cols = 'item_id,source_id,project_id,item_type,claim,source_section,source_status,epistemic_state,authority_scope,validity,confidence,as_of,supersedes_item_id,created_at,provenance,lifecycle,superseded_by,record_hash,seed_id,first_seed_version,last_seed_version,' +
      'source_title_at_capture,source_surface_at_capture,source_kind_at_capture,source_authority_class_at_capture,source_revision_at_capture,source_as_of_at_capture,source_currentness_at_capture,source_content_hash_at_capture,capture_backfilled,logical_item_id,version_id';
    const items = d => JSON.stringify(d.exec(`SELECT ${cols} FROM wiz_ref_items ORDER BY item_id`));
    const srcs = d => JSON.stringify(d.exec('SELECT source_id,title,surface,source_kind,authority_class,project_id,locator,revision,as_of,currentness,privacy,content_hash,seed_id,first_seed_version,last_seed_version,record_hash FROM wiz_ref_sources ORDER BY 1'));
    const rels = d => JSON.stringify(d.exec('SELECT relation_id,from_item_id,to_item_id,relation_type,epistemic_status,source_id,scope,rationale,seed_id,created_at,record_hash,from_version_id,to_version_id,pin_backfilled FROM wiz_ref_relations ORDER BY 1'));
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


  // ── Audit revision 1 ───────────────────────────────────────────────────────
  const REF_TABLES = ['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations', 'wiz_ref_meta', 'wiz_ref_items_fts', 'wiz_facts', 'wiz_facts_fts', 'wiz_l2_digests'];
  const fullSnap = db => REF_TABLES.map(t => `${t}:${q1(db, `SELECT count(*) FROM ${t}`)}:${require('crypto').createHash('sha256').update(dump(db, t)).digest('hex')}`).join('|');
  const S = (id, rev, extra = {}) => Object.assign({ source_id: id, title: '[SYNTHETIC FIXTURE] revisable source', surface: 'fixture', source_kind: 'RESEARCH',
    authority_class: 'RESEARCH_SYNTHESIS', project_id: 'demo-project-rev', revision: rev, as_of: rev === 'A' ? '2026-09-01' : '2026-09-20',
    currentness: 'CURRENT', privacy: 'public', content_hash: 'fx-hash-' + rev }, extra);
  const line = o => JSON.stringify(o);

  await T('P1-1a', 'import with one valid + one invalid record commits NOTHING (zero delta on all wiz_ref_* + meta + wiz_facts), committed=false', async () => {
    const { ctx, db } = await bootApp();
    ctx.wizMemAdd('personal fact stays', 'general');
    await W.importJSONL(db, v1);
    const before = fullSnap(db);
    const bundle = [
      line({ manifest: { format: 'wiz-ref-jsonl/1', seed_id: 'fx-partial', seed_version: 'p1' } }),
      line({ source: S('fx:src:partial', 'A'), item: { item_id: 'fx:partial-valid', source_id: 'fx:src:partial', item_type: 'HYPOTHESIS', claim: 'valid synthetic record' } }),
      line({ source: S('fx:src:partial', 'A'), item: { item_id: 'fx:partial-bad', source_id: 'fx:src:partial', item_type: 'NOT_A_TYPE', claim: 'invalid synthetic record' } }),
    ].join('\n');
    const r = await W.importJSONL(db, bundle);
    assert(r.errors.length === 1 && r.committed === false && r.ok === false, JSON.stringify(r));
    assert.strictEqual(fullSnap(db), before, 'DB changed although import had errors');
    assert.strictEqual(W.getMeta(db, 'seed.fx-partial'), null);
    const r2 = await W.importJSONL(db, bundle.split('\n').slice(0, 2).join('\n') + '\n{not json');
    assert(r2.committed === false && fullSnap(db) === before, 'invalid JSON line must also block the whole import');
  });

  await T('P1-1b', 'import with errors into an EMPTY database leaves it empty (no sources, items, relations, meta seed keys)', async () => {
    const { db } = await bootApp();
    const before = fullSnap(db);
    const r = await W.importJSONL(db, v1 + '\n' + FX('invalid.fixture.jsonl'));
    assert(r.errors.length === 3 && !r.committed);
    assert.strictEqual(fullSnap(db), before);
  });

  await T('P1-2a', 'source revision does not rewrite older item provenance: old item (search + trace) still shows capture rev A; new item shows rev B', async () => {
    const { db } = await bootApp();
    await W.importJSONL(db, line({ source: S('fx:src:rev', 'A'), item: { item_id: 'fx:rev-old', source_id: 'fx:src:rev', item_type: 'RESEARCH_RESULT', as_of: '2026-09-01', claim: 'Synthetic result captured from revision alpha.' } }));
    const r = await W.importJSONL(db, line({ source: S('fx:src:rev', 'B', { currentness: 'HISTORICAL' }), item: { item_id: 'fx:rev-new', source_id: 'fx:src:rev', item_type: 'RESEARCH_RESULT', claim: 'Synthetic result captured from revision beta.' } }));
    assert(r.committed && r.sources_updated === 1);
    assert.strictEqual(q1(db, "SELECT revision FROM wiz_ref_sources WHERE source_id='fx:src:rev'"), 'B');
    const old = W.search(db, 'alpha')[0], neu = W.search(db, 'beta')[0];
    assert.strictEqual(old.item_id, 'fx:rev-old');
    assert.strictEqual(old.source_revision, 'A'); assert.strictEqual(old.source_as_of, '2026-09-01'); assert.strictEqual(old.source_content_hash, 'fx-hash-A');
    assert.strictEqual(old.source_currentness, 'CURRENT');
    assert.strictEqual(old.source_current_revision, 'B'); assert.strictEqual(old.source_changed_since_capture, true);
    assert(/source \(at capture\): .*rev=A\)/.test(old.block) && /source \(current record\): rev=B/.test(old.block) && /SOURCE CHANGED SINCE CAPTURE/.test(old.block), old.block);
    const tr = W.trace(db, 'fx:rev-old');
    assert.strictEqual(tr.item.source_revision, 'A'); assert.strictEqual(tr.source_current.revision, 'B');
    assert.strictEqual(neu.source_revision, 'B'); assert.strictEqual(neu.source_changed_since_capture, false); assert(!/SOURCE CHANGED/.test(neu.block));
    assert.strictEqual(W.trace(db, 'fx:rev-new').item.source_revision, 'B');
    // re-asserting the old item unchanged under rev B keeps its original capture
    await W.importJSONL(db, line({ source: S('fx:src:rev', 'B', { currentness: 'HISTORICAL' }), item: { item_id: 'fx:rev-old', source_id: 'fx:src:rev', item_type: 'RESEARCH_RESULT', as_of: '2026-09-01', claim: 'Synthetic result captured from revision alpha.' } }));
    assert.strictEqual(W.search(db, 'alpha')[0].source_revision, 'A');
    // a CONTENT change under rev B re-captures from B, while the archived old version keeps capture A
    await W.importJSONL(db, line({ source: S('fx:src:rev', 'B', { currentness: 'HISTORICAL' }), item: { item_id: 'fx:rev-old', source_id: 'fx:src:rev', item_type: 'RESEARCH_RESULT', as_of: '2026-09-20', claim: 'Synthetic result captured from revision alpha, restated.' } }));
    const all = W.search(db, 'alpha', { include_superseded: true });
    const arch = all.find(x => x.item_id.startsWith('fx:rev-old@')), cur = all.find(x => x.item_id === 'fx:rev-old');
    assert(arch && arch.source_revision === 'A' && arch.lifecycle === 'SUPERSEDED' && cur.source_revision === 'B', JSON.stringify(all.map(x => [x.item_id, x.source_revision])));
    // tool rendering (ref_source / ref_trace) comes from the same blocks
    assert(W.getSource(db, 'fx:src:rev').items.find(b => b.item_id.startsWith('fx:rev-old@')).block.includes('rev=A'));
  });

  await T('P1-2b', 'later authority upgrade of a source does not retroactively promote older items (capture-time classification used for flags + filters)', async () => {
    const { db } = await bootApp();
    const gA = S('fx:src:up', 'A', { surface: 'github', source_kind: 'IMPLEMENTATION', authority_class: 'RESEARCH_SYNTHESIS' });
    const gB = S('fx:src:up', 'B', { surface: 'github', source_kind: 'IMPLEMENTATION', authority_class: 'IMPLEMENTATION_EVIDENCE' });
    await W.importJSONL(db, line({ source: gA, item: { item_id: 'fx:up-old', source_id: 'fx:src:up', item_type: 'IMPLEMENTATION_FACT', claim: 'Synthetic gamma observation before upgrade.' } }));
    await W.importJSONL(db, line({ source: gB, item: { item_id: 'fx:up-new', source_id: 'fx:src:up', item_type: 'IMPLEMENTATION_FACT', claim: 'Synthetic gamma observation after upgrade.' } }));
    const ev = W.search(db, 'gamma', { implementation_evidence_only: true }).map(x => x.item_id);
    assert.deepStrictEqual(ev, ['fx:up-new']);
    const old = W.search(db, 'before upgrade')[0];
    assert.strictEqual(old.authority_class, 'RESEARCH_SYNTHESIS'); assert.strictEqual(old.is_implementation_evidence, false);
    assert.strictEqual(old.source_current_authority_class, 'IMPLEMENTATION_EVIDENCE');
  });

  await T('P1-2c', 'v1→v3 migration backfills capture provenance (= source at migration time, capture_backfilled=1), relation record_hash and version pins', async () => {
    const SQL = await initSqlJs({ wasmBinary: WASM });
    const old = new SQL.Database();
    old.run(`CREATE TABLE wiz_ref_meta (key TEXT PRIMARY KEY, value TEXT)`); old.run(`INSERT INTO wiz_ref_meta VALUES('schema_version','1')`);
    old.run(`CREATE TABLE wiz_ref_sources (source_id TEXT PRIMARY KEY, title TEXT NOT NULL, surface TEXT NOT NULL, source_kind TEXT NOT NULL, authority_class TEXT, project_id TEXT, locator TEXT, revision TEXT, as_of TEXT, currentness TEXT, privacy TEXT DEFAULT 'private', content_hash TEXT, seed_id TEXT, first_seed_version TEXT, last_seed_version TEXT, record_hash TEXT, imported_at INTEGER)`);
    old.run(`CREATE TABLE wiz_ref_items (item_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, project_id TEXT, item_type TEXT NOT NULL, claim TEXT NOT NULL, epistemic_state TEXT, lifecycle TEXT DEFAULT 'ACTIVE', record_hash TEXT)`);
    old.run(`CREATE TABLE wiz_ref_relations (relation_id TEXT PRIMARY KEY, from_item_id TEXT NOT NULL, to_item_id TEXT NOT NULL, relation_type TEXT NOT NULL, epistemic_status TEXT NOT NULL, source_id TEXT, scope TEXT, rationale TEXT, seed_id TEXT, created_at INTEGER)`);
    old.run(`INSERT INTO wiz_ref_sources(source_id,title,surface,source_kind,authority_class,revision,as_of,currentness,content_hash) VALUES('fx:s','[SYNTHETIC FIXTURE] v1 source','fixture','RESEARCH','RESEARCH_SYNTHESIS','R1','2026-09-10','CURRENT','h1')`);
    old.run(`INSERT INTO wiz_ref_items(item_id,source_id,item_type,claim,epistemic_state) VALUES('fx:i1','fx:s','HYPOTHESIS','synthetic delta claim','SOURCE_ASSERTION'),('fx:i2','fx:s','HYPOTHESIS','synthetic epsilon claim','SOURCE_ASSERTION')`);
    old.run(`INSERT INTO wiz_ref_relations(relation_id,from_item_id,to_item_id,relation_type,epistemic_status) VALUES('fx:r','fx:i1','fx:i2','RELATED_TO','SOURCE_ASSERTION')`);
    const app = await bootApp(old.export());
    assert.strictEqual(W.getMeta(app.db, 'schema_version'), '3');
    assert(JSON.parse(W.getMeta(app.db, 'migrated_from_schema_1')).items_capture_backfilled === 2);
    const b = W.search(app.db, 'delta')[0];
    assert.strictEqual(b.source_revision, 'R1'); assert.strictEqual(b.capture_backfilled, true); assert(/CAPTURE PROVENANCE BACKFILLED/.test(b.block));
    assert(q1(app.db, "SELECT record_hash FROM wiz_ref_relations WHERE relation_id='fx:r'"));
    assert(/^fx:i2@[0-9a-f]{14}$/.test(q1(app.db, "SELECT to_version_id FROM wiz_ref_relations WHERE relation_id='fx:r'")));
    assert.strictEqual(q1(app.db, "SELECT pin_backfilled FROM wiz_ref_relations WHERE relation_id='fx:r'"), 1);
    const snap = fullSnap(app.db); W.initSchema(app.db); assert.strictEqual(fullSnap(app.db), snap, 'migration not idempotent');
    // same relation content re-imported after migration → unchanged (hash matches)
    const r = await W.importJSONL(app.db, line({ relation: { relation_id: 'fx:r', from_item_id: 'fx:i1', to_item_id: 'fx:i2', relation_type: 'RELATED_TO', epistemic_status: 'SOURCE_ASSERTION' } }));
    assert(r.committed && r.relations_unchanged === 1);
  });

  await T('P1-4a', 'same relation twice → unchanged (no duplicate); endpoint present only in DB is accepted', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const r = await W.importJSONL(db, v1);
    assert.strictEqual(r.relations_inserted, 0); assert.strictEqual(r.relations_unchanged, 1);
    const r2 = await W.importJSONL(db, line({ relation: { relation_id: 'fx:rel:db-endpoints', from_item_id: 'fx:unknown-false', to_item_id: 'fx:atlas-not-truth', relation_type: 'SUPPORTS', epistemic_status: 'CANDIDATE' } }));
    assert(r2.committed && r2.relations_inserted === 1);
    assert(q1(db, "SELECT record_hash FROM wiz_ref_relations WHERE relation_id='fx:rel:db-endpoints'"));
  });

  await T('P1-4b', 'same relation_id with changed content is REJECTED (not silently unchanged) with zero DB delta', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const before = fullSnap(db);
    for (const change of [{ epistemic_status: 'CANDIDATE' }, { scope: 'other scope' }, { rationale: 'new rationale' }, { relation_type: 'SUPPORTS' }, { to_item_id: 'fx:atlas-not-truth' }, { source_id: 'fx:src:guards' }]) {
      const rel = Object.assign({ relation_id: 'fx:rel:1', from_item_id: 'fx:atlas-route', to_item_id: 'fx:unknown-false', relation_type: 'RELATED_TO', epistemic_status: 'SOURCE_ASSERTION', source_id: 'fx:src:nav-map' }, change);
      const r = await W.importJSONL(db, line({ relation: rel }));
      assert(!r.committed && r.errors.some(e => /relation revisions are rejected/.test(e.msg)), JSON.stringify(change) + ' ' + JSON.stringify(r.errors));
      assert.strictEqual(fullSnap(db), before, 'delta after rejected relation change ' + JSON.stringify(change));
    }
  });

  await T('P1-4c', 'dangling relation endpoint (not in DB, not in bundle) → whole import rejected with zero DB delta; endpoint inside the same bundle accepted', async () => {
    const { db } = await bootApp(); await W.importJSONL(db, v1);
    const before = fullSnap(db);
    const bundle = [
      line({ source: S('fx:src:dang', 'A'), item: { item_id: 'fx:dang-item', source_id: 'fx:src:dang', item_type: 'HYPOTHESIS', claim: 'synthetic item with a dangling relation' } }),
      line({ relation: { relation_id: 'fx:rel:dangling', from_item_id: 'fx:dang-item', to_item_id: 'fx:does-not-exist', relation_type: 'RELATED_TO', epistemic_status: 'SOURCE_ASSERTION' } }),
    ].join('\n');
    const r = await W.importJSONL(db, bundle);
    assert(!r.committed && r.errors.some(e => /not found in DB or bundle/.test(e.msg)));
    assert.strictEqual(fullSnap(db), before);
    const ok = await W.importJSONL(db, bundle.replace('fx:does-not-exist', 'fx:dang-item-2') + '\n' +
      line({ source: S('fx:src:dang', 'A'), item: { item_id: 'fx:dang-item-2', source_id: 'fx:src:dang', item_type: 'HYPOTHESIS', claim: 'second synthetic item' } }));
    assert(ok.committed && ok.relations_inserted === 1, JSON.stringify(ok.errors));
  });

  await T('P2-1', 'sw.js lists wiz-ref-memory.js in STATIC_ASSETS and CACHE_NAME differs from main', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert(/BASE_PATH \+ '\/wiz-ref-memory\.js'/.test(sw.slice(sw.indexOf('STATIC_ASSETS'), sw.indexOf('];'))));
    const cur = sw.match(/const CACHE_NAME = '([^']+)'/)[1];
    let mainName = 'eiti-wizard-lab-v1.8.9';
    try { mainName = require('child_process').execSync('git show origin/main:sw.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().match(/const CACHE_NAME = '([^']+)'/)[1]; } catch (e) {}
    assert.notStrictEqual(cur, mainName, `CACHE_NAME not bumped (${cur})`);
    assert(/<script src="wiz-ref-memory\.js"><\/script>/.test(INDEX));
  });

  await T('P1-3s', 'awaitable persistence (_wizSaveDBAsync) exists, waits for oncomplete + read-back, is used by ref import/clear only; _wizSaveDB unchanged', async () => {
    const fn = fnBody('_wizSaveDBAsync');
    assert(/oncomplete/.test(fn) && /onabort/.test(fn) && /onerror/.test(fn) && /byteLength/.test(fn));
    const main = (() => { try { return require('child_process').execSync('git show origin/main:index.html', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).toString(); } catch (e) { return null; } })();
    if (main) {
      const body = (src, n) => { const a = src.indexOf('function ' + n + '('); return src.slice(a, src.indexOf('\n}\n', a)); };
      for (const n of ['_wizSaveDB', '_wizIDBSet', '_wizIDBGet', 'wizInitSQLite']) assert.strictEqual(body(INDEX, n), body(main, n), n + ' changed');
    }
    const uses = INDEX.split('\n').filter(l => /_wizSaveDBAsync/.test(l) && !/^\s*\/\//.test(l) && !/function _wizSaveDBAsync/.test(l));
    assert.strictEqual(uses.length, 0, 'index.html personal-memory code must not use _wizSaveDBAsync: ' + uses.join(' | '));
    assert(/_wizSaveDBAsync/.test(REFJS));
    const { ctx, db } = await bootApp();
    const r = await ctx.wizRefImportJSONL(v1); assert(r.committed && r.persisted === true);
    ctx._wizSaveDBAsync = async () => { throw new Error('simulated abort'); };
    const r2 = await ctx.wizRefImportJSONL(FX('synthetic.v2.fixture.jsonl'));
    assert(r2.committed && r2.persisted === false && /simulated abort/.test(r2.persist_error));
    const r3 = await ctx.wizRefImportJSONL('{bad'); assert(!r3.committed && r3.persisted === false);
  });


  // ── Audit revision 2: relations point to IMMUTABLE item versions ─────────────
  const VS = S('fx:src:ver', 'A');
  const itemRec = (id, claim, extra = {}) => line({ source: VS, item: Object.assign({ item_id: id, source_id: 'fx:src:ver', item_type: 'HYPOTHESIS', as_of: '2026-09-01', claim }, extra) });
  const relRec = (id, from, to, extra = {}) => line({ relation: Object.assign({ relation_id: id, from_item_id: from, to_item_id: to, relation_type: 'SUPPORTS', epistemic_status: 'SOURCE_ASSERTION', source_id: 'fx:src:ver' }, extra) });
  const ids = rs => rs.map(r => r.relation_id).sort();

  await T('P1-5a', 'item revision never retargets existing relations: R stays on X-v1 ("A is UNKNOWN"), R2 attaches to X-v2 ("A is SUPPORTED"); trace per version', async () => {
    const { db } = await bootApp();
    // 1) X v1 + evidence E; 2) R: E SUPPORTS X-v1
    let r = await W.importJSONL(db, [itemRec('fx:E', 'Synthetic evidence E', { item_type: 'RESEARCH_RESULT' }), itemRec('fx:X', 'A is UNKNOWN'), relRec('fx:R', 'fx:E', 'fx:X')].join('\n'));
    assert(r.committed, JSON.stringify(r.errors));
    const x1 = W.trace(db, 'fx:X').version_id;
    assert(/^fx:X@[0-9a-f]{14}$/.test(x1));
    // 3) revise the same logical X
    r = await W.importJSONL(db, itemRec('fx:X', 'A is SUPPORTED'));
    assert(r.committed && r.items_revised === 1);
    const x2 = W.trace(db, 'fx:X').version_id;
    assert.notStrictEqual(x1, x2);
    // 4) R still resolves to the OLD version / claim
    let R = W.resolveRelation(db, 'fx:R');
    assert.strictEqual(R.to.version_id, x1); assert.strictEqual(R.to.claim, 'A is UNKNOWN'); assert.strictEqual(R.to.is_current_version, false);
    assert.strictEqual(R.to_item_id, 'fx:X'); // logical label kept, but the pin decides the target
    // 5) R2 to the current X-v2
    r = await W.importJSONL(db, relRec('fx:R2', 'fx:E', 'fx:X'));
    assert(r.committed && r.relations_inserted === 1);
    const R2 = W.resolveRelation(db, 'fx:R2');
    R = W.resolveRelation(db, 'fx:R');
    assert.strictEqual(R.to.version_id, x1); assert.strictEqual(R.to.claim, 'A is UNKNOWN');
    assert.strictEqual(R2.to.version_id, x2); assert.strictEqual(R2.to.claim, 'A is SUPPORTED'); assert.strictEqual(R2.to.is_current_version, true);
    // trace: old version → old relations only; current version → only relations attached to it
    const tOld = W.trace(db, x1), tCur = W.trace(db, 'fx:X');
    assert.strictEqual(tOld.item.claim, 'A is UNKNOWN'); assert.strictEqual(tOld.is_current_version, false);
    assert.deepStrictEqual(ids(tOld.relations.incoming), ['fx:R']);
    assert.strictEqual(tCur.item.claim, 'A is SUPPORTED'); assert.strictEqual(tCur.is_current_version, true);
    assert.deepStrictEqual(ids(tCur.relations.incoming), ['fx:R2']);
    assert.deepStrictEqual(ids(W.trace(db, x2).relations.incoming), ['fx:R2']);
    assert.deepStrictEqual(ids(W.trace(db, 'fx:E').relations.outgoing), ['fx:R', 'fx:R2']);
    assert.deepStrictEqual(tCur.versions.map(v => [v.version_id, v.is_current_version]), [[x1, false], [x2, true]]);
    // re-importing R unchanged does NOT rebind it to X-v2; explicit re-pin is rejected with zero delta
    r = await W.importJSONL(db, relRec('fx:R', 'fx:E', 'fx:X'));
    assert(r.committed && r.relations_unchanged === 1);
    assert.strictEqual(W.resolveRelation(db, 'fx:R').to.version_id, x1);
    const before = fullSnap(db);
    r = await W.importJSONL(db, relRec('fx:R', 'fx:E', 'fx:X', { to_version_id: x2 }));
    assert(!r.committed && r.errors.some(e => /re-pinning is rejected/.test(e.msg)));
    assert.strictEqual(fullSnap(db), before);
    // search block shows version identity
    assert(/version: fx:X@[0-9a-f]{14} \(current\)/.test(W.search(db, 'SUPPORTED')[0].block));
    // export/backup round-trip preserves the pins
    const b = await bootApp(); const rr = await W.importJSONL(b.db, W.exportJSONL(db));
    assert(rr.ok, JSON.stringify(rr.errors));
    assert.strictEqual(W.resolveRelation(b.db, 'fx:R').to.version_id, x1); assert.strictEqual(W.resolveRelation(b.db, 'fx:R').to.claim, 'A is UNKNOWN');
    assert.strictEqual(W.resolveRelation(b.db, 'fx:R2').to.version_id, x2); assert.strictEqual(W.resolveRelation(b.db, 'fx:R2').to.claim, 'A is SUPPORTED');
    assert.deepStrictEqual(ids(W.trace(b.db, x1).relations.incoming), ['fx:R']);
    assert.deepStrictEqual(ids(W.trace(b.db, 'fx:X').relations.incoming), ['fx:R2']);
  });

  await T('P1-5b', 'bundle endpoint expression: logical id → version current after the bundle; archived id or explicit to_version_id → exactly that version; unknown version rejected', async () => {
    const { db } = await bootApp();
    await W.importJSONL(db, [itemRec('fx:E', 'Synthetic evidence E', { item_type: 'RESEARCH_RESULT' }), itemRec('fx:X', 'A is UNKNOWN')].join('\n'));
    const x1 = W.trace(db, 'fx:X').version_id;
    // same bundle revises X and adds a relation by logical id → pinned to the NEW version
    await W.importJSONL(db, [itemRec('fx:X', 'A is SUPPORTED'), relRec('fx:Rnew', 'fx:E', 'fx:X')].join('\n'));
    const x2 = W.trace(db, 'fx:X').version_id;
    assert.strictEqual(W.resolveRelation(db, 'fx:Rnew').to.version_id, x2);
    // archived id as endpoint, and explicit to_version_id → the old version
    await W.importJSONL(db, [relRec('fx:Rarch', 'fx:E', x1), relRec('fx:Rpin', 'fx:E', 'fx:X', { to_version_id: x1 })].join('\n'));
    assert.strictEqual(W.resolveRelation(db, 'fx:Rarch').to.claim, 'A is UNKNOWN');
    assert.strictEqual(W.resolveRelation(db, 'fx:Rpin').to.claim, 'A is UNKNOWN');
    const before = fullSnap(db);
    const r = await W.importJSONL(db, relRec('fx:Rbad', 'fx:E', 'fx:X', { to_version_id: 'fx:X@00000000000000' }));
    assert(!r.committed && r.errors.some(e => /not a known item version/.test(e.msg)));
    assert.strictEqual(fullSnap(db), before);
    // tampered version_id on an item record is rejected
    const r2 = await W.importJSONL(db, line({ source: VS, item: { item_id: 'fx:Y', source_id: 'fx:src:ver', item_type: 'HYPOTHESIS', claim: 'y', version_id: 'fx:Y@ffffffffffffff' } }));
    assert(!r2.committed && r2.errors.some(e => /does not match its content/.test(e.msg)));
  });

  await T('P1-5c', 'v2→v3 migration pins existing relations deterministically to the version current at migration time (pin_backfilled=1); later revision does not move them', async () => {
    const SQL = await initSqlJs({ wasmBinary: WASM });
    const old = new SQL.Database();
    // exact v2 column set (schema as shipped at b2c7e34), no v3 columns
    const cap = ['source_title', 'source_surface', 'source_kind', 'source_authority_class', 'source_revision', 'source_as_of', 'source_currentness', 'source_content_hash'].map(f => f + '_at_capture TEXT').join(', ');
    old.run(`CREATE TABLE wiz_ref_meta (key TEXT PRIMARY KEY, value TEXT)`); old.run(`INSERT INTO wiz_ref_meta VALUES('schema_version','2')`);
    old.run(`CREATE TABLE wiz_ref_sources (source_id TEXT PRIMARY KEY, title TEXT NOT NULL, surface TEXT NOT NULL, source_kind TEXT NOT NULL, authority_class TEXT, project_id TEXT, locator TEXT, revision TEXT, as_of TEXT, currentness TEXT, privacy TEXT DEFAULT 'private', content_hash TEXT, seed_id TEXT, first_seed_version TEXT, last_seed_version TEXT, record_hash TEXT, imported_at INTEGER)`);
    old.run(`CREATE TABLE wiz_ref_items (item_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, project_id TEXT, item_type TEXT NOT NULL, claim TEXT NOT NULL, source_section TEXT, source_status TEXT, epistemic_state TEXT, authority_scope TEXT, validity TEXT, confidence REAL, as_of TEXT, supersedes_item_id TEXT, created_at INTEGER, provenance TEXT, lifecycle TEXT DEFAULT 'ACTIVE', superseded_by TEXT, record_hash TEXT, seed_id TEXT, first_seed_version TEXT, last_seed_version TEXT, ${cap}, capture_backfilled INTEGER DEFAULT 0)`);
    old.run(`CREATE TABLE wiz_ref_relations (relation_id TEXT PRIMARY KEY, from_item_id TEXT NOT NULL, to_item_id TEXT NOT NULL, relation_type TEXT NOT NULL, epistemic_status TEXT NOT NULL, source_id TEXT, scope TEXT, rationale TEXT, seed_id TEXT, created_at INTEGER, record_hash TEXT)`);
    old.run(`CREATE VIRTUAL TABLE wiz_ref_items_fts USING fts5(item_id UNINDEXED, claim, project_id, item_type, tokenize='unicode61')`);
    old.run(`INSERT INTO wiz_ref_sources(source_id,title,surface,source_kind,authority_class,revision) VALUES('fx:src:ver','[SYNTHETIC FIXTURE] v2 source','fixture','RESEARCH','RESEARCH_SYNTHESIS','A')`);
    old.run(`INSERT INTO wiz_ref_items(item_id,source_id,item_type,claim,epistemic_state,lifecycle,source_title_at_capture) VALUES('fx:E','fx:src:ver','RESEARCH_RESULT','Synthetic evidence E','SOURCE_ASSERTION','ACTIVE','t'),('fx:X','fx:src:ver','HYPOTHESIS','A is UNKNOWN','SOURCE_ASSERTION','ACTIVE','t')`);
    old.run(`INSERT INTO wiz_ref_items(item_id,source_id,item_type,claim,epistemic_state,lifecycle,superseded_by,source_title_at_capture) VALUES('fx:X@0123456789abcd','fx:src:ver','HYPOTHESIS','A was earlier OPEN','SOURCE_ASSERTION','SUPERSEDED','fx:X','t')`);
    old.run(`INSERT INTO wiz_ref_relations(relation_id,from_item_id,to_item_id,relation_type,epistemic_status) VALUES('fx:R','fx:E','fx:X','SUPPORTS','SOURCE_ASSERTION'),('fx:Rdang','fx:E','fx:gone','RELATED_TO','SOURCE_ASSERTION')`);
    const app = await bootApp(old.export());
    const db = app.db;
    assert.strictEqual(W.getMeta(db, 'schema_version'), '3');
    const mig = JSON.parse(W.getMeta(db, 'migrated_from_schema_2'));
    assert(mig.items_versioned === 3 && mig.relations_pinned === 2, JSON.stringify(mig));
    assert.strictEqual(q1(db, "SELECT version_id FROM wiz_ref_items WHERE item_id='fx:X@0123456789abcd'"), 'fx:X@0123456789abcd');
    assert.strictEqual(q1(db, "SELECT logical_item_id FROM wiz_ref_items WHERE item_id='fx:X@0123456789abcd'"), 'fx:X');
    const xMig = W.trace(db, 'fx:X').version_id;
    let R = W.resolveRelation(db, 'fx:R');
    assert.strictEqual(R.to.version_id, xMig); assert.strictEqual(R.pin_backfilled, 1); assert.strictEqual(R.to.claim, 'A is UNKNOWN');
    const D = W.resolveRelation(db, 'fx:Rdang'); assert(D.to.unresolved && D.to_version_id === null && D.pin_backfilled === 1);
    const snap = fullSnap(db); W.initSchema(db); assert.strictEqual(fullSnap(db), snap, 'v3 migration not idempotent');
    // after migration, revising X does not move the backfilled pin
    await W.importJSONL(db, line({ source: Object.assign({}, VS, { revision: 'A' }), item: { item_id: 'fx:X', source_id: 'fx:src:ver', item_type: 'HYPOTHESIS', claim: 'A is SUPPORTED' } }));
    R = W.resolveRelation(db, 'fx:R');
    assert.strictEqual(R.to.version_id, xMig); assert.strictEqual(R.to.claim, 'A is UNKNOWN');
    assert.deepStrictEqual(ids(W.trace(db, 'fx:X').relations.incoming), []);
  });


  await T('P1-5d', 'explicit pin must match the declared endpoint (DECLARED ENDPOINT == LOGICAL IDENTITY OF PINNED VERSION): foreign-item pin and wrong-version pin rejected with zero delta; archived pin under logical label accepted', async () => {
    const { db } = await bootApp();
    let r = await W.importJSONL(db, [itemRec('fx:E', 'Synthetic evidence E', { item_type: 'RESEARCH_RESULT' }), itemRec('fx:X', 'A is UNKNOWN'), itemRec('fx:Y', 'B is UNKNOWN')].join('\n'));
    assert(r.committed, JSON.stringify(r.errors));
    const x1 = W.trace(db, 'fx:X').version_id, y1 = W.trace(db, 'fx:Y').version_id, e1 = W.trace(db, 'fx:E').version_id;
    await W.importJSONL(db, itemRec('fx:X', 'A is SUPPORTED'));
    const x2 = W.trace(db, 'fx:X').version_id;
    assert(x1 !== x2 && W.trace(db, x1).is_current_version === false);
    const rejects = async (rec, re) => {
      const before = fullSnap(db);
      const res = await W.importJSONL(db, rec);
      assert(!res.committed && res.errors.some(e => re.test(e.msg)), JSON.stringify(res.errors));
      assert.strictEqual(fullSnap(db), before, 'rejected import must leave zero DB delta');
    };
    // A) endpoint X pinned to a valid version of Y → rejected (to_ side and from_ side)
    await rejects(relRec('fx:Rbad-to', 'fx:E', 'fx:X', { to_version_id: y1 }), /belongs to logical item "fx:Y", not to the declared endpoint "fx:X"/);
    await rejects(relRec('fx:Rbad-from', 'fx:X', 'fx:E', { from_version_id: y1 }), /from_item_id\/from_version_id inconsistent — pinned version .* belongs to logical item "fx:Y"/);
    // … even when the other side is correctly pinned, and even inside a bundle that also carries valid records
    await rejects([itemRec('fx:Z', 'C is UNKNOWN'), relRec('fx:Rbad-mix', 'fx:E', 'fx:X', { from_version_id: e1, to_version_id: y1 })].join('\n'), /belongs to logical item "fx:Y"/);
    // B) endpoint names the immutable version X-v1 but pins X-v2 → rejected
    await rejects(relRec('fx:Rbad-ver', 'fx:E', x1, { to_version_id: x2 }), new RegExp(`endpoint "${x1.replace(/[$^]/g, '\\$&')}" is an immutable version; the pin must be exactly`));
    // optional) a version produced in the same bundle for Y, pinned under endpoint X → rejected
    const yNewRec = itemRec('fx:Y', 'B is SUPPORTED');
    const tmp = await bootApp(); await W.importJSONL(tmp.db, yNewRec); const yNewVer = W.trace(tmp.db, 'fx:Y').version_id; // same content → same version id
    assert(yNewVer !== y1);
    await rejects([yNewRec, relRec('fx:Rbad-bundle', 'fx:E', 'fx:X', { to_version_id: yNewVer })].join('\n'), /belongs to logical item "fx:Y", not to the declared endpoint "fx:X"/);
    // a bundle item may not claim another item's logical identity (so a produced version cannot masquerade as X)
    await rejects(line({ source: VS, item: { item_id: 'fx:Q', source_id: 'fx:src:ver', item_type: 'HYPOTHESIS', claim: 'q', logical_item_id: 'fx:X' } }), /logical_item_id "fx:X" does not match its item_id/);
    // C) endpoint label X + pin X-v1 (archived) → ACCEPTED, resolves to v1
    r = await W.importJSONL(db, relRec('fx:Rok-arch', 'fx:E', 'fx:X', { to_version_id: x1 }));
    assert(r.committed && r.relations_inserted === 1, JSON.stringify(r.errors));
    let R = W.resolveRelation(db, 'fx:Rok-arch');
    assert.strictEqual(R.to.version_id, x1); assert.strictEqual(R.to.claim, 'A is UNKNOWN'); assert.strictEqual(R.to.logical_item_id, 'fx:X'); assert.strictEqual(R.to.is_current_version, false);
    // endpoint X@v1 + pin X@v1 and endpoint X + pin X-v2 (current) → accepted
    r = await W.importJSONL(db, [relRec('fx:Rok-self', 'fx:E', x1, { to_version_id: x1 }), relRec('fx:Rok-cur', 'fx:E', 'fx:X', { to_version_id: x2 })].join('\n'));
    assert(r.committed && r.relations_inserted === 2, JSON.stringify(r.errors));
    assert.strictEqual(W.resolveRelation(db, 'fx:Rok-cur').to.claim, 'A is SUPPORTED');
    // existing exports (explicit pins, incl. relations pinned to archived versions) still re-import cleanly
    const b = await bootApp(); const rr = await W.importJSONL(b.db, W.exportJSONL(db));
    assert(rr.ok && rr.committed, JSON.stringify(rr.errors));
    R = W.resolveRelation(b.db, 'fx:Rok-arch'); assert.strictEqual(R.to.version_id, x1); assert.strictEqual(R.to.claim, 'A is UNKNOWN');
    assert.strictEqual(W.resolveRelation(b.db, 'fx:Rok-self').to.version_id, x1);
    // and re-importing the export into the same DB is all-unchanged
    const again = await W.importJSONL(db, W.exportJSONL(db));
    assert(again.committed && again.relations_inserted === 0 && again.items_inserted === 0 && again.items_revised === 0, JSON.stringify(again));
  });

  await T('P2-h', '_wizSaveDBAsync verifies exact bytes + SHA-256 of the read-back and reports the hash (static)', async () => {
    const fn = fnBody('_wizSaveDBAsync');
    assert(/crypto\.subtle\.digest\('SHA-256'/.test(fn) && /sha256/.test(fn) && /read-back mismatch/.test(fn) && /for \(let i = 0; i < a\.length; i\+\+\) if \(a\[i\] !== b\[i\]\)/.test(fn), 'hash/byte verification missing');
  });

  const fail = results.filter(r => r[1] !== 'PASS');
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  fs.writeFileSync(path.join(os.tmpdir(), 'refmem-db-results.json'), JSON.stringify(results, null, 1));
  process.exit(fail.length ? 1 : 0);
})();

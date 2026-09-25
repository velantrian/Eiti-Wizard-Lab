// DB-level tests for the Memory Admission Controller v0.1 (REVIEW mode, step 1 of 2).
// Runs the REAL shipped code: wiz-ref-memory.js + wiz-memory-admission.js + the SQLite memory block
// extracted verbatim from index.html, on the repo's own sql-wasm build.
// Usage: node tests/admission/db.test.cjs        Fixtures are SYNTHETIC (tests/admission/fixtures).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..', '..');
const FX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const initSqlJs = require(path.join(ROOT, 'sql-wasm.js'));
const WASM = fs.readFileSync(path.join(ROOT, 'sql-wasm.wasm'));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const REFJS = fs.readFileSync(path.join(ROOT, 'wiz-ref-memory.js'), 'utf8');
const ADMJS = fs.readFileSync(path.join(ROOT, 'wiz-memory-admission.js'), 'utf8');
const BASE = FX('synthetic.reference-base.fixture.jsonl');
const DUPFX = FX('synthetic.duplicate-target.fixture.jsonl'); // audit rev 1: DUPLICATE identity target (with capture provenance)
const INC = JSON.parse(FX('synthetic.incoming.fixture.json'));
const SPEC_OUTCOMES = ['DUPLICATE', 'REFINEMENT', 'NEW_EVIDENCE', 'CONTRADICTION', 'NEW_RELATED_ITEM', 'STATUS_CHANGE', 'OUT_OF_SCOPE', 'UNCERTAIN'];

const results = [];
async function T(id, name, fn) {
  try { await fn(); results.push([id, 'PASS', name]); console.log(`PASS  [${id}] ${name}`); }
  catch (e) { results.push([id, 'FAIL', name, e.message]); console.log(`FAIL  [${id}] ${name}\n      ${e.stack.split('\n').slice(0, 3).join('\n      ')}`); }
}
function memBlock() {
  const a = INDEX.indexOf('async function wizInitSQLite()'), b = INDEX.indexOf('// ── Инициализация при старте');
  assert(a > 0 && b > a, 'memory block not found in index.html'); return INDEX.slice(a, b);
}
// Boot an app-like context: window === global, real memory block + real ref + admission modules.
async function bootApp(savedBytes, { withAdmission = true } = {}) {
  const SQL = await initSqlJs({ wasmBinary: WASM });
  const idb = { saved: savedBytes || null };
  const ctx = { console: { log() {}, warn: console.warn, error: console.error }, Date, Math, JSON, Uint8Array, Promise, Object, Array, Set, Map, Number, String, Error, TextEncoder, crypto: globalThis.crypto };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.initSqlJs = async () => SQL; ctx.indexedDB = {};
  vm.createContext(ctx);
  vm.runInContext(REFJS, ctx, { filename: 'wiz-ref-memory.js' });
  if (withAdmission) vm.runInContext(ADMJS, ctx, { filename: 'wiz-memory-admission.js' });
  vm.runInContext(memBlock(), ctx, { filename: 'index.html#memblock' });
  ctx._wizIDBGet = async k => (k === 'wiz_lab_sqlite_db' ? idb.saved : null);
  ctx._wizIDBSet = (k, v) => { if (k === 'wiz_lab_sqlite_db') idb.saved = new Uint8Array(v).slice(); };
  ctx._wizSaveDBAsync = async () => { idb.saved = ctx._wizDB.export().slice(); return { bytes: idb.saved.byteLength, verified: true }; };
  vm.runInContext(`_wizIDBGet = window._wizIDBGet; _wizIDBSet = window._wizIDBSet; _wizSaveDBAsync = window._wizSaveDBAsync;`, ctx);
  await ctx.wizInitSQLite();
  return { ctx, db: ctx._wizDB, idb, A: ctx.WizAdmission, W: ctx.WizRef };
}
// INDEPENDENT dump of every wiz_ref* object (schema + all rows, incl. FTS shadow tables) — not the module's own fingerprint
function refDump(db) {
  const rows = (sql) => { const r = db.exec(sql); return r.length ? r[0].values : []; };
  const enc = v => (v instanceof Uint8Array ? Buffer.from(v).toString('hex') : v);
  const schema = rows("SELECT type,name,sql FROM sqlite_master WHERE substr(name,1,7)='wiz_ref' OR substr(tbl_name,1,7)='wiz_ref' ORDER BY type,name");
  const data = schema.filter(s => s[0] === 'table').map(([, n]) => [n, rows(`SELECT * FROM "${n}"`).map(r => JSON.stringify(r.map(enc))).sort()]);
  return JSON.stringify({ schema, data });
}
const personalDump = db => ['wiz_facts', 'wiz_facts_fts', 'wiz_l2_digests', 'wiz_notes_fts'].map(t => JSON.stringify(db.exec(`SELECT * FROM ${t}`))).join('|');
const q1 = (db, sql, p) => { const r = db.exec(sql, p || []); return r.length ? r[0].values[0][0] : null; };
async function seeded() {
  const app = await bootApp();
  const r = await app.W.importJSONL(app.db, BASE);
  assert(r.committed, JSON.stringify(r.errors));
  app.ctx.wizMemAdd('general UI test personal fact about team sports', 'general', 'user'); // personal memory row
  return app;
}
const clone = o => JSON.parse(JSON.stringify(o));
// objects from the vm realm have foreign prototypes: compare by value
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

(async () => {
  await T('enum', 'closed outcome enum is exactly the 8 spec values, frozen, and mirrored in the staging CHECK constraint; REVIEW is the only mode; no apply/dismiss in step 1', async () => {
    const { A } = await bootApp();
    deq([...A.OUTCOMES], SPEC_OUTCOMES);
    assert(Object.isFrozen(A.OUTCOMES) && Object.isFrozen(A) && Object.isFrozen(A.REVIEW_STATES));
    assert.throws(() => { 'use strict'; A.OUTCOMES.push('NEW'); });
    assert.strictEqual(A.ADMISSION_MODE, 'REVIEW');
    deq([...A.REVIEW_STATES], ['AWAITING_REVIEW', 'APPLIED', 'DISMISSED']);
    const chk = A.DDL.match(/proposed_outcome IN \(([^)]+)\)/)[1].split(',').map(s => s.trim().replace(/'/g, ''));
    deq(chk, SPEC_OUTCOMES);
    assert(/CHECK \(mode = 'REVIEW'\)/.test(A.DDL));
    for (const f of ['apply', 'dismiss', 'autoAdmit', 'commit']) assert.strictEqual(A[f], undefined, f + ' must not exist in step 1');
    // outcome strings outside the enum never appear as an outcome in the code
    for (const bad of ['NEW', 'UPDATE', 'SUPERSEDE', 'CONFLICT', 'RELATE', 'REJECT', 'HOLD', 'ACCEPT']) assert(!new RegExp(`res\\('${bad}'`).test(ADMJS), bad);
    assert(!/\b(AUTONOMOUS|BACKGROUND_ADMIT|AUTO_PROMOTE|AUTO_MERGE)\b/.test(ADMJS.replace(/no AUTO\/AUTONOMOUS\/BACKGROUND_ADMIT\/AUTO_PROMOTE\/AUTO_MERGE|There is no AUTO \/ AUTONOMOUS \/ BACKGROUND_ADMIT \/ AUTO_PROMOTE \/ AUTO_MERGE/g, '')), 'auto modes must only be mentioned as rejected');
  });

  await T('zw-static', 'static: no SQL write to wiz_ref_*; NO call to any WizRef function that takes a db (search/trace/initSchema/importJSONL/clearAll/… all reach WizRef.initSchema); only db.run statements are staging DDL/INSERT, BEGIN/COMMIT/ROLLBACK, the read-only savepoint and PRAGMA query_only', async () => {
    const code = ADMJS.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const writes = code.split('\n').filter(l => /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i.test(l) && /wiz_ref/.test(l));
    deq(writes, []);
    // every WizRef function that takes a db calls initSchema (migrations / backfill / FTS repair / pin repair)
    const refFns = [...REFJS.matchAll(/^\s*(?:async\s+)?function\s+(\w+)\s*\(\s*db\b/gm)].map(m => m[1]);
    for (const f of ['search', 'trace', 'initSchema', 'importJSONL', 'clearAll', 'getSource', 'project', 'resolveRelation', 'stats', 'exportJSONL']) assert(refFns.includes(f), 'expected WizRef db function ' + f);
    for (const f of refFns) assert(!new RegExp(`\\b(W|WizRef|WizRefApi\\(\\))\\.${f}\\s*\\(`).test(code), `admission module must not call WizRef.${f}(db, …)`);
    const used = [...new Set((code.match(/\b(?:W|WizRef|WizRefApi\(\))\.(\w+)\s*\(/g) || []).map(s => s.replace(/\s*\($/, '').split('.').pop()))].sort();
    deq(used, ['sha256Hex']); // pure hash helper, no db argument:
    const sha = REFJS.slice(REFJS.indexOf('async function sha256Hex('), REFJS.indexOf('// ── Importer'));
    assert(sha.length > 50 && !/\bdb\b|initSchema/.test(sha), 'WizRef.sha256Hex must not touch the database');
    const runs = (code.match(/db\.run\(([^;]*)/g) || []).map(x => x.slice(0, 70));
    for (const r of runs) assert(/^db\.run\((DDL\)|DDL_INDEX\)|'BEGIN'\)|'COMMIT'\)|'ROLLBACK'\)|'PRAGMA query_only=ON'\)|`PRAGMA query_only=\$\{|'SAVEPOINT wiz_adm_readonly'\)|'ROLLBACK TO wiz_adm_readonly'\)|'RELEASE wiz_adm_readonly'\)|`INSERT INTO \$\{TABLE\})/.test(r), 'unexpected db.run: ' + r);
    assert(!/db\.exec\(/.test(code), 'no db.exec in the admission module');
  });

  await T('zw-trace', 'runtime (transitive): during prepare every SQL statement is SELECT / PRAGMA / savepoint control, except the staging INSERT; WizRef db functions are unreachable (a trap throws on any access); no initSchema-signature statement', async () => {
    const app = await seeded();
    const realW = app.ctx.WizRef;
    app.ctx.WizRef = new Proxy(realW, { get(t, k) { if (typeof t[k] === 'function' && k !== 'sha256Hex') throw new Error('TRAP: WizRef.' + String(k) + ' accessed'); return t[k]; } });
    const log = [];
    const spy = new Proxy(app.db, { get(t, k) { const v = t[k]; if (['run', 'exec', 'prepare'].includes(k)) return (sql, ...a) => { log.push(String(sql).replace(/\s+/g, ' ').trim()); return v.call(t, sql, ...a); }; return typeof v === 'function' ? v.bind(t) : v; } });
    const ref0 = refDump(app.db);
    for (const inc of [INC.valid_new, INC.ambiguous, INC.similar_not_identical]) { const r = await app.A.prepare(spy, clone(inc)); assert(r.ok); }
    const hc = app.A.hostCallerContext('USER');
    const v = realW.trace(app.db, 'fx:adm:cache-cold').version_id; // (test-side read on the unwrapped W, outside prepare)
    const r2 = await app.A.prepare(spy, Object.assign(clone(INC.similar_not_identical), { EQUIVALENT_TO: { version_id: v, declared_by: 'USER', basis: 'b' } }), { caller: hc });
    assert.strictEqual(r2.packet.proposed_outcome, 'DUPLICATE');
    app.ctx.WizRef = realW;
    assert(log.length > 20);
    const ok = l => /^(SELECT|PRAGMA table_info\(|PRAGMA query_only|SAVEPOINT wiz_adm_readonly$|ROLLBACK TO wiz_adm_readonly$|RELEASE wiz_adm_readonly$|BEGIN$|COMMIT$|ROLLBACK$)/.test(l)
      || /^CREATE (TABLE|INDEX) IF NOT EXISTS (wiz_admission_reviews|idx_wiz_admission_reviews_state)/.test(l) || /^INSERT INTO wiz_admission_reviews\(/.test(l);
    const bad = log.filter(l => !ok(l)); deq(bad, []);
    assert(!log.some(l => /CREATE (TABLE|VIRTUAL TABLE|INDEX) IF NOT EXISTS wiz_ref/.test(l)), 'initSchema signature seen');
    assert.strictEqual(refDump(app.db), ref0);
    fs.writeFileSync(path.join(require('os').tmpdir(), 'admission-zw-trace.log'), [...new Set(log.map(l => l.slice(0, 90)))].join('\n'));
  });

  // exact v2 wiz_ref schema (as shipped at b2c7e34; same construction as refmem test P1-5c)
  function buildV2(SQL) {
    const old = new SQL.Database();
    const cap = ['source_title', 'source_surface', 'source_kind', 'source_authority_class', 'source_revision', 'source_as_of', 'source_currentness', 'source_content_hash'].map(f => f + '_at_capture TEXT').join(', ');
    old.run(`CREATE TABLE wiz_ref_meta (key TEXT PRIMARY KEY, value TEXT)`); old.run(`INSERT INTO wiz_ref_meta VALUES('schema_version','2')`);
    old.run(`CREATE TABLE wiz_ref_sources (source_id TEXT PRIMARY KEY, title TEXT NOT NULL, surface TEXT NOT NULL, source_kind TEXT NOT NULL, authority_class TEXT, project_id TEXT, locator TEXT, revision TEXT, as_of TEXT, currentness TEXT, privacy TEXT DEFAULT 'private', content_hash TEXT, seed_id TEXT, first_seed_version TEXT, last_seed_version TEXT, record_hash TEXT, imported_at INTEGER)`);
    old.run(`CREATE TABLE wiz_ref_items (item_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, project_id TEXT, item_type TEXT NOT NULL, claim TEXT NOT NULL, source_section TEXT, source_status TEXT, epistemic_state TEXT, authority_scope TEXT, validity TEXT, confidence REAL, as_of TEXT, supersedes_item_id TEXT, created_at INTEGER, provenance TEXT, lifecycle TEXT DEFAULT 'ACTIVE', superseded_by TEXT, record_hash TEXT, seed_id TEXT, first_seed_version TEXT, last_seed_version TEXT, ${cap}, capture_backfilled INTEGER DEFAULT 0)`);
    old.run(`CREATE TABLE wiz_ref_relations (relation_id TEXT PRIMARY KEY, from_item_id TEXT NOT NULL, to_item_id TEXT NOT NULL, relation_type TEXT NOT NULL, epistemic_status TEXT NOT NULL, source_id TEXT, scope TEXT, rationale TEXT, seed_id TEXT, created_at INTEGER, record_hash TEXT)`);
    old.run(`CREATE VIRTUAL TABLE wiz_ref_items_fts USING fts5(item_id UNINDEXED, claim, project_id, item_type, tokenize='unicode61')`);
    old.run(`INSERT INTO wiz_ref_sources(source_id,title,surface,source_kind,authority_class,revision) VALUES('fx:src:v2','[SYNTHETIC FIXTURE] v2 source','fixture','RESEARCH','RESEARCH_SYNTHESIS','A')`);
    old.run(`INSERT INTO wiz_ref_items(item_id,source_id,project_id,item_type,claim,epistemic_state,lifecycle) VALUES('fx:v2:a','fx:src:v2','demo-project-adm','HYPOTHESIS','[SYNTHETIC FIXTURE] The demo cache layer reduces cold start latency of the demo widget.','SOURCE_ASSERTION','ACTIVE'),('fx:v2:b','fx:src:v2','demo-project-adm','HYPOTHESIS','[SYNTHETIC FIXTURE] v2 item b','SOURCE_ASSERTION','ACTIVE')`);
    // only one of the two items is in the FTS index; relation has no record_hash and no pins
    old.run(`INSERT INTO wiz_ref_items_fts(item_id,claim,project_id,item_type) VALUES('fx:v2:b','[SYNTHETIC FIXTURE] v2 item b','demo-project-adm','HYPOTHESIS')`);
    old.run(`INSERT INTO wiz_ref_relations(relation_id,from_item_id,to_item_id,relation_type,epistemic_status) VALUES('fx:v2:R','fx:v2:a','fx:v2:b','RELATED_TO','SOURCE_ASSERTION')`);
    return old;
  }

  await T('ro-legacy', 'P1-1(a) legacy v2 reference DB (never migrated) → prepare → wiz_ref_* byte/row-identical (schema_version still 2, no v3 columns, no pins, no capture backfill, FTS not repaired); UNCERTAIN + "needs migration/repair" warning; review staged', async () => {
    const { A, W } = await bootApp();
    const SQL = await initSqlJs({ wasmBinary: WASM });
    const db = buildV2(SQL);
    const ref0 = refDump(db);
    const r = await A.prepare(db, clone(INC.exact_duplicate));
    assert(r.ok, JSON.stringify(r.errors));
    assert.strictEqual(refDump(db), ref0, 'legacy wiz_ref_* changed');
    assert.strictEqual(q1(db, "SELECT value FROM wiz_ref_meta WHERE key='schema_version'"), '2');
    assert(!db.exec('PRAGMA table_info(wiz_ref_items)')[0].values.some(c => c[1] === 'version_id'), 'v3 column added');
    assert.strictEqual(q1(db, "SELECT count(*) FROM wiz_ref_meta WHERE key LIKE 'migrated_from%'"), 0);
    assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_ref_items_fts'), 1);
    const p = r.packet;
    assert.strictEqual(p.proposed_outcome, 'UNCERTAIN'); assert.strictEqual(p.reference_memory.state, 'NEEDS_MIGRATION');
    assert(p.warnings.some(w => /needs migration\/repair/.test(w) && /retrieval is read-only/.test(w)), JSON.stringify(p.warnings));
    deq(p.candidate_matches, []); deq(p.write_plan.writes, []);
    assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_admission_reviews'), 1);
    // control: the WizRef read path WOULD have migrated this DB (the hazard fixed in audit rev 1)
    const ctl = new SQL.Database(db.export()); W.search(ctl, 'cache');
    assert.strictEqual(q1(ctl, "SELECT value FROM wiz_ref_meta WHERE key='schema_version'"), '3', 'control: WizRef.search migrates');
  });

  await T('ro-fts', 'P1-1(b) v3 DB with a missing FTS derived row → prepare → wiz_ref_* unchanged (FTS NOT repaired); NEEDS_REPAIR → UNCERTAIN with warning', async () => {
    const { db, A, W } = await seeded();
    db.run("DELETE FROM wiz_ref_items_fts WHERE item_id='fx:adm:cache-cold'"); // test setup: simulate a repair-needed DB
    const ref0 = refDump(db);
    const r = await A.prepare(db, clone(INC.similar_not_identical));
    assert.strictEqual(refDump(db), ref0, 'wiz_ref_* changed (FTS repaired?)');
    assert.strictEqual(q1(db, "SELECT count(*) FROM wiz_ref_items_fts WHERE item_id='fx:adm:cache-cold'"), 0);
    assert.strictEqual(r.packet.reference_memory.state, 'NEEDS_REPAIR');
    assert(r.packet.reference_memory.issues.some(i => /missing from wiz_ref_items_fts/.test(i)));
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN');
    assert(r.packet.warnings.some(w => /needs migration\/repair/.test(w)));
    // control: WizRef.search on a copy repairs the FTS row (the hazard)
    const SQL = await initSqlJs({ wasmBinary: WASM }); const ctl = new SQL.Database(db.export()); W.search(ctl, 'cache');
    assert.strictEqual(q1(ctl, "SELECT count(*) FROM wiz_ref_items_fts WHERE item_id='fx:adm:cache-cold'"), 1, 'control: WizRef.search repairs FTS');
  });

  await T('ro-inject', 'P1-1(c) injected zero-write violation during retrieval → prepare throws; NO row in wiz_admission_reviews; wiz_ref_* unchanged (both guard layers: query_only refusal, and savepoint rollback + snapshot mismatch)', async () => {
    const { db, A } = await seeded();
    const ref0 = refDump(db);
    const evil = hook => { let fired = false; return new Proxy(db, { get(t, k) { const v = t[k];
      if (k === 'prepare') return (sql, ...a) => { if (!fired && /MATCH/.test(sql)) { fired = true; hook(t); } return v.call(t, sql, ...a); };
      return typeof v === 'function' ? v.bind(t) : v; } }); };
    const tamper = "UPDATE wiz_ref_items SET claim = claim || ' [tampered]' WHERE item_id='fx:adm:cache-cold'";
    // layer 1: a write during the read-only phase is refused by SQLite (PRAGMA query_only)
    await assert.rejects(A.prepare(evil(t => t.run(tamper)), clone(INC.ambiguous)), /ZERO-WRITE GUARD.*readonly/);
    assert.strictEqual(refDump(db), ref0); assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_admission_reviews'), 0);
    // layer 2: even a hook that switches query_only OFF and writes is rolled back (savepoint) and detected (snapshot)
    await assert.rejects(A.prepare(evil(t => { t.run('PRAGMA query_only=OFF'); t.run(tamper); }), clone(INC.ambiguous)), /ZERO-WRITE VIOLATION/);
    assert.strictEqual(refDump(db), ref0, 'tamper must be rolled back'); assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_admission_reviews'), 0);
    assert.strictEqual(q1(db, 'PRAGMA query_only'), 0, 'query_only restored');
    // the DB is still usable afterwards: a normal prepare stages exactly one review
    assert((await A.prepare(db, clone(INC.ambiguous))).ok); assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_admission_reviews'), 1);
  });

  await T('schema', 'additive migration: boot creates only wiz_admission_reviews (+ index), idempotent; existing DB from main migrates without touching wiz_ref_* / wiz_facts', async () => {
    const old = await bootApp(null, { withAdmission: false }); // main@2bad547 boot path
    await old.W.importJSONL(old.db, BASE); old.ctx.wizMemAdd('personal fact kept', 'general', 'user');
    const bytes = old.db.export();
    const beforeRef = refDump(old.db), beforePers = personalDump(old.db);
    const objs = db => db.exec("SELECT type||':'||name FROM sqlite_master ORDER BY 1")[0].values.flat();
    const app = await bootApp(bytes); // new boot with admission module → _wizInitMemSchema hook
    const added = objs(app.db).filter(n => !objs(old.db).includes(n));
    deq(added, ['index:idx_wiz_admission_reviews_state', 'index:sqlite_autoindex_wiz_admission_reviews_1', 'table:wiz_admission_reviews']); // autoindex = implicit PRIMARY KEY index
    assert.strictEqual(refDump(app.db), beforeRef); assert.strictEqual(personalDump(app.db), beforePers);
    const snap = JSON.stringify(app.db.exec("SELECT sql FROM sqlite_master WHERE name LIKE 'wiz_adm%'"));
    app.A.initSchema(app.db); app.A.initSchema(app.db);
    assert.strictEqual(JSON.stringify(app.db.exec("SELECT sql FROM sqlite_master WHERE name LIKE 'wiz_adm%'")), snap);
    assert.strictEqual(q1(app.db, 'SELECT count(*) FROM wiz_admission_reviews'), 0);
    // constraints: bad outcome / mode / state are refused by the table itself
    for (const [col, val] of [['proposed_outcome', 'NEW'], ['mode', 'AUTO'], ['review_state', 'VERIFIED']]) {
      const v = { proposed_outcome: 'UNCERTAIN', mode: 'REVIEW', review_state: 'AWAITING_REVIEW' }; v[col] = val;
      assert.throws(() => app.db.run("INSERT INTO wiz_admission_reviews(review_id,created_at,mode,incoming_json,candidate_json,proposed_outcome,rationale,affected_records_json,write_plan_json,review_state,packet_json) VALUES('x',1,?,'{}','[]',?,'r','[]','{}',?,'{}')", [v.mode, v.proposed_outcome, v.review_state]), /CHECK constraint failed/);
    }
  });

  await T('A1', 'prepare(valid incoming) → wiz_ref_* identical before/after (independent full dump + module fingerprint); review staged with review_state=AWAITING_REVIEW; packet has all mandatory fields', async () => {
    const { db, A } = await seeded();
    const ref0 = refDump(db), pers0 = personalDump(db);
    const r = await A.prepare(db, clone(INC.valid_new));
    assert(r.ok, JSON.stringify(r.errors));
    assert.strictEqual(refDump(db), ref0, 'wiz_ref_* changed'); assert.strictEqual(personalDump(db), pers0, 'personal memory changed');
    const p = r.packet;
    assert(p.ref_fingerprint.unchanged && p.ref_fingerprint.before === p.ref_fingerprint.after && /^sha256:/.test(p.ref_fingerprint.before));
    for (const f of ['mode', 'incoming', 'candidate_matches', 'proposed_outcome', 'reason', 'affected_records', 'proposed_relations', 'proposed_status_effect', 'provenance', 'warnings', 'write_plan', 'state']) assert(f in p, f);
    assert.strictEqual(p.mode, 'REVIEW'); assert.strictEqual(p.state, 'AWAITING_REVIEW');
    assert(A.OUTCOMES.includes(p.proposed_outcome) && p.reason && Array.isArray(p.affected_records) && p.provenance.passport);
    assert.strictEqual(p.write_plan.executes, false);
    const g = A.getReview(db, r.review_id);
    assert.strictEqual(g.review_state, 'AWAITING_REVIEW'); assert.strictEqual(g.mode, 'REVIEW'); assert.strictEqual(g.reviewed_at, null);
    deq(g.packet, p);
    deq(A.listPending(db).map(x => x.review_id), [r.review_id]);
    fs.writeFileSync(path.join(require('os').tmpdir(), 'admission-A1-packet.json'), JSON.stringify(p, null, 2));
  });

  await T('A2', 'two semantically similar, non-identical synthetic claims → NOT DUPLICATE; UNCERTAIN (no hard identity), similar record shown as ranked candidate only', async () => {
    const { db, A } = await seeded();
    const ref0 = refDump(db);
    const r = await A.prepare(db, clone(INC.similar_not_identical));
    assert(r.ok);
    assert.notStrictEqual(r.packet.proposed_outcome, 'DUPLICATE');
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN');
    const c = r.packet.candidate_matches.find(x => x.item_id === 'fx:adm:cache-cold');
    assert(c, 'similar record must be retrieved as candidate');
    assert.strictEqual(c.deterministic.identical_claim_text, false); assert.strictEqual(c.deterministic.same_logical_item, false);
    assert(/RANK ONLY/.test(c.similarity.note));
    for (const k of ['item_id', 'logical_item_id', 'version_id', 'claim', 'item_type', 'epistemic_state', 'source', 'lifecycle', 'relations', 'block']) assert(k in c, k);
    assert(c.block.startsWith('[REFERENCE MEMORY') && /source \(at capture\)/.test(c.block), 'candidates carry provenance blocks, never bare claims');
    assert.strictEqual(c.source.revision, 'fx-adm-rev-1'); assert.strictEqual(r.packet.reference_memory.state, 'READY');
    deq(r.packet.write_plan.writes, []);
    assert.strictEqual(refDump(db), ref0);
  });

  await T('A3', 'P1-2 DUPLICATE only on exact ITEM_ID + compatible exact content (claim/type/scope/source/status/WHEN/PROVENANCE/source revision+as_of+content_hash vs CAPTURE provenance); identical text WITHOUT identity → UNCERTAIN; any differing WHEN / PROVENANCE / revision / as_of → NOT DUPLICATE. [apply part of A3 deferred to step 2]', async () => {
    const { db, A, W } = await seeded();
    assert((await W.importJSONL(db, DUPFX)).committed); // test setup through the existing Reference Memory import
    const ref0 = refDump(db);
    // positive: exact ITEM_ID + exact compatible content (whitespace-normalized claim, provenance key order irrelevant)
    let r = await A.prepare(db, clone(INC.exact_duplicate));
    assert.strictEqual(r.packet.proposed_outcome, 'DUPLICATE', r.packet.reason + JSON.stringify(r.packet.warnings));
    assert.strictEqual(r.packet.decision_basis, 'EXACT_IDENTITY_AND_CONTENT');
    assert.strictEqual(r.packet.affected_records[0].logical_item_id, 'fx:adm:dup-target');
    deq(r.packet.write_plan.writes, []);
    fs.writeFileSync(path.join(require('os').tmpdir(), 'admission-A3-duplicate.json'), JSON.stringify(r.packet, null, 2));
    // identical text WITHOUT ITEM_ID → UNCERTAIN (was DUPLICATE before audit rev 1)
    const noId = clone(INC.exact_duplicate); delete noId.ITEM_ID;
    r = await A.prepare(db, noId);
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN'); assert(/identical claim text without deterministic identity/.test(r.packet.reason));
    assert.strictEqual(r.packet.affected_records[0].logical_item_id, 'fx:adm:dup-target');
    // same ITEM_ID + same claim/source/status but ONE differing capture field → NOT DUPLICATE (field named in warning)
    const variants = {
      when: x => { x.WHEN = '2026-09-21'; },
      provenance: x => { x.PROVENANCE = { method: 'synthetic test fixture', captured_by: 'someone-else' }; },
      source_revision: x => { x.SOURCE.revision = 'fx-adm-rev-8'; },
      source_as_of: x => { x.SOURCE.as_of = '2026-09-19'; },
      source_content_hash: x => { x.SOURCE.content_hash = 'sha256:00'; },
      source_id: x => { x.SOURCE.source_id = 'fx:adm:src-a'; },
      status: x => { x.STATUS = 'CANDIDATE'; },
    };
    for (const [field, mut] of Object.entries(variants)) {
      const x = clone(INC.exact_duplicate); mut(x);
      r = await A.prepare(db, x);
      assert.notStrictEqual(r.packet.proposed_outcome, 'DUPLICATE', field);
      assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', field);
      assert(r.packet.warnings.some(w => w.includes('NOT a duplicate') && w.includes(field)), field + ': ' + JSON.stringify(r.packet.warnings));
    }
    // stored item WITHOUT capture provenance match (base fixture item has no provenance) → NOT DUPLICATE even with ITEM_ID + same text
    r = await A.prepare(db, Object.assign(clone(INC.exact_duplicate), { ITEM_ID: 'fx:adm:cache-cold', WHAT: '[SYNTHETIC FIXTURE] The demo cache layer reduces cold start latency of the demo widget.', SOURCE: { source_id: 'fx:adm:src-a', surface: 'fixture', title: 't', revision: 'fx-adm-rev-1', as_of: '2026-09-25' }, WHEN: '2026-09-25' }));
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN'); assert(r.packet.warnings.some(w => /differs in: provenance/.test(w)), JSON.stringify(r.packet.warnings));
    for (const f of ['claim', 'item_type', 'scope', 'source_id', 'status', 'when', 'provenance', 'source_revision', 'source_as_of', 'source_content_hash']) assert(A.DUPLICATE_MATCH_FIELDS.includes(f), f);
    assert.strictEqual(refDump(db), ref0);
  });

  await T('P1-3', 'authority spoof: declared_by / authority in the passport never authorise themselves — DUPLICATE via EQUIVALENT_TO and STATUS_CHANGE authority need a matching TRUSTED caller context (minted by the host, not the JSON) and a non-model WHO', async () => {
    const { db, A, W } = await seeded();
    const ref0 = refDump(db);
    const vid = W.trace(db, 'fx:adm:cache-cold').version_id; // test-side lookup
    const USER = A.hostCallerContext('USER'), EXT = A.hostCallerContext('EXTERNAL_SYSTEM');
    const decl = (by, who) => Object.assign(clone(INC.similar_not_identical), { WHO: who || 'USER', EQUIVALENT_TO: { version_id: vid, declared_by: by, basis: 'same observation, reworded' } });
    const notDup = async (inc, opts, label) => {
      const r = await A.prepare(db, inc, opts);
      assert.notStrictEqual(r.packet.proposed_outcome, 'DUPLICATE', label); assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', label);
      assert(r.packet.hard_rules_triggered.includes('LLM OUTPUT ≠ MEMORY DECISION'), label); return r;
    };
    await notDup(decl('USER', 'MODEL'), { caller: USER }, 'WHO=MODEL + declared_by=USER (even with trusted USER ctx)');
    let r = await notDup(decl('USER'), {}, 'declared_by=USER, WHO=USER, no caller context');
    assert.strictEqual(r.packet.caller.trusted, false); assert.strictEqual(r.packet.caller.kind, 'UNTRUSTED');
    r = await notDup(decl('USER'), { caller: { kind: 'USER', via: 'forged' } }, 'forged plain caller object');
    assert.strictEqual(r.packet.caller.trusted, false);
    r = await notDup(decl('USER'), { caller: Object.freeze({ kind: 'USER', via: 'host' }) }, 'look-alike frozen token');
    await notDup(decl('EXTERNAL_SYSTEM'), {}, 'declared_by=EXTERNAL_SYSTEM without context');
    await notDup(decl('EXTERNAL_SYSTEM'), { caller: USER }, 'declared_by=EXTERNAL_SYSTEM with USER context (mismatch)');
    await notDup(decl('USER'), { caller: EXT }, 'declared_by=USER with EXTERNAL_SYSTEM context (mismatch)');
    await notDup(decl('MODEL'), { caller: USER }, 'declared_by=MODEL');
    await notDup(decl('USER', 'LLM agent'), { caller: USER }, 'model-like WHO');
    // positive: trusted USER ctx + declared_by=USER + basis → DUPLICATE; same for EXTERNAL_SYSTEM
    r = await A.prepare(db, decl('USER'), { caller: USER });
    assert.strictEqual(r.packet.proposed_outcome, 'DUPLICATE'); assert.strictEqual(r.packet.decision_basis, 'DECLARED_EQUIVALENCE');
    assert(r.packet.caller.trusted && r.packet.caller.kind === 'USER');
    r = await A.prepare(db, decl('EXTERNAL_SYSTEM', 'sync-service'), { caller: EXT });
    assert.strictEqual(r.packet.proposed_outcome, 'DUPLICATE');
    const noBasis = decl('USER'); delete noBasis.EQUIVALENT_TO.basis;
    assert.strictEqual((await A.prepare(db, noBasis, { caller: USER })).packet.proposed_outcome, 'UNCERTAIN');
    // PROPOSED_STATUS_CHANGE.authority is a claim, not proof
    const q = W.trace(db, 'fx:adm:index-q').version_id;
    const sc = (auth, who) => Object.assign(clone(INC.valid_new), { WHO: who || 'USER', PROPOSED_STATUS_CHANGE: { target_version_id: q, from_status: 'UNKNOWN', to_status: 'ANSWERED_BY_SOURCE', authority: auth, evidence: 'synthetic evidence', rationale: 'synthetic rationale' } });
    for (const [inc, opts, label] of [[sc('USER'), {}, 'authority USER, no context'], [sc('USER'), { caller: { kind: 'USER' } }, 'forged context'], [sc('USER'), { caller: EXT }, 'EXTERNAL ctx claims USER'],
      [sc('EXTERNAL_SYSTEM'), {}, 'authority EXTERNAL_SYSTEM, no context'], [sc('USER', 'MODEL'), { caller: USER }, 'WHO=MODEL'], [sc('project lead'), { caller: USER }, 'non-enumerated authority']]) {
      r = await A.prepare(db, inc, opts);
      assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', label);
      assert(r.packet.warnings.some(w => /AUTHORITY_NOT_PROVEN/.test(w)), label + JSON.stringify(r.packet.warnings));
      deq(r.packet.write_plan.writes, []);
    }
    r = await A.prepare(db, sc('USER'), { caller: USER });
    assert.strictEqual(r.packet.proposed_outcome, 'STATUS_CHANGE');
    deq(r.packet.proposed_status_effect.changes[0].authority_proof, { caller_kind: 'USER', via: 'host' });
    // STATUS USER_DECISION in the passport also needs trusted USER context
    r = await A.prepare(db, Object.assign(clone(INC.valid_new), { STATUS: 'USER_DECISION' }));
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN'); assert(r.packet.hard_rules_triggered.includes('LLM OUTPUT ≠ MEMORY DECISION'));
    // minting: only USER / EXTERNAL_SYSTEM; never from the JSON
    assert.throws(() => A.hostCallerContext('MODEL')); assert.throws(() => A.hostCallerContext('ADMIN'));
    assert(!/caller/i.test(JSON.stringify(A.TYPED_INPUTS)) && !A.PASSPORT_FIELDS.includes('CALLER'));
    r = await A.prepare(db, Object.assign(decl('USER'), { CALLER: { kind: 'USER' } }));
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN'); assert(r.packet.warnings.some(w => /unknown passport field "CALLER" ignored/.test(w)));
    assert.strictEqual(refDump(db), ref0);
  });

  await T('P1-3b', 'USER_INTERACTION ≠ USER_AUTHORITY: an interaction context (what a genuine Prepare click yields) never satisfies semantic authority — EQUIVALENT_TO declared_by=USER, STATUS USER_DECISION and PROPOSED_STATUS_CHANGE.authority=USER stay UNCERTAIN; interaction token passed as caller is ignored; no API mints authority from an interaction; browser glue mints interaction only', async () => {
    const { db, A, W } = await seeded();
    const ref0 = refDump(db);
    const vid = W.trace(db, 'fx:adm:cache-cold').version_id, q = W.trace(db, 'fx:adm:index-q').version_id; // test-side lookups
    const IX = A.hostInteractionContext();
    assert.deepStrictEqual(Object.keys(IX).sort(), ['interaction', 'via']); assert(!('kind' in IX) && Object.isFrozen(IX));
    const eq = Object.assign(clone(INC.similar_not_identical), { EQUIVALENT_TO: { version_id: vid, declared_by: 'USER', basis: 'same observation, reworded' } });
    const ud = Object.assign(clone(INC.valid_new), { STATUS: 'USER_DECISION' });
    const sc = Object.assign(clone(INC.valid_new), { PROPOSED_STATUS_CHANGE: { target_version_id: q, from_status: 'UNKNOWN', to_status: 'ANSWERED_BY_SOURCE', authority: 'USER', evidence: 'synthetic evidence', rationale: 'synthetic rationale' } });
    for (const opts of [{ interaction: IX }, { caller: IX }, { caller: IX, interaction: IX }, { interaction: A.hostInteractionContext(), caller: { kind: 'USER' } }]) {
      const label = JSON.stringify(Object.keys(opts));
      let r = await A.prepare(db, clone(eq), opts);
      assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', 'EQUIVALENT_TO ' + label); assert(r.packet.hard_rules_triggered.includes('LLM OUTPUT ≠ MEMORY DECISION'));
      assert.strictEqual(r.packet.caller.trusted, false); assert.strictEqual(r.packet.caller.kind, 'UNTRUSTED');
      if (opts.interaction) { assert.strictEqual(r.packet.caller.interaction, 'USER_INTERACTION'); assert(r.packet.warnings.some(w => /user interaction ≠ user authority/.test(w)), JSON.stringify(r.packet.warnings)); }
      r = await A.prepare(db, clone(ud), opts);
      assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', 'USER_DECISION ' + label); assert(r.packet.hard_rules_triggered.includes('LLM OUTPUT ≠ MEMORY DECISION'));
      r = await A.prepare(db, clone(sc), opts);
      assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', 'STATUS_CHANGE ' + label); assert(r.packet.warnings.some(w => /AUTHORITY_NOT_PROVEN/.test(w)));
    }
    // formatted caller line: interaction shown, authority NONE
    const r1 = await A.prepare(db, clone(eq), { interaction: IX });
    assert(A.formatPacket(r1.packet).includes('CALLER CONTEXT: USER_INTERACTION (review initiated by user click; NOT semantic authority) · semantic authority: NONE'));
    // host seam still works (and is labelled as unauthenticated host context); an interaction alongside does not change it
    const r2 = await A.prepare(db, clone(eq), { caller: A.hostCallerContext('USER'), interaction: IX });
    assert.strictEqual(r2.packet.proposed_outcome, 'DUPLICATE'); assert(/module does not authenticate the host/.test(A.formatPacket(r2.packet)));
    // static: the browser glue can only mint interaction; authority minting is reachable only via the non-DOM host seam
    const code = ADMJS.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const glue = code.slice(code.indexOf('if (IS_DOM) {\n    const db'));
    assert(glue.length > 1000 && !/_mintAuthority\(|hostCallerContext|opts\.caller\s*=/.test(glue), 'browser glue must not mint or set authority');
    assert(/_mintInteraction\('ui-click:#wizAdmPrepareBtn'\)/.test(glue));
    deq(code.match(/_mintAuthority\(/g).length, 2); // definition + the single non-DOM hostCallerContext seam
    assert(/if \(!IS_DOM\) \{\n\s*api\.hostCallerContext = kind => _mintAuthority\(/.test(code));
    assert(!/_authTokens\.add\(/.test(code.slice(code.indexOf('function _mintInteraction'), code.indexOf('function callerOf'))), 'interaction minting never adds to the authority set');
    assert.strictEqual(refDump(db), ref0);
  });

  await T('A10', 'incoming scope differs from controller review scope → OUT_OF_SCOPE, no candidates, empty write plan, no ref write', async () => {
    const { db, A } = await seeded();
    const ref0 = refDump(db);
    const r = await A.prepare(db, clone(INC.out_of_scope), { review_scope: { project_ids: ['demo-project-adm'] } });
    assert.strictEqual(r.packet.proposed_outcome, 'OUT_OF_SCOPE');
    deq(r.packet.candidate_matches, []); deq(r.packet.write_plan.writes, []);
    assert.strictEqual(r.packet.state, 'AWAITING_REVIEW');
    assert.strictEqual(refDump(db), ref0);
    // same incoming inside the scope is not OUT_OF_SCOPE
    const inScope = await A.prepare(db, clone(INC.valid_new), { review_scope: { project_ids: ['demo-project-adm'] } });
    assert.notStrictEqual(inScope.packet.proposed_outcome, 'OUT_OF_SCOPE');
  });

  await T('A11', 'ambiguous candidate set → UNCERTAIN + AWAITING_REVIEW, nothing auto-added (item count unchanged)', async () => {
    const { db, A } = await seeded();
    const ref0 = refDump(db), n0 = q1(db, 'SELECT count(*) FROM wiz_ref_items');
    const r = await A.prepare(db, clone(INC.ambiguous));
    assert(r.packet.candidate_matches.length >= 2, 'expected an ambiguous candidate set');
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN');
    assert(/ambiguous candidate set/.test(r.packet.reason));
    assert.strictEqual(A.getReview(db, r.review_id).review_state, 'AWAITING_REVIEW');
    deq(r.packet.write_plan.writes, []);
    assert.strictEqual(q1(db, 'SELECT count(*) FROM wiz_ref_items'), n0); assert.strictEqual(refDump(db), ref0);
  });

  await T('passport', 'invalid passport / non-REVIEW mode → ok:false, nothing staged, database byte-identical', async () => {
    const { db, A } = await seeded();
    const all0 = Buffer.from(db.export()).toString('base64');
    const bad = clone(INC.valid_new); delete bad.PROVENANCE; delete bad.SOURCE;
    let r = await A.prepare(db, bad);
    assert(!r.ok && r.errors.some(e => /PROVENANCE/.test(e)) && r.errors.some(e => /SOURCE/.test(e)));
    r = await A.prepare(db, Object.assign(clone(INC.valid_new), { MODE: 'AUTO' }));
    assert(!r.ok && /REVIEW is the only mode/.test(r.errors.join(' ')));
    r = await A.prepare(db, clone(INC.valid_new), { mode: 'AUTO_MERGE' });
    assert(!r.ok);
    r = await A.prepare(db, Object.assign(clone(INC.valid_new), { TYPE: 'NOT_A_TYPE' }));
    assert(!r.ok);
    assert.strictEqual(Buffer.from(db.export()).toString('base64'), all0);
    for (const f of ['WHAT', 'SOURCE', 'WHO', 'WHEN', 'SCOPE', 'TYPE', 'STATUS', 'PROVENANCE']) assert(A.REQUIRED_FIELDS.includes(f));
  });

  await T('HR', 'hard rules (decision side, step 1): VERIFIED-like incoming, UNKNOWN→FALSE, CANDIDATE→VERIFIED, RESEARCH_RESULT→PROD_AUTH, MODEL_PROPOSAL→USER_DECISION → UNCERTAIN (blocked), no write plan; similarity never sets REFINEMENT', async () => {
    const { db, A, W } = await seeded();
    const ref0 = refDump(db);
    const ver = id => W.trace(db, id).version_id;
    const blocked = async (inc, re) => { const r = await A.prepare(db, inc); assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN', JSON.stringify(r.packet.reason)); assert(r.packet.hard_rules_triggered.some(h => re.test(h)), JSON.stringify(r.packet.hard_rules_triggered)); deq(r.packet.write_plan.writes, []); };
    await blocked(Object.assign(clone(INC.valid_new), { STATUS: 'VERIFIED' }), /↛ VERIFIED/);
    const sc = (target, from, to, extra) => Object.assign(clone(INC.valid_new), { PROPOSED_STATUS_CHANGE: Object.assign({ target_version_id: target, from_status: from, to_status: to, authority: 'USER', evidence: 'synthetic evidence', rationale: 'synthetic rationale' }, extra || {}) });
    await blocked(sc(ver('fx:adm:index-q'), 'UNKNOWN', 'FALSE'), /UNKNOWN ↛ FALSE/);
    await blocked(sc(ver('fx:adm:bench'), 'CANDIDATE', 'VERIFIED'), /CANDIDATE ↛ VERIFIED/);
    await blocked(Object.assign(sc(ver('fx:adm:bench'), 'CANDIDATE', 'PROD_AUTH')), /RESEARCH_RESULT ↛ PROD_AUTH/);
    await blocked(Object.assign(sc(ver('fx:adm:index-q'), 'UNKNOWN', 'USER_DECISION'), { WHO: 'MODEL' }), /MODEL_PROPOSAL ↛ USER_DECISION/);
    // status change without basis → UNCERTAIN (not proposed)
    const nb = sc(ver('fx:adm:index-q'), 'UNKNOWN', 'OPEN'); delete nb.PROPOSED_STATUS_CHANGE.evidence;
    assert.strictEqual((await A.prepare(db, nb)).packet.proposed_outcome, 'UNCERTAIN');
    // a well-founded, non-forbidden status change is only PROPOSED (STATUS_CHANGE shows from/to/source/authority/evidence/rationale)
    const ok = await A.prepare(db, sc(ver('fx:adm:index-q'), 'UNKNOWN', 'ANSWERED_BY_SOURCE'), { caller: A.hostCallerContext('USER') }); // authority proven by trusted caller context (P1-3)
    assert.strictEqual(ok.packet.proposed_outcome, 'STATUS_CHANGE');
    const ch = ok.packet.proposed_status_effect.changes[0];
    for (const k of ['from_status', 'proposed_to_status', 'source', 'authority', 'evidence', 'rationale']) assert(ch[k], k);
    assert.strictEqual(refDump(db), ref0, 'no status actually changed');
  });

  await T('WP', 'typed intents produce declarative write plans only (CONTRADICTION → ADD_ITEM + ADD_RELATION CONTRADICTS to the exact version; REFINEMENT → ADD_ITEM_VERSION); zero ref writes', async () => {
    const { db, A, W } = await seeded();
    const ref0 = refDump(db);
    const target = W.trace(db, 'fx:adm:cache-cold').version_id;
    const c = await A.prepare(db, Object.assign(clone(INC.valid_new), { WHAT: '[SYNTHETIC FIXTURE] The demo cache layer does not change cold start latency of the demo widget.', RELATIONS: [{ relation_type: 'CONTRADICTS', target_version_id: target }] }));
    assert.strictEqual(c.packet.proposed_outcome, 'CONTRADICTION');
    deq(c.packet.write_plan.writes.map(w => [w.op, w.relation_type || null, w.target_version_id || null]), [['ADD_ITEM', null, null], ['ADD_RELATION', 'CONTRADICTS', target]]);
    deq(c.packet.proposed_status_effect.changes, []);
    // P1-2: the proposed logical id of a new item is review-derived (random), never derived from the content key
    const c2 = await A.prepare(db, Object.assign(clone(INC.valid_new), { WHAT: '[SYNTHETIC FIXTURE] The demo cache layer does not change cold start latency of the demo widget.', RELATIONS: [{ relation_type: 'CONTRADICTS', target_version_id: target }] }));
    const id1 = c.packet.write_plan.proposed_new_logical_item_id, id2 = c2.packet.write_plan.proposed_new_logical_item_id;
    assert(/^adm:[0-9a-z]+$/.test(id1) && /^adm:[0-9a-z]+$/.test(id2) && id1 !== id2, id1 + ' ' + id2);
    assert.strictEqual(c.packet.write_plan.writes[0].logical_item_id, id1);
    assert(!/sha256Hex\(key\)|content_key_sha256/.test(ADMJS), 'no content-derived id / key hash');
    // ITEM_ID that already exists + ADD_ITEM intent → UNCERTAIN (would collide with the existing logical item)
    const col = await A.prepare(db, Object.assign(clone(INC.valid_new), { ITEM_ID: 'fx:adm:cache-warm', RELATIONS: [{ relation_type: 'CONTRADICTS', target_version_id: target }] }));
    assert.strictEqual(col.packet.proposed_outcome, 'UNCERTAIN'); assert(/would collide/.test(col.packet.reason));
    fs.writeFileSync(path.join(require('os').tmpdir(), 'admission-WP-contradiction.json'), JSON.stringify(c.packet, null, 2));
    const rf = await A.prepare(db, Object.assign(clone(INC.valid_new), { SOURCE: { source_id: 'fx:adm:src-a', surface: 'fixture', title: 't' }, WHAT: '[SYNTHETIC FIXTURE] The demo cache layer reduces cold start latency of the demo widget by caching parsed pages.', REFINES: target }));
    assert.strictEqual(rf.packet.proposed_outcome, 'REFINEMENT');
    deq(rf.packet.write_plan.writes.map(w => [w.op, w.logical_item_id, w.base_version_id]), [['ADD_ITEM_VERSION', 'fx:adm:cache-cold', target]]);
    // evidence without explicit direction/rationale → UNCERTAIN; relation to a non-exact (logical) id → UNCERTAIN
    const ev = await A.prepare(db, Object.assign(clone(INC.valid_new), { RELATIONS: [{ relation_type: 'SUPPORTS', target_version_id: target }] }));
    assert.strictEqual(ev.packet.proposed_outcome, 'UNCERTAIN');
    const lg = await A.prepare(db, Object.assign(clone(INC.valid_new), { RATIONALE: 'r', RELATIONS: [{ relation_type: 'SUPPORTS', target_version_id: 'fx:adm:cache-cold' }] }));
    assert.strictEqual(lg.packet.proposed_outcome, 'UNCERTAIN');
    assert.strictEqual(refDump(db), ref0);
  });

  await T('iso', 'staging is not epistemic memory: staged reviews never appear in ref_search (WizRef.search) or mem_search (wizMemSearch); wiz_facts unchanged', async () => {
    const { db, A, W, ctx } = await seeded();
    const pers0 = personalDump(db);
    await A.prepare(db, clone(INC.valid_new));
    assert.strictEqual(W.search(db, 'exporter writes one file').length, 0);
    const mem = await ctx.wizMemSearch('exporter writes one file');
    assert(!JSON.stringify(mem || []).includes('exporter'), 'staged review leaked into mem_search');
    assert.strictEqual(personalDump(db), pers0);
    assert.strictEqual(q1(db, "SELECT count(*) FROM wiz_facts WHERE claim LIKE '%exporter%'"), 0);
    assert.strictEqual(q1(db, "SELECT count(*) FROM wiz_ref_items WHERE claim LIKE '%exporter%'"), 0);
  });

  await T('persist', 'staged review survives save → reload (SQLite bytes via the awaitable save path → new boot); still AWAITING_REVIEW', async () => {
    const app = await seeded();
    const r = await app.A.prepare(app.db, clone(INC.ambiguous));
    await app.ctx._wizSaveDBAsync();
    const again = await bootApp(app.idb.saved);
    const g = again.A.getReview(again.db, r.review_id);
    assert(g && g.review_state === 'AWAITING_REVIEW' && g.proposed_outcome === 'UNCERTAIN');
    assert.strictEqual(refDump(again.db), refDump(app.db));
  });

  await T('noref', 'database without wiz_ref_* → prepare stages UNCERTAIN and never creates wiz_ref_* tables (WizRef read functions are not called)', async () => {
    const { A } = await bootApp();
    const SQL = await initSqlJs({ wasmBinary: WASM });
    const raw = new SQL.Database();
    const r = await A.prepare(raw, clone(INC.valid_new));
    assert(r.ok && r.packet.proposed_outcome === 'UNCERTAIN' && r.packet.warnings.some(w => /NOT_INITIALISED/.test(w)));
    deq(raw.exec("SELECT name FROM sqlite_master ORDER BY name")[0].values.flat(), ['idx_wiz_admission_reviews_state', 'sqlite_autoindex_wiz_admission_reviews_1', 'wiz_admission_reviews']); // no wiz_ref_* created
  });

  await T('ui/sw', 'sw.js caches wiz-memory-admission.js and CACHE_NAME differs from main; index.html loads it after wiz-ref-memory.js; separate 🧠 card without Apply/Dismiss/Auto-approve; no agent tool / context injection', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert(/BASE_PATH \+ '\/wiz-memory-admission\.js'/.test(sw.slice(sw.indexOf('STATIC_ASSETS'), sw.indexOf('];'))));
    const cur = sw.match(/const CACHE_NAME = '([^']+)'/)[1];
    let mainName = 'eiti-wizard-lab-v1.8.9-refmem3';
    try { mainName = require('child_process').execSync('git show origin/main:sw.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().match(/const CACHE_NAME = '([^']+)'/)[1]; } catch (e) {}
    assert.notStrictEqual(cur, mainName);
    for (const prev of ['eiti-wizard-lab-v1.8.9-admission1', 'eiti-wizard-lab-v1.8.9-admission2']) assert.notStrictEqual(cur, prev, 'CACHE_NAME must be bumped (wiz-memory-admission.js changed in audit rev 1 and 2)');
    assert(/id="wizAdmPrepareBtn" onclick="wizAdmUiPrepare\(event\)"/.test(INDEX), 'Prepare button passes the click event (USER_INTERACTION context only, not authority)');
    const iRef = INDEX.indexOf('<script src="wiz-ref-memory.js"></script>'), iAdm = INDEX.indexOf('<script src="wiz-memory-admission.js"></script>');
    assert(iRef > 0 && iAdm > iRef);
    const card = INDEX.slice(INDEX.indexOf('id="wizAdmCard"'), INDEX.indexOf('id="wizAdmResult"'));
    assert(/🧠 Admission review/.test(card));
    assert(!/Apply|Dismiss|Auto.?approve/i.test(card.replace(/apply\/dismiss/gi, '')), 'no Apply/Dismiss/Auto-approve controls in step 1');
    const refCard = INDEX.slice(INDEX.indexOf('id="wizRefCard"'), INDEX.indexOf('id="wizRefResult"'));
    assert(!/wizAdm/.test(refCard), 'admission must not be mixed into the Reference memory card');
    // no agent tool, no chat/system-prompt use: every index.html reference to the admission layer is the script tag, schema hook, card or render hook
    const lines = INDEX.split('\n').filter(l => /WizAdmission|wizAdm|wiz-memory-admission/.test(l));
    for (const l of lines) assert(/<script src="wiz-memory-admission\.js">|WizAdmission\.initSchema|window\.WizAdmission\)|wizAdmUi|id="wizAdm|typeof wizAdmUiRender/.test(l), 'unexpected admission use: ' + l.trim());
    assert(!/name:\s*'(adm|admission)_/.test(INDEX), 'no admission agent tool');
  });

  const fail = results.filter(r => r[1] !== 'PASS');
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
  process.exit(fail.length ? 1 : 0);
})();

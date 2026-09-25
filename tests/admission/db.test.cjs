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

  await T('zw-static', 'static: wiz-memory-admission.js contains no SQL write to wiz_ref_* and calls no WizRef write function (importJSONL/clearAll/initSchema)', async () => {
    const writes = ADMJS.split('\n').filter(l => /\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i.test(l) && /wiz_ref/.test(l) && !/^\s*\/\//.test(l));
    deq(writes, []);
    assert(!/W\.(importJSONL|clearAll|initSchema)\s*\(|WizRef\.(importJSONL|clearAll|initSchema)\s*\(/.test(ADMJS));
    const sqlWrites = (ADMJS.match(/db\.run\(([^;]*)/g) || []).map(s => s.slice(0, 60));
    for (const s of sqlWrites) assert(/DDL|DDL_INDEX|'BEGIN'|'COMMIT'|'ROLLBACK'|INSERT INTO \$\{TABLE\}/.test(s), 'unexpected db.run: ' + s);
    const used = [...new Set((ADMJS.match(/\bW\.(\w+)\(/g) || []).map(s => s.slice(2, -1)))].sort();
    deq(used, ['search', 'sha256Hex', 'trace']);
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
    assert.strictEqual(c.deterministic.exact_content_key, false);
    assert(/RANK ONLY/.test(c.similarity.note));
    for (const k of ['item_id', 'logical_item_id', 'version_id', 'claim', 'item_type', 'epistemic_state', 'source', 'lifecycle', 'relations', 'block']) assert(k in c, k);
    assert(c.block.startsWith('[REFERENCE MEMORY]'), 'candidates carry provenance blocks, never bare claims');
    deq(r.packet.write_plan.writes, []);
    assert.strictEqual(refDump(db), ref0);
  });

  await T('A3', 'exact same identity/content → DUPLICATE (hard deterministic match; whitespace-normalized); write plan = no ref mutation. [apply part of A3 deferred to step 2]', async () => {
    const { db, A } = await seeded();
    const ref0 = refDump(db);
    let r = await A.prepare(db, clone(INC.exact_duplicate));
    assert.strictEqual(r.packet.proposed_outcome, 'DUPLICATE');
    assert.strictEqual(r.packet.decision_basis, 'EXACT_IDENTITY_AND_CONTENT');
    assert.strictEqual(r.packet.affected_records[0].logical_item_id, 'fx:adm:cache-cold');
    deq(r.packet.write_plan.writes, []);
    // same content without ITEM_ID → still DUPLICATE by exact content key
    const noId = clone(INC.exact_duplicate); delete noId.ITEM_ID;
    r = await A.prepare(db, noId);
    assert.strictEqual(r.packet.proposed_outcome, 'DUPLICATE'); assert.strictEqual(r.packet.decision_basis, 'EXACT_CONTENT_KEY');
    // one differing identity field (source) → NOT duplicate
    const otherSrc = clone(noId); otherSrc.SOURCE = { source_id: 'fx:adm:src-b', surface: 'fixture', title: 'x' };
    assert.notStrictEqual((await A.prepare(db, otherSrc)).packet.proposed_outcome, 'DUPLICATE');
    // equivalence pre-declared by typed external input (USER) → DUPLICATE; declared by a model → ignored
    const vid = (await A.prepare(db, clone(INC.exact_duplicate))).packet.affected_records[0].version_id;
    const decl = clone(INC.similar_not_identical); decl.EQUIVALENT_TO = { version_id: vid, declared_by: 'USER', basis: 'same observation, reworded' };
    r = await A.prepare(db, decl);
    assert.strictEqual(r.packet.proposed_outcome, 'DUPLICATE'); assert.strictEqual(r.packet.decision_basis, 'DECLARED_EQUIVALENCE');
    decl.EQUIVALENT_TO.declared_by = 'MODEL';
    r = await A.prepare(db, decl);
    assert.strictEqual(r.packet.proposed_outcome, 'UNCERTAIN'); assert(r.packet.hard_rules_triggered.includes('LLM OUTPUT ≠ MEMORY DECISION'));
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
    const ok = await A.prepare(db, sc(ver('fx:adm:index-q'), 'UNKNOWN', 'ANSWERED_BY_SOURCE'));
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

// Gate B1 acceptance tests: Working Memory agent READ bridge + Working/Research separation.
// Synthetic data only. No model is invoked (FRESH_MODEL_BEHAVIOR / CROSS_PROVIDER_RESUME are NOT_RUN).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const ROOT = path.resolve(__dirname, '../..');
const initSqlJs = require(path.join(ROOT, 'sql-wasm.js'));
const WASM = fs.readFileSync(path.join(ROOT, 'sql-wasm.wasm'));
const WM = require(path.join(ROOT, 'working-memory.js'));
const Bridge = require(path.join(ROOT, 'wm-agent-read.js'));
const Router = require(path.join(ROOT, 'research-router.js'));
const INDEX_MD = fs.readFileSync(path.join(ROOT, 'docs/research/EXPERIMENT_EVIDENCE_INDEX.md'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NOW = '2026-10-06T12:00:00.000Z';
let SQL, passed = 0, failed = 0;

// A test that never settles must FAIL, not silently end the process with exit code 0.
let completed = false;
process.on('exit', code => { if (!completed && code === 0) { console.log('FAIL  [harness] the suite did not run to completion (a test promise never settled)'); process.exitCode = 3; } });
async function T(id, name, fn) {
  let timer;
  try {
    await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('test timed out after 30s (a promise never settled)')), 30000); })]);
    passed++; console.log(`PASS  [${id}] ${name}`);
  } catch (e) { failed++; console.log(`FAIL  [${id}] ${name}\n      ${e.stack.split('\n').slice(0, 4).join('\n      ')}`); }
  finally { clearTimeout(timer); }
}
function mkStore(db) {
  let n = 0, t = 0;
  return WM.create(db, { now: () => new Date(Date.parse(NOW) + (++t) * 1000).toISOString(), actorClass: 'SYSTEM',
    idFactory: p => p + String(++n).padStart(6, '0'), persist: async () => ({ verified: true }) });
}
const must = r => { assert(r && r.ok, JSON.stringify(r)); return r.data; };
// Test setup only (allowed by B1): builds synthetic FIRN-B1 state through the existing store API.
async function seed(store) {
  must(await store.createProject({ project_id: 'firn-b1', code: 'FIRN-B1', name: 'FIRN B1 synthetic' }));
  must(await store.createProject({ project_id: 'other', code: 'OTHER', name: 'Other synthetic' }));
  must(await store.createSource({ source_id: 'src-main', project_id: 'firn-b1', surface: 'GITHUB', role: 'PRIMARY', title: 'FIRN repo', locator: 'github://synthetic/firn#main' }));
  must(await store.createSource({ source_id: 'src-nav', project_id: 'firn-b1', surface: 'NOTION', role: 'NAVIGATION', title: 'FIRN page', locator: 'notion://synthetic/firn' }));
  const mk = async (title, x) => must(await store.createItem(Object.assign({ project_id: 'firn-b1', title, provenance_class: 'USER_NOTE' }, x)));
  const ids = {};
  ids.cur = (await mk('Current focus', { status: 'CURRENT', priority: 'P0' })).work_id;
  ids.open = (await mk('Open question', { status: 'OPEN', type: 'QUESTION', priority: 'P1', next_action: 'Ask owner about scope' })).work_id;
  ids.prog = (await mk('In-flight task', { status: 'IN_PROGRESS', type: 'TASK', priority: 'P1', next_action: 'Finish parser', thread: 'parser' })).work_id;
  ids.blk = (await mk('Blocked task', { status: 'BLOCKED', type: 'TASK', priority: 'P2', status_note: 'Waiting for owner review' })).work_id;
  ids.unk = (await mk('Unknown thing', { status: 'UNKNOWN', priority: 'P3' })).work_id;
  ids.done = (await mk('Completed task', { status: 'COMPLETED', type: 'TASK' })).work_id;
  ids.res = (await mk('Resolved question', { status: 'RESOLVED', type: 'QUESTION', status_note: 'answered by owner' })).work_id;
  ids.arch = (await mk('Archived open item', { status: 'OPEN' })).work_id;
  ids.hyp = (await mk('Graphiti may help X', { type: 'HYPOTHESIS', status: 'OPEN', provenance_class: 'MODEL_PROPOSAL', tags: ['graphiti'] })).work_id;
  ids.dec = (await mk('Run experiment later', { type: 'DECISION', status: 'CURRENT', provenance_class: 'USER_DECISION' })).work_id;
  ids.oth = must(await store.createItem({ project_id: 'other', title: 'Other open', status: 'OPEN', provenance_class: 'USER_NOTE' })).work_id;
  must(await store.archiveItem(ids.arch));
  must(await store.addItemSource({ work_id: ids.prog, source_id: 'src-main', is_primary: 1 }));
  must(await store.addRelation({ from_work_id: ids.blk, to_work_id: ids.prog, relation_type: 'BLOCKED_BY' }));
  return ids;
}
function allWm(db) {
  const out = {};
  for (const t of Object.keys(WM.TABLE_COLUMNS)) { const r = db.exec(`SELECT * FROM ${t} ORDER BY 1,2`); out[t] = r.length ? r[0].values : []; }
  return JSON.stringify(out);
}
function forbiddenSnapshot(db) {
  const r = db.exec("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'wm_%' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const rows = {};
  for (const [name] of (r.length ? r[0].values : [])) { if (/^(wiz_|ledger|continuity|experiment)/.test(name)) { const q = db.exec(`SELECT * FROM ${name}`); rows[name] = q.length ? q[0].values : []; } }
  return JSON.stringify([r.length ? r[0].values : [], rows]);
}
function makeBridge(store, md) { return Bridge.create({ store, router: Router, loadResearchIndex: async () => (md === undefined ? INDEX_MD : md) }); }
// A fully valid (strict contract) research index; the service worker admits only documents that pass the router's validator.
const IB = label => ['# Index', '', 'STATUS: `RESEARCH_INDEX_ONLY`\\', 'CANON: `NO`\\', 'RUNTIME_AUTHORITY: `NO`\\', 'PRIMARY_EVIDENCE: `NO`\\', '', '## C. Experiment line index', '',
  '### 1. ' + label, '', 'STATUS: Closed.\\', 'EXECUTION_VERDICT: Run complete.\\', 'PRIMARY_EVIDENCE: raw.', '', '## D. Map', ''].join('\n');
const AUTH_REQUIRED = { STATUS: 'RESEARCH_INDEX_ONLY', CANON: 'NO', RUNTIME_AUTHORITY: 'NO', PRIMARY_EVIDENCE: 'NO' };
const AUTH_HEADER = ['STATUS: `RESEARCH_INDEX_ONLY`\\', 'CANON: `NO`\\', 'RUNTIME_AUTHORITY: `NO`\\', 'PRIMARY_EVIDENCE: `NO`\\'];
// Synthetic Evidence-Index fixture: parser semantics are tested here, not against the mutable live index.
const SYN_INDEX = [
  '# Synthetic Index', '', ...AUTH_HEADER, 'LAST_VERIFIED: `2026-10-06`', '', '## A. Source authority', '', 'text', '', '## C. Experiment line index', '',
  '### 1. SYN-ALPHA', '', 'EXPERIMENT_ID / NAME: SYN-ALPHA.\\', 'QUESTION: Does alpha hold?\\', 'STATUS: Closed; labels such as `NOT_PRESENT` are allowed.\\',
  'EXECUTION_VERDICT: Run complete; one output label was `NOT_PRESENT`.\\', 'OPEN_FINDING: none.\\', 'PRIMARY_EVIDENCE: raw-alpha.', '',
  '### 2. SYN-BETA', '', 'EXPERIMENT_ID / NAME: SYN-BETA.\\', 'QUESTION: Beta?\\', 'STATUS: Capture recorded complete; labels pending.\\',
  'EXECUTION_VERDICT: Corpus capture is complete; the blind run is `NOT_RUN`.\\', 'OPEN_FINDING: blind run.\\', 'PRIMARY_EVIDENCE: raw-beta.', '',
  '### 3. SYN-GAMMA', '', 'EXPERIMENT_ID / NAME: SYN-GAMMA.\\', 'STATUS: Reported complete.\\', 'EXECUTION_VERDICT: All eight outputs were `PRIMARY_PARTIAL`.\\',
  'OPEN_FINDING: none.\\', 'PRIMARY_EVIDENCE: UNKNOWN.', '',
  '### 4. SYN-DELTA', '', 'EXPERIMENT_ID / NAME: SYN-DELTA.\\', 'STATUS: Candidate next experiment, not a completed result.\\', 'EXECUTION_VERDICT: `NOT_RUN`.\\',
  'OPEN_FINDING: protocol review. BLOCKED on owner authorization.\\', 'PRIMARY_EVIDENCE: none identified.', '',
  '### 5. SYN-EPSILON', '', 'EXPERIMENT_ID / NAME: SYN-EPSILON.\\', 'STATUS: Unknown.\\', 'EXECUTION_VERDICT: `UNKNOWN`.\\', 'PRIMARY_EVIDENCE: UNKNOWN.', '',
  '## D. Status map', '',
].join('\n');
const synBridge = () => makeBridge(null, SYN_INDEX);
// Independent raw-field reader (does not use the router's parser) for verbatim comparisons on the live index.
function rawField(md, card, key) {
  const start = md.indexOf('\n### ' + card + '. '); if (start < 0) return undefined;
  const end = md.indexOf('\n### ', start + 5); const block = md.slice(start, end < 0 ? undefined : end);
  const line = block.split('\n').find(l => l.startsWith(key + ':')); return line ? line.slice(key.length + 1).replace(/\\\s*$/, '').trim() : undefined;
}
const clip400 = t => (t.length > 400 ? t.slice(0, 400) + '…' : t);

(async () => {
  SQL = await initSqlJs({ wasmBinary: WASM });
  const db = new SQL.Database();
  for (const t of ['wiz_facts', 'wiz_ref_items', 'wiz_events_ledger', 'continuity_carrier', 'experiment_registry'])
    { db.run(`CREATE TABLE ${t}(id TEXT PRIMARY KEY, v TEXT)`); db.run(`INSERT INTO ${t} VALUES('1','sentinel')`); }
  const store = mkStore(db);
  const ids = await seed(store);
  const bridge = makeBridge(store);
  const ex = (n, a) => bridge.execute(n, a);

  await T('spec', 'tool spec is read-only, registered in index.html, and has no write tool', async () => {
    assert.deepStrictEqual(Bridge.TOOL_NAMES.slice().sort(), ['research_route', 'wm_get', 'wm_list', 'wm_list_projects', 'wm_orientation', 'wm_project_sources', 'wm_related', 'wm_search']);
    for (const n of Bridge.TOOL_NAMES) assert(!/create|update|archive|write|delete|import/.test(n), n);
    assert(INDEX_HTML.includes('WmAgentRead.TOOLS_SPEC') && INDEX_HTML.includes("case 'wm_orientation'") && INDEX_HTML.includes('WmAgentRead.GUIDANCE'));
    assert(!/case 'wm_(create|update|archive)/.test(INDEX_HTML));
    assert.strictEqual((await ex('wm_create', {})).code, 'UNKNOWN_TOOL');
    assert.strictEqual((await ex('constructor', {})).code, 'UNKNOWN_TOOL');
  });
  await T('projects', 'wm_list_projects returns registered projects', async () => {
    const r = await ex('wm_list_projects'); assert.deepStrictEqual(r.items.map(p => p.code), ['FIRN-B1', 'OTHER']); assert.strictEqual(r.total, 2); assert.strictEqual(r.truncated, false);
  });
  await T('list', 'wm_list: status/type/thread filters, project by id or code, archived excluded by default, bounded', async () => {
    assert.deepStrictEqual((await ex('wm_list', { project: 'FIRN-B1', status: 'BLOCKED' })).items.map(i => i.work_id), [ids.blk]);
    assert.deepStrictEqual((await ex('wm_list', { project: 'firn-b1', thread: 'parser' })).items.map(i => i.work_id), [ids.prog]);
    assert.strictEqual((await ex('wm_list', { project: 'FIRN-B1', type: 'QUESTION' })).items.length, 2);
    const def = await ex('wm_list', { project: 'FIRN-B1' }); assert(!def.items.some(i => i.work_id === ids.arch)); assert.strictEqual(def.archived_included, false);
    assert((await ex('wm_list', { project: 'FIRN-B1', includeArchived: true })).items.some(i => i.work_id === ids.arch));
    assert.strictEqual((await ex('wm_list', { limit: 2 })).items.length, 2);
    assert.strictEqual((await ex('wm_list', { limit: 2 })).truncated, true);
    assert.strictEqual((await ex('wm_list', { project: 'nope' })).code, 'NOT_FOUND');
    assert.strictEqual((await ex('wm_list', { status: 'BOGUS' })).ok, false);
  });
  await T('get', 'wm_get returns item + linked sources (locator preserved) + explicit relations only', async () => {
    const g = await ex('wm_get', { work_id: ids.prog });
    assert.strictEqual(g.item.status, 'IN_PROGRESS'); assert.strictEqual(g.sources.items.length, 1);
    assert.strictEqual(g.sources.items[0].locator, 'github://synthetic/firn#main'); assert.strictEqual(g.sources.items[0].is_primary, true);
    assert.deepStrictEqual(g.relations.items.map(r => [r.from_work_id, r.relation_type, r.to_work_id]), [[ids.blk, 'BLOCKED_BY', ids.prog]]);
    assert.strictEqual((await ex('wm_get', { work_id: 'FIRN-B1-9999' })).found, false);
  });
  await T('search', 'wm_search reuses deterministic precedence (id > exact title > title > tag > summary > body)', async () => {
    assert.strictEqual((await ex('wm_search', { query: ids.cur })).items[0].work_id, ids.cur);
    assert.strictEqual((await ex('wm_search', { query: 'current focus' })).items[0].work_id, ids.cur);
    assert.strictEqual((await ex('wm_search', { query: 'graphiti' })).items[0].work_id, ids.hyp);
    assert(!(await ex('wm_search', { query: 'archived open' })).items.length);
    assert.deepStrictEqual((await ex('wm_search', { query: 'open', project: 'OTHER' })).items.map(i => i.work_id), [ids.oth]);
    assert.deepStrictEqual(await ex('wm_search', { query: 'graphiti' }), await ex('wm_search', { query: 'graphiti' }));
  });
  await T('related', 'wm_related returns explicit relations only (no inferred edges)', async () => {
    const r = await ex('wm_related', { work_id: ids.prog }); assert.strictEqual(r.inferred_edges, false); assert.strictEqual(r.items.length, 1); assert.strictEqual(r.total, 1); assert.strictEqual(r.truncated, false);
    assert.strictEqual((await ex('wm_related', { work_id: ids.cur })).items.length, 0);
  });
  await T('sources', 'wm_project_sources returns surface/role/locator and does not fetch', async () => {
    const r = await ex('wm_project_sources', { project: 'FIRN-B1' });
    assert.strictEqual(r.fetched, false); assert.deepStrictEqual(r.items.map(s => [s.surface, s.role, s.locator]).sort(),
      [['GITHUB', 'PRIMARY', 'github://synthetic/firn#main'], ['NOTION', 'NAVIGATION', 'notion://synthetic/firn']]);
    assert.strictEqual((await ex('wm_project_sources', {})).ok, false);
  });
  await T('orientation', 'wm_orientation: WORKING mode, status semantics, archived excluded, research not loaded, bounded', async () => {
    const o = await ex('wm_orientation', { project: 'FIRN-B1' });
    assert.strictEqual(o.mode, 'WORKING'); assert.deepStrictEqual(o.unresolved_statuses, ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'UNKNOWN']);
    assert.deepStrictEqual(o.research, { available: true, loaded: false, entrypoint: 'docs/research/EXPERIMENT_EVIDENCE_INDEX.md' });
    assert.deepStrictEqual(o.in_progress.map(i => i.work_id), [ids.prog]); assert.deepStrictEqual(o.blocked.map(i => i.work_id), [ids.blk]);
    assert.deepStrictEqual(o.unknown.map(i => i.work_id), [ids.unk]); assert.deepStrictEqual(o.recent_completed.map(i => i.work_id), [ids.done]);
    assert(o.current.every(i => i.status === 'CURRENT')); assert(o.current.some(i => i.work_id === ids.cur));
    const unresolvedIds = [...o.open, ...o.in_progress, ...o.blocked, ...o.unknown].map(i => i.work_id);
    assert(!unresolvedIds.includes(ids.cur), 'CURRENT must not be unresolved');
    assert(!unresolvedIds.includes(ids.res) && !unresolvedIds.includes(ids.done), 'RESOLVED/COMPLETED not unresolved');
    assert(!JSON.stringify(o).includes(ids.arch), 'archived excluded');
    assert(!JSON.stringify(o).includes(ids.oth), 'project filter respected');
    assert.deepStrictEqual(o.next_actions.map(i => i.next_action), ['Finish parser', 'Ask owner about scope']);
    assert(o.source_pointers.items.some(s => s.locator === 'github://synthetic/firn#main')); assert.strictEqual(o.source_pointers.truncated, false);
    assert.strictEqual(o.blocked[0].status_note, 'Waiting for owner review');
    const limited = await ex('wm_orientation', { limit: 1 }); assert(limited.open.length <= 1); assert.strictEqual(limited.truncated.open, true); assert(limited.totals.open >= 2);
    assert.deepStrictEqual(await ex('wm_orientation'), await ex('wm_orientation'), 'deterministic');
    assert(JSON.stringify(o).length < 8000, 'bounded');
  });
  await T('resolved-vs-completed', 'RESOLVED is distinct from COMPLETED in listings and orientation', async () => {
    assert.deepStrictEqual((await ex('wm_list', { status: 'RESOLVED' })).items.map(i => i.work_id), [ids.res]);
    assert.deepStrictEqual((await ex('wm_list', { status: 'COMPLETED' })).items.map(i => i.work_id), [ids.done]);
  });
  await T('no-mutation', 'every read tool leaves wm_*, other namespaces and the DB export byte-identical', async () => {
    const before = [allWm(db), forbiddenSnapshot(db), Buffer.from(db.export()).toString('base64')];
    for (const [n, a] of [['wm_orientation', {}], ['wm_orientation', { project: 'FIRN-B1' }], ['wm_list_projects', {}], ['wm_list', { includeArchived: true }], ['wm_get', { work_id: ids.prog }],
      ['wm_search', { query: 'open' }], ['wm_related', { work_id: ids.blk }], ['wm_project_sources', { project: 'FIRN-B1' }], ['research_route', { query: 'JST' }], ['research_route', {}]]) await ex(n, a);
    assert.deepStrictEqual([allWm(db), forbiddenSnapshot(db), Buffer.from(db.export()).toString('base64')], before);
  });
  await T('forbidden-ns', 'sentinel wiz_facts / wiz_ref_* / ledger / carrier / registry tables unchanged', async () => {
    const snap = forbiddenSnapshot(db); await ex('wm_orientation'); await ex('research_route', { query: 'Crystal' });
    assert.strictEqual(forbiddenSnapshot(db), snap);
    for (const t of ['wiz_facts', 'wiz_ref_items', 'wiz_events_ledger', 'continuity_carrier', 'experiment_registry']) assert.strictEqual(db.exec(`SELECT v FROM ${t}`)[0].values[0][0], 'sentinel');
  });
  await T('reload-resume', 'orientation after export → fresh DB → re-init is recovered from wm_* alone (no chat history)', async () => {
    const bytes = db.export();
    const db2 = new SQL.Database(bytes);               // simulates reload from persisted store
    const store2 = WM.create(db2, { now: () => NOW, persist: async () => ({ verified: true }) });
    const b2 = makeBridge(store2);
    assert.deepStrictEqual(await b2.execute('wm_orientation', { project: 'FIRN-B1' }), await ex('wm_orientation', { project: 'FIRN-B1' }));
    const o = await b2.execute('wm_orientation', { project: 'FIRN-B1' });
    assert.deepStrictEqual([o.in_progress[0].title, o.blocked[0].title, o.unknown[0].title, o.next_actions[0].next_action], ['In-flight task', 'Blocked task', 'Unknown thing', 'Finish parser']);
    assert.strictEqual((await b2.execute('wm_related', { work_id: ids.blk })).items.length, 1);
    assert.strictEqual((await b2.execute('wm_get', { work_id: ids.prog })).sources.items[0].locator, 'github://synthetic/firn#main');
  });

  // ── Repair round 1: wrong-answer fixes ──
  await T('search-project-before-limit', 'project-scoped search filters BEFORE ranking/LIMIT (>100 higher-ranked matches in another project)', async () => {
    const d = new SQL.Database(); const st = mkStore(d);
    must(await st.createProject({ project_id: 'pa', code: 'PA', name: 'A' })); must(await st.createProject({ project_id: 'pb', code: 'PB', name: 'B' }));
    for (let i = 0; i < 120; i++) must(await st.createItem({ project_id: 'pa', title: 'common word', provenance_class: 'USER_NOTE' }));   // exact title (rank 2) x120
    const target = must(await st.createItem({ project_id: 'pb', title: 'common word extra', provenance_class: 'USER_NOTE' }));              // title contains (rank 3)
    assert.deepStrictEqual(st.searchItems('common word', 100).map(i => i.project_id).filter(p => p === 'pb'), [], 'precondition: unscoped top-100 misses the target');
    assert.deepStrictEqual(st.searchItems('common word', 10, { project_id: 'pb' }).map(i => i.work_id), [target.work_id]);
    const b = makeBridge(st); const r = await b.execute('wm_search', { query: 'common word', project: 'PB' });
    assert.deepStrictEqual(r.items.map(i => i.work_id), [target.work_id]); assert.strictEqual(r.truncated, false);
    const all = await b.execute('wm_search', { query: 'common word', limit: 5 }); assert.strictEqual(all.items.length, 5); assert.strictEqual(all.truncated, true);
    // ranking inside a project is unchanged: id > exact title > title contains > tag > summary > body
    must(await st.createItem({ project_id: 'pb', title: 'other', summary: 'has common word in summary', provenance_class: 'USER_NOTE' }));
    assert.deepStrictEqual((await b.execute('wm_search', { query: 'common word', project: 'pb' })).items.map(i => i.title), ['common word extra', 'other']);
    assert.strictEqual((await b.execute('wm_search', { query: target.work_id, project: 'PA' })).items.length, 0, 'scope respected for WORK_ID match');
  });
  await T('recent-completed-recency', 'recent_completed is ordered by updated_at DESC (new P3 before old P0), not priority', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'rc', code: 'RC', name: 'RC' }));
    const oldP0 = must(await st.createItem({ project_id: 'rc', title: 'old P0', status: 'COMPLETED', priority: 'P0', provenance_class: 'USER_NOTE' }));
    for (let i = 0; i < 5; i++) must(await st.createItem({ project_id: 'rc', title: 'mid P1 ' + i, status: 'COMPLETED', priority: 'P1', provenance_class: 'USER_NOTE' }));
    const newP3 = must(await st.createItem({ project_id: 'rc', title: 'new P3', status: 'COMPLETED', priority: 'P3', provenance_class: 'USER_NOTE' }));
    const o = await makeBridge(st).execute('wm_orientation');
    assert.strictEqual(o.recent_completed[0].work_id, newP3.work_id); assert(!o.recent_completed.some(i => i.work_id === oldP0.work_id), 'old P0 pushed out by recency cap');
    assert.deepStrictEqual(o.recent_completed.map(i => i.updated_at), o.recent_completed.map(i => i.updated_at).slice().sort().reverse());
    assert.strictEqual(o.totals.recent_completed, 7);
  });
  await T('source-pointer-priority', 'PRIMARY source survives the NAVIGATION cap; ordering is explicit PRIMARY > NAVIGATION', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'sp', code: 'SP', name: 'SP' }));
    for (let i = 0; i < 4; i++) must(await st.createSource({ source_id: 'nav' + i, project_id: 'sp', surface: 'NOTION', role: 'NAVIGATION', title: 'A nav ' + i, locator: 'notion://nav/' + i }));
    must(await st.createSource({ source_id: 'prim', project_id: 'sp', surface: 'GITHUB', role: 'PRIMARY', title: 'Z primary repo', locator: 'github://synthetic/main' }));
    must(await st.createSource({ source_id: 'ctx', project_id: 'sp', surface: 'WEB', role: 'CONTEXT', title: 'ctx', locator: 'https://example.org/ctx' }));
    const o = await makeBridge(st).execute('wm_orientation', { project: 'SP' });
    assert.strictEqual(o.source_pointers.items[0].source_id, 'prim'); assert.strictEqual(o.source_pointers.items.length, 3);
    assert.deepStrictEqual(o.source_pointers.items.map(i => i.role), ['PRIMARY', 'NAVIGATION', 'NAVIGATION']);
    assert.strictEqual(o.source_pointers.total, 5); assert.strictEqual(o.source_pointers.truncated, true); assert(o.source_pointers.items.every(i => i.project_id === 'sp'));
    const ps = await makeBridge(st).execute('wm_project_sources', { project: 'SP' }); assert.strictEqual(ps.items[0].source_id, 'prim'); assert.strictEqual(ps.items.length, 6); assert.strictEqual(ps.total, 6); assert.strictEqual(ps.truncated, false);
  });
  await T('source-pointer-truncation-flag', 'multi-project source pointers: explicit total/truncated and omitted project ids; no silent loss', async () => {
    const d = new SQL.Database(); const st = mkStore(d);
    for (let p = 1; p <= 7; p++) {
      must(await st.createProject({ project_id: 'mp' + p, code: 'MP' + p, name: 'MP' + p }));
      for (let i = 0; i < 3; i++) must(await st.createSource({ source_id: `mp${p}-s${i}`, project_id: 'mp' + p, surface: 'LOCAL', role: i ? 'NAVIGATION' : 'PRIMARY', title: `s${i}`, locator: `local://mp${p}/${i}` }));
    }
    const sp = (await makeBridge(st).execute('wm_orientation')).source_pointers;
    assert.strictEqual(sp.items.length, 15); assert.strictEqual(sp.total, 21); assert.strictEqual(sp.truncated, true); assert.deepStrictEqual(sp.omitted_project_ids, ['mp6', 'mp7']);
    assert(sp.items.every(i => /^mp[1-5]$/.test(i.project_id)));
    const small = (await makeBridge(st).execute('wm_orientation', { project: 'MP2' })).source_pointers; assert.strictEqual(small.truncated, false); assert.strictEqual(small.items.length, 3);
  });
  await T('bounded-text', 'long WM text is clipped agent-side with truncation metadata; DB untouched; locator never clipped', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'bt', code: 'BT', name: 'N'.repeat(900), summary: 'S'.repeat(900) }));
    const locator = 'https://example.org/' + 'p'.repeat(1500);
    must(await st.createSource({ source_id: 'long', project_id: 'bt', surface: 'WEB', role: 'PRIMARY', title: 'T'.repeat(500), locator, note: 'n'.repeat(900) }));
    const item = must(await st.createItem({ project_id: 'bt', title: 'X'.repeat(500), summary: 'u'.repeat(2000), current_question: 'q'.repeat(2000), status: 'IN_PROGRESS',
      status_note: 's'.repeat(2000), next_action: 'a'.repeat(2000), body_md: 'b'.repeat(10000), provenance_class: 'USER_NOTE' }));
    must(await st.addItemSource({ work_id: item.work_id, source_id: 'long', is_primary: 1 }));
    const b = makeBridge(st);
    const o = await b.execute('wm_orientation'); const it = o.in_progress[0];
    for (const f of ['title', 'summary', 'current_question', 'status_note', 'next_action']) { assert(it[f].length <= 501, f + ' length ' + it[f].length); assert(it.truncated_fields.includes(f), f + ' flagged'); }
    assert(o.next_actions[0].truncated_fields.includes('next_action') && o.next_actions[0].truncated_fields.includes('title'));
    assert(o.projects.items[0].truncated_fields.includes('name') && o.projects.items[0].truncated_fields.includes('summary'));
    assert.strictEqual(o.source_pointers.items[0].locator, locator); assert(o.source_pointers.items[0].truncated_fields.includes('title'));
    assert(JSON.stringify(o).length < 9000, 'orientation size ' + JSON.stringify(o).length);
    const g = await b.execute('wm_get', { work_id: item.work_id });
    assert(g.item.body_md.length <= 4001); assert(g.item.truncated_fields.includes('body_md')); assert.strictEqual(g.item.body_md_total_chars, 10000);
    assert.strictEqual(g.sources.items[0].locator, locator);
    const short = must(await st.createItem({ project_id: 'bt', title: 'short', body_md: 'tiny', provenance_class: 'USER_NOTE' }));
    const gs = await b.execute('wm_get', { work_id: short.work_id }); assert.strictEqual(gs.item.body_md, 'tiny'); assert.deepStrictEqual(gs.item.truncated_fields, []);
    const afterShort = allWm(d); await b.execute('wm_orientation'); await b.execute('wm_get', { work_id: item.work_id });
    assert.strictEqual(st.getItem(item.work_id).body_md.length, 10000, 'DB content unchanged');
    assert.strictEqual(allWm(d), afterShort, 'read tools did not mutate wm_*');
  });

  // ── Service worker (unit, mocked runtime) ──
  await T('sw-unit', 'sw.js: CACHE_NAME bumped, B1 scripts cached, research index network-first with flagged offline fallback, others unchanged, old caches removed', async () => {
    const vm = require('node:vm'); const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const store = new Map(), listeners = {}; let netBody = IB('NEW'), netUp = true, netCalls = 0;
    const cachesApi = { async open(name) { if (!store.has(name)) store.set(name, new Map()); const c = store.get(name);
      return { async addAll() {}, async put(req, res) { c.set(typeof req === 'string' ? req : req.url, res); }, async match(req) { const hit = c.get(typeof req === 'string' ? req : req.url); return hit ? hit.clone() : undefined; } }; },
      async match(req) { for (const c of store.values()) { const hit = c.get(typeof req === 'string' ? req : req.url); if (hit) return hit.clone(); } return undefined; },
      async keys() { return [...store.keys()]; }, async delete(k) { return store.delete(k); } };
    const ctx = { self: { addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [] }, registration: {} },
      caches: cachesApi, fetch: async () => { netCalls++; if (!netUp) throw new TypeError('offline'); return new Response(netBody, { status: 200 }); }, Response, Headers, Request, URL, console, AbortController, setTimeout: () => 0, clearTimeout() {},
      importScripts: () => vm.runInContext(fs.readFileSync(path.join(ROOT, 'research-router.js'), 'utf8'), ctx) };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const name = src.match(/const CACHE_NAME = '([^']+)'/)[1]; assert.notStrictEqual(name, 'eiti-wizard-lab-v1.8.10-wm0'); assert.match(name, /^eiti-wizard-lab-/);
    const assets = src.slice(src.indexOf('STATIC_ASSETS'), src.indexOf('];')); for (const f of ['working-memory.js', 'wm-agent-read.js', 'research-router.js']) assert(assets.includes("'/" + f + "'"), f);
    const fire = async url => { const ev = { request: new Request('http://127.0.0.1:1' + url), respondWith(p) { this.p = p; }, waitUntil() {} }; listeners.fetch(ev); return ev.p; };
    const IDX = '/Eiti-Wizard-Lab/docs/research/EXPERIMENT_EVIDENCE_INDEX.md';
    store.set('eiti-wizard-lab-v1.8.10-wm0', new Map([['http://127.0.0.1:1' + IDX, new Response('OLD')], ['http://127.0.0.1:1/Eiti-Wizard-Lab/working-memory.js', new Response('OLD-JS')]]));
    // online: fresh network copy wins over the old cached copy, and is stored
    let res = await fire(IDX); assert.strictEqual(await res.text(), IB('NEW')); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null); assert(netCalls >= 1);
    await new Promise(r => setTimeout(r, 5)); assert(store.get(name).has('http://127.0.0.1:1' + IDX));
    // offline: cached copy, flagged
    netUp = false; res = await fire(IDX); assert.strictEqual(await res.text(), IB('NEW')); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-offline-cache');
    store.delete(name); store.delete('eiti-wizard-lab-v1.8.10-wm0'); res = await fire(IDX); assert.strictEqual(res.status, 504);
    // other assets keep cache-first behaviour (and other research files are NOT network-first)
    netUp = true; store.set('eiti-wizard-lab-x', new Map([['http://127.0.0.1:1/Eiti-Wizard-Lab/working-memory.js', new Response('CACHED-JS')]]));
    const before = netCalls; res = await fire('/Eiti-Wizard-Lab/working-memory.js'); assert.strictEqual(await res.text(), 'CACHED-JS'); assert.strictEqual(netCalls, before);
    store.set('eiti-wizard-lab-x', new Map([['http://127.0.0.1:1/Eiti-Wizard-Lab/docs/research/evidence-index-validation.md', new Response('CACHED-MD')]]));
    res = await fire('/Eiti-Wizard-Lab/docs/research/evidence-index-validation.md'); assert.strictEqual(await res.text(), 'CACHED-MD');
    // activate removes old caches of this app only
    store.clear(); store.set('eiti-wizard-lab-v1.8.10-wm0', new Map()); store.set(name, new Map()); store.set('unrelated-cache', new Map());
    let done; listeners.activate({ waitUntil(p) { done = p; } }); await done; assert.deepStrictEqual([...store.keys()].sort(), [name, 'unrelated-cache'].sort());
  });

  // ── Research router ──
  await T('router-real-index', 'live index smoke: parses, header preserved, no derived verdict field, nothing promoted', async () => {
    const all = await ex('research_route'); assert.strictEqual(all.index_loaded, true); assert.strictEqual(all.parse_status, 'OK'); assert(all.total_cards > 0);
    assert.strictEqual(all.header, 'RESEARCH_INDEX_ONLY CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO'); assert.strictEqual(all.promoted_to_working, false);
    for (const c of all.cards) { assert(!Object.keys(c).some(k => /token|verdict_class|derived/i.test(k)), 'derived field present: ' + Object.keys(c)); assert.strictEqual(c.plane, 'RESEARCH'); }
    assert(!/execution_verdict_token/.test(JSON.stringify(all)));
  });
  for (const n of [2, 5, 6]) await T('router-card-' + n, `real card ${n}: STATUS/EXECUTION_VERDICT/OPEN_FINDING/PRIMARY_EVIDENCE are verbatim; no short verdict is derived`, async () => {
    const r = await ex('research_route', { card: n }); assert.strictEqual(r.matched, 1); const c = r.cards[0];
    assert.strictEqual(c.card_number, n); assert(!('execution_verdict_token' in c) && !('line' in c) && !('index_pointer' in c));
    for (const key of ['STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE']) {
      const raw = rawField(INDEX_MD, n, key); if (raw === undefined) assert.strictEqual(c[key], null); else assert.strictEqual(c[key], clip400(raw), key);
    }
    const verdict = rawField(INDEX_MD, n, 'EXECUTION_VERDICT');
    // The whole verdict text is returned; no field is collapsed to a single backticked token taken from the prose.
    for (const token of ['NOT_PRESENT', 'NOT_RUN', 'PRIMARY_PARTIAL', 'UNKNOWN', 'PASS', 'FAIL'])
      assert(!Object.values(c).some(v => v === token), `card ${n} collapsed to bare ${token}`);
    assert(verdict.length > 'NOT_RUN'.length);
  });
  await T('router-synthetic-shapes', 'synthetic cards shaped like cards 2/5/6 keep the full verbatim verdict (no NOT_PRESENT / NOT_RUN / PRIMARY_PARTIAL verdict)', async () => {
    const b = synBridge(); const get = async n => (await b.execute('research_route', { card: n })).cards[0];
    const a1 = await get(1), b2 = await get(2), g3 = await get(3);
    assert.strictEqual(a1.EXECUTION_VERDICT, 'Run complete; one output label was `NOT_PRESENT`.');
    assert.strictEqual(b2.EXECUTION_VERDICT, 'Corpus capture is complete; the blind run is `NOT_RUN`.');
    assert.strictEqual(g3.EXECUTION_VERDICT, 'All eight outputs were `PRIMARY_PARTIAL`.');
    for (const c of [a1, b2, g3]) assert(!Object.keys(c).some(k => /token/i.test(k)));
    assert.strictEqual((await get(5)).EXECUTION_VERDICT, '`UNKNOWN`.'); // UNKNOWN stays UNKNOWN, verbatim
    assert.strictEqual((await get(5)).OPEN_FINDING, null);            // absent field is null, not FALSE/ABSENT
  });
  await T('router-search', 'query searches title/name/question/STATUS/EXECUTION_VERDICT/OPEN_FINDING/PRIMARY_EVIDENCE (substring, deterministic)', async () => {
    const b = synBridge(); const q = async query => (await b.execute('research_route', { query })).cards.map(c => c.card_number);
    assert.deepStrictEqual(await q('NOT_RUN'), [2, 4]);           // verdict text
    assert.deepStrictEqual(await q('not_run'), [2, 4]);           // case-insensitive
    assert.deepStrictEqual(await q('Candidate'), [4]);            // STATUS text
    assert.deepStrictEqual(await q('BLOCKED'), [4]);              // OPEN_FINDING text
    assert.deepStrictEqual(await q('UNKNOWN'), [3, 5]);           // PRIMARY_EVIDENCE + verdict
    assert.deepStrictEqual(await q('Does alpha'), [1]);           // QUESTION
    assert.deepStrictEqual(await q('raw-beta'), [2]);             // PRIMARY_EVIDENCE
    assert.deepStrictEqual(await q('syn gamma'), [3]);            // all terms must occur
    assert.deepStrictEqual(await q('syn-alpha'), [1]);            // title/name
    const none = await b.execute('research_route', { query: 'zzz-nothing' }); assert.strictEqual(none.matched, 0); assert.strictEqual(none.index_loaded, true);
    assert.match(none.note, /not evidence that no such research exists/); assert.match(none.notice, /not an exhaustive scientific search/);
    const real = await ex('research_route', { query: 'NOT_RUN' }); assert(real.matched >= 1, 'NOT_RUN must find cards in the live index');
    assert(real.cards.every(c => ['EXPERIMENT_ID / NAME', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE'].some(k => c[k] && /not_run/i.test(rawField(INDEX_MD, c.card_number, k) || '')) || /not_run/i.test(c.heading)));
  });
  await T('router-card-vs-query', 'card/line + query is a VALIDATION error (fail closed); card is a card number, line is only an alias', async () => {
    for (const args of [{ card: 2, query: 'x' }, { line: 2, query: 'x' }]) {
      const r = await ex('research_route', args); assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'VALIDATION'); assert.match(r.error, /either card\/line or query, not both/i); assert(!r.cards);
    }
    assert.strictEqual((await ex('research_route', { card: 1, line: 2 })).code, 'VALIDATION');
    assert.strictEqual((await ex('research_route', { card: 'abc' })).code, 'VALIDATION');
    assert.strictEqual((await synBridge().execute('research_route', { line: 4 })).cards[0].card_number, 4);
    assert(!JSON.stringify(await synBridge().execute('research_route', { card: 4 })).includes('index_pointer'));
  });
  await T('router-parse-fail-closed', 'non-index body / zero-card parse / fetch failure -> index_loaded=false with pointer only; valid index with no match stays loaded', async () => {
    const html = '<!doctype html><html><body>404 fallback</body></html>';
    for (const [md, status] of [[html, 'NOT_AN_EVIDENCE_INDEX'], ['# Some other doc\nSTATUS: whatever', 'NOT_AN_EVIDENCE_INDEX'], [null, 'INDEX_UNAVAILABLE'], ['', 'INDEX_UNAVAILABLE'],
      [AUTH_HEADER.join('\n') + '\n\n## C. Experiment line index\n\n(layout changed)\n', 'NO_CARDS_PARSED']]) {
      const r = await makeBridge(null, md).execute('research_route', { query: 'NOT_RUN' });
      assert.strictEqual(r.index_loaded, false, String(md)); assert.strictEqual(r.parse_status, status); assert.strictEqual(r.entrypoint, Router.INDEX_PATH); assert(!r.cards && !('matched' in r));
    }
    const thrown = await Bridge.create({ store: null, router: Router, loadResearchIndex: async () => { throw new Error('offline'); } }).execute('research_route', {});
    assert.strictEqual(thrown.index_loaded, false); assert.strictEqual(thrown.parse_status, 'FETCH_FAILED'); assert(!thrown.cards);
    const ok = await synBridge().execute('research_route', { query: 'zzz' }); assert.strictEqual(ok.index_loaded, true); assert.strictEqual(ok.parse_status, 'OK'); assert.strictEqual(ok.matched, 0);
  });
  await T('router-malformed-card', 'malformed card heading fails the whole index closed (index_loaded=false, MALFORMED_CARDS, pointer-only); valid minimal card and real cards still parse', async () => {
    const wrap = body => ['# Synthetic', '', ...AUTH_HEADER, '', '## C. Experiment line index', '', body, '## D. Map', ''].join('\n');
    const good = ['### 1. SYN-GOOD', '', 'STATUS: Closed.\\', 'EXECUTION_VERDICT: Run complete.\\', 'PRIMARY_EVIDENCE: raw-good.', ''].join('\n');
    const cases = {
      'heading-only card': ['### 2. SYN-EMPTY', ''].join('\n'),
      'heading + irrelevant text': ['### 2. SYN-PROSE', '', 'Some free prose that is not a field.', 'STATUSLESS: not a field either.', 'Another paragraph mentioning NOT_RUN and PASS.', ''].join('\n'),
      'partially malformed (missing EXECUTION_VERDICT)': ['### 2. SYN-PARTIAL', '', 'STATUS: Closed.\\', 'PRIMARY_EVIDENCE: raw.', ''].join('\n'),
      'empty field value': ['### 2. SYN-EMPTYVAL', '', 'STATUS:\\', 'EXECUTION_VERDICT: Run complete.\\', 'PRIMARY_EVIDENCE: raw.', ''].join('\n'),
      'whitespace-only field value': ['### 2. SYN-WS', '', 'STATUS: Closed.\\', 'EXECUTION_VERDICT:    \\', 'PRIMARY_EVIDENCE: raw.', ''].join('\n'),
      'only optional fields present': ['### 2. SYN-OPT', '', 'QUESTION: Q?\\', 'OPEN_FINDING: none.\\', 'EXPERIMENT_ID / NAME: SYN-OPT.', ''].join('\n'),
    };
    for (const [label, card] of Object.entries(cases)) {
      for (const args of [{}, { card: 1 }, { card: 2 }, { query: 'closed' }]) {            // even a valid sibling card is not served from a malformed index
        const r = await makeBridge(null, wrap(good + '\n' + card)).execute('research_route', args);
        assert.strictEqual(r.index_loaded, false, label); assert.strictEqual(r.parse_status, 'MALFORMED_CARDS', label);
        assert.strictEqual(r.entrypoint, Router.INDEX_PATH); assert(!r.cards && !('matched' in r) && !('total_cards' in r), label + ' leaked cards');
        assert.strictEqual(r.malformed_cards[0].card_number, 2, label); assert(r.malformed_cards[0].missing.length >= 1);
        assert.deepStrictEqual(r.required_fields, ['STATUS', 'EXECUTION_VERDICT', 'PRIMARY_EVIDENCE']); assert.strictEqual(r.promoted_to_working, false);
        assert(!/PASS|FAIL/.test(JSON.stringify(r.malformed_cards)));
      }
    }
    const heading = (await makeBridge(null, wrap(['### 1. SYN-ONLY', ''].join('\n'))).execute('research_route', {}));
    assert.strictEqual(heading.index_loaded, false); assert.deepStrictEqual(heading.malformed_cards[0].missing, ['STATUS', 'EXECUTION_VERDICT', 'PRIMARY_EVIDENCE']);
    assert.strictEqual((await makeBridge(null, wrap(good + '\n' + cases['partially malformed (missing EXECUTION_VERDICT)'])).execute('research_route', {})).malformed_cards[0].missing.join(), 'EXECUTION_VERDICT');
    // valid minimal card: only the three required fields; everything else is null (absent), never invented
    const min = await makeBridge(null, wrap(good)).execute('research_route', { card: 1 });
    assert.strictEqual(min.index_loaded, true); assert.strictEqual(min.parse_status, 'OK'); assert.strictEqual(min.cards[0].STATUS, 'Closed.');
    assert.strictEqual(min.cards[0].QUESTION, null); assert.strictEqual(min.cards[0].OPEN_FINDING, null); assert.strictEqual((await makeBridge(null, wrap(good)).execute('research_route', {})).total_cards, 1);
    // existing real cards still satisfy the contract
    const real = Router.parseCards(INDEX_MD); assert(real.length > 0);
    for (const c of real) for (const k of Router.REQUIRED_FIELDS) assert((c.fields[k] || '').trim(), `real card ${c.number} lacks ${k}`);
    assert.strictEqual((await ex('research_route', {})).parse_status, 'OK');
  });
  // ── Repair round 3: authority contract (validated from the SOURCE text, before any card is parsed) ──
  const withHeader = (header, cards) => ['# Synthetic', '', ...header, '', '## C. Experiment line index', '', cards === undefined ? SYN_CARD : cards, '## D. Map', ''].join('\n');
  const SYN_CARD = ['### 1. SYN-AUTH', '', 'STATUS: Closed.\\', 'EXECUTION_VERDICT: Run complete.\\', 'PRIMARY_EVIDENCE: raw-auth.', ''].join('\n');
  const swap = (key, value) => AUTH_HEADER.map(l => l.startsWith(key + ':') ? `${key}: \`${value}\`\\` : l);
  const drop = key => AUTH_HEADER.filter(l => !l.startsWith(key + ':'));
  const assertAuthFail = async (md, label, expectProblem) => {
    for (const args of [{}, { card: 1 }, { query: 'closed' }]) {
      const r = await makeBridge(null, md).execute('research_route', args);
      assert.strictEqual(r.index_loaded, false, label); assert.strictEqual(r.parse_status, 'AUTHORITY_CONTRACT_INVALID', label);
      assert(!r.cards && !('matched' in r) && !('total_cards' in r), label + ' leaked cards'); assert.strictEqual(r.entrypoint, Router.INDEX_PATH);
      assert(!('header' in r), label + ': the NO-contract header must not be asserted over a contradicting document');
      assert.strictEqual(r.authority_contract.valid, false); assert.deepStrictEqual(r.authority_contract.required, { STATUS: 'RESEARCH_INDEX_ONLY', CANON: 'NO', RUNTIME_AUTHORITY: 'NO', PRIMARY_EVIDENCE: 'NO' });
      assert(r.authority_contract.problems.length >= 1 && (!expectProblem || r.authority_contract.problems.some(x => expectProblem.test(x))), label + ' ' + JSON.stringify(r.authority_contract.problems));
      assert.strictEqual(r.promoted_to_working, false);
    }
  };
  await T('authority-valid', 'A: exact authority contract parsed from the source text -> loaded; declared values come from the document', async () => {
    const r = await makeBridge(null, withHeader(AUTH_HEADER)).execute('research_route', { card: 1 });
    assert.strictEqual(r.index_loaded, true); assert.strictEqual(r.parse_status, 'OK'); assert.strictEqual(r.header, Router.HEADER);
    assert.deepStrictEqual(r.authority_contract, { valid: true, declared: { STATUS: 'RESEARCH_INDEX_ONLY', CANON: 'NO', RUNTIME_AUTHORITY: 'NO', PRIMARY_EVIDENCE: 'NO' } });
    // the only other accepted spelling is still one flag per line: KEY=VALUE without backticks
    const alt = ['STATUS=RESEARCH_INDEX_ONLY', 'CANON=NO', 'RUNTIME_AUTHORITY=NO', 'PRIMARY_EVIDENCE=NO'];
    assert.strictEqual((await makeBridge(null, withHeader(alt)).execute('research_route', {})).index_loaded, true);
    // flags are read from the header block only: a card's own "PRIMARY_EVIDENCE: YES" field is not an authority flag
    const yesCard = ['### 1. SYN-YESFIELD', '', 'STATUS: Closed.\\', 'EXECUTION_VERDICT: Run complete.\\', 'PRIMARY_EVIDENCE: YES', ''].join('\n');
    const y = await makeBridge(null, withHeader(AUTH_HEADER, yesCard)).execute('research_route', { card: 1 });
    assert.strictEqual(y.index_loaded, true); assert.strictEqual(y.cards[0].PRIMARY_EVIDENCE, 'YES');
  });
  for (const key of ['CANON', 'RUNTIME_AUTHORITY', 'PRIMARY_EVIDENCE'])
    await T('authority-' + key.toLowerCase() + '-yes', `${key}=YES fails closed (not normalised to NO, no cards served)`, async () => {
      await assertAuthFail(withHeader(swap(key, 'YES')), key + '=YES', new RegExp(key + ': declared YES, required NO'));
      await assertAuthFail(withHeader(AUTH_HEADER.map(l => l.startsWith(key + ':') ? `${key}=YES` : l)), key + '=YES (= form)', new RegExp(key + ': declared YES'));
    });
  await T('authority-missing-flags', 'E: each missing required authority flag fails closed (nothing inferred)', async () => {
    for (const key of ['STATUS', 'CANON', 'RUNTIME_AUTHORITY', 'PRIMARY_EVIDENCE']) {
      // keep the RESEARCH_INDEX_ONLY marker in prose so the failure is attributed to the contract, not to "not an index"
      await assertAuthFail(withHeader([...drop(key), 'PURPOSE: a RESEARCH_INDEX_ONLY navigation layer.']), 'missing ' + key, new RegExp(key + ': missing'));
    }
    await assertAuthFail(withHeader(['PURPOSE: a RESEARCH_INDEX_ONLY navigation layer.']), 'all missing', /missing/);
    // flags that appear only after the first "## " heading do not satisfy the contract
    const late = ['# Synthetic', '', 'PURPOSE: a RESEARCH_INDEX_ONLY layer.', '', '## A. Authority', '', ...AUTH_HEADER, '', '## C. Experiment line index', '', SYN_CARD, '## D. Map', ''].join('\n');
    await assertAuthFail(late, 'flags below the header block', /missing/);
  });
  await T('authority-conflicting', 'F: duplicate contradictory / ambiguous / non-exact declarations fail closed', async () => {
    await assertAuthFail(withHeader([...AUTH_HEADER, 'CANON: `YES`\\']), 'CANON NO then YES', /CANON: conflicting declarations/);
    await assertAuthFail(withHeader(['CANON: `YES`\\', ...AUTH_HEADER]), 'CANON YES then NO', /CANON: conflicting declarations/);
    await assertAuthFail(withHeader([...AUTH_HEADER, 'RUNTIME_AUTHORITY=YES']), 'RUNTIME_AUTHORITY NO then =YES', /RUNTIME_AUTHORITY: conflicting/);
    await assertAuthFail(withHeader([...AUTH_HEADER, 'STATUS: `SOMETHING_ELSE`\\']), 'STATUS conflict', /STATUS: conflicting/);
    await assertAuthFail(withHeader([...AUTH_HEADER, 'NOTE: this index is CANON=YES for now']), 'inline contradiction hidden in prose', /CANON: conflicting/);
    await assertAuthFail(withHeader(swap('CANON', 'no')), 'lowercase value is not normalised', /CANON: declared no/);
    await assertAuthFail(withHeader(AUTH_HEADER.map(l => l.startsWith('CANON:') ? 'CANON: `NO` (mostly)' : l)), 'ambiguous value', /CANON: ambiguous/);
    await assertAuthFail(withHeader(AUTH_HEADER.map(l => l.startsWith('PRIMARY_EVIDENCE:') ? 'PRIMARY_EVIDENCE: `NO` or `YES`\\' : l)), 'ambiguous value 2', /PRIMARY_EVIDENCE: ambiguous/);
  });
  for (const key of ['STATUS', 'CANON', 'RUNTIME_AUTHORITY', 'PRIMARY_EVIDENCE'])
    await T('authority-duplicate-' + key.toLowerCase(), `identical duplicate ${key} declaration fails closed (exactly one declaration per key)`, async () => {
      const line = AUTH_HEADER.find(l => l.startsWith(key + ':'));
      await assertAuthFail(withHeader([...AUTH_HEADER, line]), key + ' duplicated (same spelling)', new RegExp(key + ': duplicate declaration \\(2 occurrences'));
      await assertAuthFail(withHeader([line, ...AUTH_HEADER]), key + ' duplicated first', new RegExp(key + ': duplicate declaration'));
      await assertAuthFail(withHeader([...AUTH_HEADER, `${key}=${AUTH_REQUIRED[key]}`]), key + ' duplicated (= spelling)', new RegExp(key + ': duplicate declaration'));
      await assertAuthFail(withHeader([...AUTH_HEADER, line, line]), key + ' triplicated', new RegExp(key + ': duplicate declaration \\(3 occurrences'));
    });
  // Exact syntax: A. "KEY: `VALUE`" (one space, both backticks)  or  B. "KEY=VALUE" (no spaces, no backticks). Nothing else.
  const AUTH_KEYS = ['STATUS', 'CANON', 'RUNTIME_AUTHORITY', 'PRIMARY_EVIDENCE'];
  const declare = (key, text) => AUTH_HEADER.map(l => l.startsWith(key + ':') ? text : l);
  await T('authority-syntax-valid', 'valid syntax: KEY: `VALUE` and KEY=VALUE (per key, with/without trailing line-break backslash, mixed spellings)', async () => {
    for (const key of AUTH_KEYS) {
      const v = AUTH_REQUIRED[key];
      for (const text of ['`' + v + '`', '`' + v + '`\\', '`' + v + '` ', v, v + '\\']) {
        const line = text.startsWith('`') ? `${key}: ${text}` : `${key}=${text}`;
        const r = await makeBridge(null, withHeader(declare(key, line))).execute('research_route', { card: 1 });
        assert.strictEqual(r.index_loaded, true, JSON.stringify(line) + ' ' + JSON.stringify(r.authority_contract)); assert.strictEqual(r.parse_status, 'OK');
        assert.strictEqual(r.authority_contract.declared[key], v);
      }
    }
    const mixed = ['STATUS=RESEARCH_INDEX_ONLY', 'CANON: `NO`', 'RUNTIME_AUTHORITY=NO', 'PRIMARY_EVIDENCE: `NO`\\'];
    assert.strictEqual((await makeBridge(null, withHeader(mixed)).execute('research_route', {})).index_loaded, true);
  });
  for (const key of AUTH_KEYS)
    await T('authority-syntax-invalid-' + key.toLowerCase(), `${key}: non-contract syntax variants fail closed (unquoted, one backtick, spacing, stray text, quotes, backticked equals)`, async () => {
      const v = AUTH_REQUIRED[key];
      const bad = {
        'unquoted colon': `${key}: ${v}`, 'opening backtick only': `${key}: \`${v}`, 'closing backtick only': `${key}: ${v}\``,
        'space before colon': `${key} : ${v}`, 'space before colon + backticks': `${key} : \`${v}\``, 'no space after colon': `${key}:\`${v}\``,
        'no space after colon, unquoted': `${key}:${v}`, 'two spaces after colon': `${key}:  \`${v}\``, 'doubled backticks': `${key}: \`\`${v}\`\``,
        'trailing text': `${key}: \`${v}\` (mostly)`, 'trailing char': `${key}: \`${v}\`x`, 'single quotes': `${key}: '${v}'`, 'double quotes': `${key}: "${v}"`,
        'backticked equals': `${key}=\`${v}\``, 'equals + opening backtick': `${key}=\`${v}`, 'spaced equals': `${key} = ${v}`, 'space after equals': `${key}= ${v}`,
        'space before equals': `${key} =${v}`, 'colon+equals': `${key}:=${v}`, 'equals + trailing text': `${key}=${v} (final)`, 'tab after colon': `${key}:\t\`${v}\``,
      };
      for (const [label, line] of Object.entries(bad)) await assertAuthFail(withHeader(declare(key, line)), `${key} ${label}: ${JSON.stringify(line)}`);
      // wrong-case key is not a declaration of the required key at all
      await assertAuthFail(withHeader(declare(key, `${key.toLowerCase()}: \`${v}\``)), key + ' lowercase key', new RegExp(key + ': missing'));
    });
  await T('authority-strict-one-flag-per-line', 'combined single-line / inline / alternative header forms are NOT supported and fail closed', async () => {
    const flagless = AUTH_HEADER.filter(l => l.startsWith('STATUS:'));
    // combined single-line syntax, with or without a separate STATUS line
    await assertAuthFail(withHeader([...flagless, 'CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO']), 'combined flags line', /ambiguous or non-conforming|inline\/combined declaration not allowed/);
    await assertAuthFail(withHeader(['RESEARCH_INDEX_ONLY CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO']), 'all-in-one combined line', /STATUS: missing/);
    await assertAuthFail(withHeader(['STATUS: `RESEARCH_INDEX_ONLY` CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO']), 'combined after STATUS on one line', /ambiguous or non-conforming/);
    await assertAuthFail(withHeader(['CANON=NO RUNTIME_AUTHORITY=NO', ...AUTH_HEADER.filter(l => !/^(CANON|RUNTIME_AUTHORITY):/.test(l))]), 'combined pair', /CANON: ambiguous or non-conforming/);
    // even a CONSISTENT inline mention in prose is a second declaration -> fail closed (no silent tolerance)
    await assertAuthFail(withHeader([...AUTH_HEADER, 'NOTE: this index is CANON=NO and RUNTIME_AUTHORITY: NO.']), 'consistent inline mention', /inline\/combined declaration not allowed/);
    // alternative / unknown header forms: bold, table, list, key without separator, different keys
    for (const alt of [['**STATUS**: `RESEARCH_INDEX_ONLY`', '**CANON**: `NO`', '**RUNTIME_AUTHORITY**: `NO`', '**PRIMARY_EVIDENCE**: `NO`'],
      ['| CANON | NO |', '| RUNTIME_AUTHORITY | NO |', '| PRIMARY_EVIDENCE | NO |', '| STATUS | RESEARCH_INDEX_ONLY |'],
      ['- STATUS: `RESEARCH_INDEX_ONLY`', '- CANON: `NO`', '- RUNTIME_AUTHORITY: `NO`', '- PRIMARY_EVIDENCE: `NO`'],
      ['AUTHORITY: `NO`', 'PURPOSE: a RESEARCH_INDEX_ONLY layer.']])
      await assertAuthFail(withHeader(alt), 'alternative form ' + alt[0], /missing|inline\/combined declaration not allowed/);
  });
  await T('authority-then-malformed-card', 'G: valid authority contract + malformed card still fails closed', async () => {
    for (const bad of ['### 1. SYN-EMPTY\n', '### 1. SYN-PARTIAL\n\nSTATUS: Closed.\\\n']) {
      const r = await makeBridge(null, withHeader(AUTH_HEADER, bad)).execute('research_route', {});
      assert.strictEqual(r.index_loaded, false); assert.strictEqual(r.parse_status, 'MALFORMED_CARDS'); assert(!r.cards);
    }
    // authority is checked BEFORE cards: an invalid contract wins over everything else
    const both = await makeBridge(null, withHeader(swap('CANON', 'YES'), '### 1. SYN-EMPTY\n')).execute('research_route', {});
    assert.strictEqual(both.parse_status, 'AUTHORITY_CONTRACT_INVALID');
  });
  await T('authority-real-index', 'H: committed real index passes the authority contract; tampered copies of it fail closed', async () => {
    const a = Router.parseAuthorityContract(INDEX_MD); assert.strictEqual(a.valid, true, JSON.stringify(a.problems));
    assert.deepStrictEqual(a.declared, { STATUS: 'RESEARCH_INDEX_ONLY', CANON: 'NO', RUNTIME_AUTHORITY: 'NO', PRIMARY_EVIDENCE: 'NO' });
    const r = await ex('research_route', {}); assert.strictEqual(r.index_loaded, true); assert.strictEqual(r.parse_status, 'OK'); assert.strictEqual(r.authority_contract.valid, true);
    for (const key of ['CANON', 'RUNTIME_AUTHORITY', 'PRIMARY_EVIDENCE']) {
      const tampered = INDEX_MD.replace(new RegExp('^' + key + ': `NO`', 'm'), key + ': `YES`'); assert.notStrictEqual(tampered, INDEX_MD);
      await assertAuthFail(tampered, 'real index with ' + key + '=YES', new RegExp(key + ': declared YES'));
    }
    await assertAuthFail(INDEX_MD.replace(/^CANON: `NO`\\?\n/m, ''), 'real index without CANON', /CANON: missing/);
    for (const key of ['STATUS', 'CANON', 'RUNTIME_AUTHORITY', 'PRIMARY_EVIDENCE']) {
      assert.strictEqual(a.found[key].length, 1, 'real index declares ' + key + ' exactly once');
      const dup = INDEX_MD.replace(new RegExp('^(' + key + ': `[A-Z_]+`\\\\?\\n)', 'm'), '$1$1'); assert.notStrictEqual(dup, INDEX_MD);
      await assertAuthFail(dup, 'real index with duplicated ' + key, new RegExp(key + ': duplicate declaration'));
    }
  });

  // ── Repair round 3: bounded collection outputs + source role order ──
  await T('wm-get-adversarial-role-order', 'wm_get adversarial: link-primary NAVIGATION (is_primary=1) vs role PRIMARY (is_primary=0), many sources, deterministic tie-breakers, no dependence on link order', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'ad', code: 'AD', name: 'AD' }));
    const mk = async (id, role, title) => must(await st.createSource({ source_id: id, project_id: 'ad', surface: 'LOCAL', role, title, locator: 'local://' + id }));
    await mk('nav-a', 'NAVIGATION', 'AAA first nav'); await mk('nav-b', 'NAVIGATION', 'BBB second nav');
    await mk('prim-z', 'PRIMARY', 'ZZZ late primary'); await mk('prim-m', 'PRIMARY', 'MMM primary'); await mk('prim-m2', 'PRIMARY', 'MMM primary');   // same title -> source_id tie-break
    await mk('ref', 'REFERENCE', '000 reference'); await mk('evid', 'EVIDENCE', '000 evidence');
    const it = must(await st.createItem({ project_id: 'ad', title: 'adversarial item', provenance_class: 'USER_NOTE' }));
    // link in the most hostile order: NAVIGATION first and primary-flagged, PRIMARY-role sources unflagged and linked last
    for (const [id, flag] of [['nav-a', 1], ['ref', 0], ['evid', 0], ['nav-b', 0], ['prim-z', 0], ['prim-m2', 0], ['prim-m', 0]]) must(await st.addItemSource({ work_id: it.work_id, source_id: id, is_primary: flag }));
    assert.strictEqual(st.listItemSources(it.work_id)[0].source_id, 'nav-a', 'precondition: link-primary order puts the NAVIGATION source first');
    const g = await makeBridge(st).execute('wm_get', { work_id: it.work_id });
    assert.deepStrictEqual(g.sources.items.map(x => x.source_id), ['prim-m', 'prim-m2', 'prim-z', 'nav-a', 'nav-b', 'evid', 'ref']);
    assert.deepStrictEqual(g.sources.items.map(x => x.is_primary), [false, false, false, true, false, false, false], 'is_primary preserved as separate link metadata');
    assert.strictEqual(g.sources.items[0].role, 'PRIMARY'); assert.strictEqual(g.sources.items.find(x => x.source_id === 'nav-a').role, 'NAVIGATION');
    // the ordering is stable across reads and survives a smaller limit (PRIMARY is never cut in favour of the link-primary NAVIGATION)
    const lim = await makeBridge(st).execute('wm_get', { work_id: it.work_id, sources_limit: 3 });
    assert.deepStrictEqual(lim.sources.items.map(x => x.source_id), ['prim-m', 'prim-m2', 'prim-z']); assert.strictEqual(lim.sources.total, 7); assert.strictEqual(lim.sources.truncated, true);
    assert.deepStrictEqual(await makeBridge(st).execute('wm_get', { work_id: it.work_id }), g, 'deterministic');
  });
  await T('bounded-collections', 'wm_list_projects / wm_project_sources / wm_get sources+relations / wm_related are bounded with items,total,truncated (nothing dropped silently; DB untouched)', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    for (let i = 0; i < 60; i++) must(await st.createProject({ project_id: 'bp' + i, code: 'BP' + String(i).padStart(2, '0'), name: 'P' + i }));
    const hubProject = 'bp0';
    for (let i = 0; i < 60; i++) must(await st.createSource({ source_id: 'bs' + String(i).padStart(2, '0'), project_id: hubProject, surface: 'LOCAL', role: 'NAVIGATION', title: 'A nav ' + String(i).padStart(2, '0'), locator: 'local://bs/' + i }));
    must(await st.createSource({ source_id: 'bprim', project_id: hubProject, surface: 'GITHUB', role: 'PRIMARY', title: 'Z primary', locator: 'github://synthetic/prim' }));
    const hub = must(await st.createItem({ project_id: hubProject, title: 'hub', provenance_class: 'USER_NOTE' }));
    for (let i = 0; i < 25; i++) must(await st.addItemSource({ work_id: hub.work_id, source_id: 'bs' + String(i).padStart(2, '0'), is_primary: 0 }));
    must(await st.addItemSource({ work_id: hub.work_id, source_id: 'bprim', is_primary: 0 }));
    for (let i = 0; i < 60; i++) { const o = must(await st.createItem({ project_id: hubProject, title: 'other ' + i, provenance_class: 'USER_NOTE' }));
      must(await st.addRelation(i % 2 ? { from_work_id: o.work_id, to_work_id: hub.work_id, relation_type: 'RELATED_TO' } : { from_work_id: hub.work_id, to_work_id: o.work_id, relation_type: 'DEPENDS_ON' })); }
    const before = allWm(d);
    const shape = (r, total, len, trunc, label) => { assert.strictEqual(r.items.length, len, label + ' items'); assert.strictEqual(r.total, total, label + ' total'); assert.strictEqual(r.truncated, trunc, label + ' truncated'); };
    shape(await b.execute('wm_list_projects'), 60, 20, true, 'projects default');
    shape(await b.execute('wm_list_projects', { limit: 5 }), 60, 5, true, 'projects limit 5');
    shape(await b.execute('wm_list_projects', { limit: 1000 }), 60, 50, true, 'projects capped at 50');
    shape(await b.execute('wm_project_sources', { project: 'bp0' }), 61, 20, true, 'project_sources default');
    shape(await b.execute('wm_project_sources', { project: 'bp0', limit: 50 }), 61, 50, true, 'project_sources max');
    const g = await b.execute('wm_get', { work_id: hub.work_id });
    shape(g.sources, 26, 10, true, 'get sources default'); shape(g.relations, 60, 20, true, 'get relations default');
    const g2 = await b.execute('wm_get', { work_id: hub.work_id, sources_limit: 50, relations_limit: 50 });
    shape(g2.sources, 26, 26, false, 'get sources raised'); shape(g2.relations, 60, 50, true, 'get relations raised');
    const rel = await b.execute('wm_related', { work_id: hub.work_id }); shape(rel, 60, 20, true, 'related default'); assert.strictEqual(rel.inferred_edges, false);
    shape(await b.execute('wm_related', { work_id: hub.work_id, limit: 3 }), 60, 3, true, 'related limit 3');
    assert.strictEqual(allWm(d), before, 'read tools mutated wm_*'); assert.strictEqual(d.exec('SELECT count(*) FROM wm_relations')[0].values[0][0], 60);
    // small collections are complete and not flagged
    const small = await makeBridge(store).execute('wm_list_projects'); assert.strictEqual(small.truncated, false); assert.strictEqual(small.total, small.items.length);
  });
  await T('wm-get-source-role-order', 'wm_get orders sources by ROLE (PRIMARY before NAVIGATION), not by item-link is_primary; is_primary is preserved as link metadata', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'ro', code: 'RO', name: 'RO' }));
    must(await st.createSource({ source_id: 'nav', project_id: 'ro', surface: 'NOTION', role: 'NAVIGATION', title: 'A nav', locator: 'notion://nav' }));
    must(await st.createSource({ source_id: 'prim', project_id: 'ro', surface: 'GITHUB', role: 'PRIMARY', title: 'Z primary', locator: 'github://prim' }));
    must(await st.createSource({ source_id: 'ctx', project_id: 'ro', surface: 'WEB', role: 'CONTEXT', title: '0 context', locator: 'https://example.org/ctx' }));
    const it = must(await st.createItem({ project_id: 'ro', title: 'item', provenance_class: 'USER_NOTE' }));
    must(await st.addItemSource({ work_id: it.work_id, source_id: 'nav', is_primary: 1 }));
    must(await st.addItemSource({ work_id: it.work_id, source_id: 'prim', is_primary: 0 }));
    must(await st.addItemSource({ work_id: it.work_id, source_id: 'ctx', is_primary: 0 }));
    assert.deepStrictEqual(st.listItemSources(it.work_id).map(x => x.source_id)[0], 'nav', 'precondition: link-primary ordering puts NAVIGATION first');
    const g = await makeBridge(st).execute('wm_get', { work_id: it.work_id });
    assert.deepStrictEqual(g.sources.items.map(x => x.source_id), ['prim', 'nav', 'ctx']);
    assert.deepStrictEqual(g.sources.items.map(x => [x.role, x.is_primary]), [['PRIMARY', false], ['NAVIGATION', true], ['CONTEXT', false]]);
    assert.deepStrictEqual((await makeBridge(st).execute('wm_project_sources', { project: 'RO' })).items.map(x => x.source_id), ['prim', 'nav', 'ctx']);
  });

  await T('router-source-metadata', 'loader may report NETWORK / OFFLINE_CACHE source; reported as index_source', async () => {
    const b = Bridge.create({ store: null, router: Router, loadResearchIndex: async () => ({ text: SYN_INDEX, source: 'OFFLINE_CACHE' }) });
    assert.strictEqual((await b.execute('research_route', {})).index_source, 'OFFLINE_CACHE');
    assert.strictEqual((await synBridge().execute('research_route', {})).index_source, 'UNKNOWN');
  });
  await T('router-without-wm', 'research_route works with Working Memory unavailable; wm_* report WORKING_MEMORY_UNAVAILABLE', async () => {
    const b = makeBridge(null, SYN_INDEX);
    const r = await b.execute('research_route', { query: 'candidate' }); assert.strictEqual(r.index_loaded, true); assert.strictEqual(r.cards.length, 1);
    for (const [n, a] of [['wm_orientation', {}], ['wm_list_projects', {}], ['wm_list', {}], ['wm_get', { work_id: 'X-1' }], ['wm_search', { query: 'x' }], ['wm_related', { work_id: 'X-1' }], ['wm_project_sources', { project: 'P' }]]) {
      const w = await b.execute(n, a); assert.strictEqual(w.ok, false, n); assert.strictEqual(w.code, 'WORKING_MEMORY_UNAVAILABLE', n); assert.strictEqual(w.plane, 'WORKING');
    }
    const stale = await Bridge.create({ store: { listItems() { return []; } }, router: Router, loadResearchIndex: async () => SYN_INDEX }).execute('wm_orientation', {});
    assert.strictEqual(stale.code, 'WORKING_MEMORY_UNAVAILABLE'); assert.match(stale.error, /stale or incomplete/);
  });
  await T('router-bounded', 'router output is bounded and clipped fields are flagged', async () => {
    const big = SYN_INDEX.replace('QUESTION: Beta?', 'QUESTION: ' + 'q'.repeat(2000)).replace('STATUS: Unknown.', 'STATUS: ' + 'u'.repeat(900));
    const r = await makeBridge(null, big).execute('research_route', { query: 'syn-beta' });   // query results are clipped ...
    assert([...r.cards[0].QUESTION].length <= 501); assert(r.cards[0].truncated_fields.includes('QUESTION')); assert.match(r.note, /call \{ card: N \} for the complete card/);
    const whole = (await makeBridge(null, big).execute('research_route', { card: 2 })).cards[0];   // ... a direct card is complete
    assert.strictEqual(whole.QUESTION, 'q'.repeat(2000)); assert.deepStrictEqual(whole.truncated_fields, []);
    const list = await makeBridge(null, big).execute('research_route', {}); assert(list.cards.find(c => c.card_number === 5).truncated_fields.includes('STATUS'));
    assert(JSON.stringify(await ex('research_route', {})).length < 20000); assert(JSON.stringify(await ex('research_route', { query: 'e' })).length < 12000);
  });
  await T('router-no-mutation-meta', 'router results never claim promotion and carry the research-only header', async () => {
    for (const a of [{}, { card: 1 }, { query: 'alpha' }]) { const r = await synBridge().execute('research_route', a); assert.strictEqual(r.promoted_to_working, false); assert.strictEqual(r.header, Router.HEADER); assert.strictEqual(r.read_only, true); }
  });

  // ── Contamination ──
  await T('contam-A', 'research CANDIDATE/NOT_RUN is a research candidate, not a working decision; WM has no such decision', async () => {
    const c = (await synBridge().execute('research_route', { query: 'SYN-DELTA' })).cards[0];
    assert.strictEqual(c.plane, 'RESEARCH'); assert.match(c.STATUS, /Candidate next experiment/); assert.strictEqual(c.EXECUTION_VERDICT, '`NOT_RUN`.');
    assert(!/PASS|FAIL/.test(JSON.stringify(c)));
    assert.strictEqual((await ex('wm_search', { query: 'SYN-DELTA' })).items.length, 0);
    assert.strictEqual((await ex('wm_list', { type: 'DECISION', status: 'CURRENT' })).items.some(i => /SYN-DELTA|JST/.test(i.title)), false);
  });
  await T('contam-B', 'working USER_DECISION to run an experiment later stays a working decision, not a validated result', async () => {
    const g = await ex('wm_get', { work_id: ids.dec });
    assert.strictEqual(g.plane, 'WORKING'); assert.strictEqual(g.item.provenance_class, 'USER_DECISION'); assert.strictEqual(g.item.type, 'DECISION');
    assert.strictEqual(g.item.non_canon, 1); assert.notStrictEqual(g.item.provenance_class, 'EXPERIMENT_RESULT');
    assert(!/PRIMARY_EVIDENCE|execution_verdict/.test(JSON.stringify(g)));
    const hyp = await ex('wm_get', { work_id: ids.hyp }); assert.strictEqual(hyp.item.type, 'HYPOTHESIS'); assert.notStrictEqual(hyp.item.provenance_class, 'EXPERIMENT_RESULT');
  });
  await T('contam-E', 'MODEL_PROPOSAL stays MODEL_PROPOSAL, never USER_DECISION', async () => {
    const it = (await ex('wm_search', { query: 'graphiti' })).items[0]; assert.strictEqual(it.provenance_class, 'MODEL_PROPOSAL');
    const o = await ex('wm_orientation'); for (const i of [...o.open, ...o.current]) if (i.work_id === ids.hyp) assert.strictEqual(i.provenance_class, 'MODEL_PROPOSAL');
    assert(o.notice.includes('not user decisions'));
  });
  await T('plane-labels', 'every tool result is labeled with its plane (WORKING vs RESEARCH)', async () => {
    for (const n of ['wm_orientation', 'wm_list', 'wm_search']) assert.strictEqual((await ex(n, { query: 'x' })).plane, 'WORKING');
    assert.strictEqual((await ex('research_route')).plane, 'RESEARCH');
  });

  // ── Intent routing / fresh-agent surface (deterministic; no model) ──
  await T('intent-diagnostic', 'DIAGNOSTIC ONLY (not runtime, not acceptance evidence): keyword intent helper behaves deterministically', async () => {
    for (const q of ['Где мы остановились?', 'Что сейчас в работе?', 'Что осталось по Crystal?', 'Что заблокировано?', 'Какой следующий шаг?', 'Найди рабочую заметку.'])
      assert.strictEqual(Bridge.routeIntent(q).intent, 'WORKING', q);
    for (const q of ['Какие эксперименты проводились?', 'Что показал TCE?', 'Что ещё не проверено?', 'Какие исследования NOT_RUN?', 'Где доказательства?', 'Какие есть research candidates?'])
      assert.strictEqual(Bridge.routeIntent(q).intent, 'RESEARCH', q);
    const m = Bridge.routeIntent('Что сейчас делать по Eiti и какое исследование с этим связано? Что в работе, какие эксперименты?');
    assert.strictEqual(m.intent, 'MIXED'); assert.deepStrictEqual(m.plane, ['WORKING', 'RESEARCH']);
    assert.deepStrictEqual(Bridge.routeIntent('привет').plane, ['WORKING']); assert.strictEqual(Bridge.DEFAULT_MODE, 'WORKING');
  });
  await T('fresh-agent-surface', 'fresh runtime (no chat history) gets working answers from wm_* and research answers from the router, separately labeled', async () => {
    const dbF = new SQL.Database(db.export()); const bF = makeBridge(WM.create(dbF, { persist: async () => ({ verified: true }) }));
    const w = await bF.execute('wm_orientation'); assert.strictEqual(w.plane, 'WORKING'); assert(w.in_progress.length && w.blocked.length && w.next_actions.length);
    const r = await bF.execute('research_route', { query: 'JST' }); assert.strictEqual(r.plane, 'RESEARCH');
    assert(!JSON.stringify(w).includes('RESEARCH_INDEX_ONLY')); assert(!JSON.stringify(r).includes(ids.prog));
    for (const phrase of ['DEFAULT_RUNTIME_MODE = WORKING', 'wm_orientation', 'WORKING:', 'RESEARCH:', 'MODEL_PROPOSAL / MODEL_SUMMARY != USER_DECISION', 'read-only'])
      assert(Bridge.GUIDANCE.includes(phrase), phrase);
  });
  // ═══ Final correctness round: reachability, scope, bounds, fidelity, strict args, unicode, SW fallback ═══
  const clip500 = t => { const cp = [...t]; return cp.length > 500 ? cp.slice(0, 500).join('') + '…' : t; };
  const loneSurrogate = t => /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(t);
  const cardBlock = (n, over) => {
    const f = Object.assign({ 'EXPERIMENT_ID / NAME': 'SYN-' + n, STATUS: 'Closed.', EXECUTION_VERDICT: 'Run complete.', PRIMARY_EVIDENCE: 'raw-' + n }, over || {});
    return ['### ' + n + '. SYN-' + n, '', ...Object.entries(f).map(([k, v]) => `${k}: ${v}\\`), ''].join('\n');
  };
  const synIndex = (cards, over) => ['# Synthetic', '', ...AUTH_HEADER, '', '## C. Experiment line index', '', cards.join('\n'), '## D. Map', ''].join('\n');
  const expectedMatches = (md, term) => {   // independent of the router's parser/search code
    const hits = []; for (const m of md.matchAll(/^### (\d+)\. (.+)$/gm)) {
      const n = Number(m[1]); const hay = [m[2], ...['EXPERIMENT_ID / NAME', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE'].map(k => rawField(md, n, k) || '')].join('\n').toLowerCase();
      if (hay.includes(term.toLowerCase())) hits.push(n);
    } return hits;
  };

  await T('router-query-reachability', 'every matching card number is discoverable (matched_card_numbers / omitted_card_numbers) and each omitted card can be fetched with {card:N}', async () => {
    const real = await ex('research_route', { query: 'NOT_RUN' });
    const expected = expectedMatches(INDEX_MD, 'NOT_RUN');   // the live index currently has 8 NOT_RUN cards
    assert(expected.length > Router.MAX_CARDS, 'precondition: the NOT_RUN query must exceed the full-card cap (' + expected.length + ')');
    assert.strictEqual(real.matched, expected.length); assert.deepStrictEqual(real.matched_card_numbers, expected);
    assert(real.cards.length <= Router.MAX_CARDS); assert.strictEqual(real.truncated, true);
    const shown = real.cards.map(c => c.card_number);
    assert.deepStrictEqual(real.omitted_card_numbers, expected.filter(n => !shown.includes(n)));
    assert.deepStrictEqual([...shown, ...real.omitted_card_numbers].sort((a, b) => a - b), expected, 'shown + omitted = every match');
    for (const n of real.omitted_card_numbers) {
      const r = await ex('research_route', { card: n }); assert.strictEqual(r.index_loaded, true); assert.strictEqual(r.cards[0].card_number, n); assert.deepStrictEqual(r.matched_card_numbers, [n]);
    }
    // synthetic: 9 matches, only 3 shown in full, all 9 numbers listed
    const md = synIndex(Array.from({ length: 12 }, (_, i) => cardBlock(i + 1, i < 9 ? { EXECUTION_VERDICT: '`NOT_RUN`.' } : {})));
    const syn = await makeBridge(null, md).execute('research_route', { query: 'not_run' });
    assert.deepStrictEqual(syn.matched_card_numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9]); assert.strictEqual(syn.cards.length, Router.MAX_CARDS); assert.deepStrictEqual(syn.omitted_card_numbers, [4, 5, 6, 7, 8, 9]);
    assert.match(syn.note, /omitted_card_numbers/);
    // no truncation -> nothing omitted; number lists are themselves bounded and flagged
    const few = await makeBridge(null, md).execute('research_route', { query: 'SYN-11' }); assert.deepStrictEqual(few.omitted_card_numbers, []); assert.strictEqual(few.truncated, false);
    const huge = synIndex(Array.from({ length: 205 }, (_, i) => cardBlock(i + 1)));
    const h = await makeBridge(null, huge).execute('research_route', { query: 'closed' });
    assert.strictEqual(h.matched, 205); assert.strictEqual(h.matched_card_numbers.length, 200); assert.strictEqual(h.matched_card_numbers_truncated, true);
    // overview also exposes cards it does not show
    const ov = await makeBridge(null, huge).execute('research_route', {}); assert.strictEqual(ov.cards.length, 30); assert.strictEqual(ov.truncated, true); assert.strictEqual(ov.omitted_card_numbers[0], 31);
  });
  await T('router-card-fidelity', 'all 19 named fields are returned verbatim, including several fields on one physical line; card 1 CONSISTENCY=PARTIAL_MISMATCH; NOTES/LAST_VERIFIED visible', async () => {
    const full = await ex('research_route', { card: 1 }); const c1 = full.cards[0];
    for (const k of ['PROJECT', 'SCIENTIFIC_INTERPRETATION', 'WHAT_WAS_OBSERVED', 'WHAT_IT_SUPPORTS', 'NOTION_REF', 'DRIVE_REF', 'NOTION_STATUS', 'DRIVE_STATUS', 'CONSISTENCY', 'LAST_VERIFIED', 'NOTES']) assert(c1[k], 'card 1 lacks ' + k);
    assert.match(c1.CONSISTENCY, /PARTIAL_MISMATCH/); assert.strictEqual(c1.CONSISTENCY, '`PARTIAL_MISMATCH`.');   // verbatim, incl. punctuation
    assert.match(c1.LAST_VERIFIED, /2026-10-06/); assert.match(c1.NOTES, /do not treat GH17 as Crystal primary evidence/);
    // multi-field physical lines are split, not left glued to the first field
    assert(!/NOTION_REF|DRIVE_REF/.test(c1.GITHUB_REF), 'GITHUB_REF swallowed its line-mates: ' + c1.GITHUB_REF);
    assert(!/DRIVE_STATUS|CONSISTENCY|LAST_VERIFIED/.test(c1.NOTION_STATUS) && !/CONSISTENCY|LAST_VERIFIED/.test(c1.DRIVE_STATUS));
    assert.match(c1.GITHUB_REF, /GH17/); assert.match(c1.NOTION_REF, /N12/); assert.match(c1.DRIVE_REF, /D01/); assert.match(c1.DRIVE_STATUS, /D01 reviewed/);
    // every real card: all 19 fields present and CONSISTENCY equals an independent extraction from the raw card block
    assert.strictEqual(Router.FIELD_KEYS.length, 19);
    for (const m of INDEX_MD.matchAll(/^### (\d+)\. /gm)) {
      const n = Number(m[1]); const start = INDEX_MD.indexOf(m[0]); const end = INDEX_MD.indexOf('\n### ', start + 5); const block = INDEX_MD.slice(start, end < 0 ? INDEX_MD.indexOf('\n## ', start) : end);
      const r = (await ex('research_route', { card: n })).cards[0];
      for (const k of Router.FIELD_KEYS) assert(r[k] !== null && r[k] !== undefined, `card ${n} lacks ${k}`);
      assert.strictEqual(r.CONSISTENCY, /CONSISTENCY: (`[A-Z_]+`\.)/.exec(block)[1], 'card ' + n + ' CONSISTENCY');
      assert.strictEqual(r.LAST_VERIFIED, /LAST_VERIFIED: (`[0-9-]+`\.)/.exec(block)[1], 'card ' + n + ' LAST_VERIFIED');
      assert.strictEqual(r.NOTES, clip500(/^NOTES: (.*?)\\?$/m.exec(block)[1].trim()), 'card ' + n + ' NOTES');
    }
    const c6 = (await ex('research_route', { card: 6 })).cards[0]; assert.match(c6.CONSISTENCY, /PARTIAL_MISMATCH/); assert(c6.NOTES && c6.NOTES.length > 0); assert.match(c6.LAST_VERIFIED, /2026/);
    const stale = (await ex('research_route', { card: 12 })).cards[0]; assert.match(stale.CONSISTENCY, /STALE_DRIVE/);
    // the overview surfaces CONSISTENCY too (a mismatch is visible without opening the card)
    const ov = await ex('research_route', {}); assert.match(ov.cards.find(c => c.card_number === 1).CONSISTENCY, /PARTIAL_MISMATCH/);
    // synthetic: inline groups in any order / subsets, values containing colons, no continuation loss
    const md = synIndex([cardBlock(1, { GITHUB_REF: '[GH1](#x).  NOTION_REF: [N1](#x).  DRIVE_REF: [D1](#x); note: unverified.', NOTION_STATUS: 'Closed: yes. CONSISTENCY: `PARTIAL_MISMATCH`. LAST_VERIFIED: `2026-10-07`.' , NOTES: 'caveat: do not promote.' })]);
    const sc = (await makeBridge(null, md).execute('research_route', { card: 1 })).cards[0];
    assert.strictEqual(sc.GITHUB_REF, '[GH1](#x).'); assert.strictEqual(sc.NOTION_REF, '[N1](#x).'); assert.strictEqual(sc.DRIVE_REF, '[D1](#x); note: unverified.');
    assert.strictEqual(sc.NOTION_STATUS, 'Closed: yes.'); assert.strictEqual(sc.DRIVE_STATUS, null); assert.strictEqual(sc.CONSISTENCY, '`PARTIAL_MISMATCH`.'); assert.strictEqual(sc.LAST_VERIFIED, '`2026-10-07`.'); assert.strictEqual(sc.NOTES, 'caveat: do not promote.');
    // nothing meaningful is dropped silently: continuation / unknown lines and repeated fields fail the whole index closed
    const unsupported = {
      'continuation line': cardBlock(2) + 'continued on the next line: FAIL\n',
      'unknown field line': cardBlock(2) + 'EXTRA_FIELD: something\\\n',
      'duplicate STATUS': cardBlock(2).replace('STATUS: Closed.\\', 'STATUS: Closed.\\\nSTATUS: REOPENED later.\\'),
    };
    for (const [label, card] of Object.entries(unsupported)) for (const args of [{}, { card: 1 }]) {
      const r = await makeBridge(null, synIndex([cardBlock(1), card])).execute('research_route', args);
      assert.strictEqual(r.index_loaded, false, label); assert.strictEqual(r.parse_status, 'UNSUPPORTED_CARD_CONTENT', label); assert(!r.cards, label); assert.strictEqual(r.unsupported_cards[0].card_number, 2);
      assert.strictEqual(r.partial_index_acceptance, 'NOT_ALLOWED_IN_B1');
    }
    assert.strictEqual((await ex('research_route', {})).parse_status, 'OK');
  });
  await T('router-failure-diagnostics', 'every fail-closed response has index_loaded=false, parse_status, entrypoint, diagnostics and no impossible "open the file" instruction; PARTIAL_INDEX_ACCEPTANCE stays NOT_ALLOWED', async () => {
    const bad = { html: '<html>404</html>', empty: '', authority: synIndex([cardBlock(1)]).replace('CANON: `NO`\\', 'CANON: `YES`\\'), nocards: ['# x', '', ...AUTH_HEADER, '', '## C. y', ''].join('\n'),
      malformed: synIndex([cardBlock(1), '### 2. SYN-EMPTY\n']), unsupported: synIndex([cardBlock(1) + 'stray prose\n']) };
    for (const [label, md] of Object.entries(bad)) {
      const r = await makeBridge(null, md).execute('research_route', { query: 'closed' });
      assert.strictEqual(r.index_loaded, false, label); assert(r.parse_status && r.parse_status !== 'OK', label); assert.strictEqual(r.entrypoint, Router.INDEX_PATH);
      assert(r.diagnostics && Array.isArray(r.diagnostics.reasons) && r.diagnostics.reasons.length >= 1, label + ' diagnostics'); assert(!r.cards, label);
      assert.strictEqual(r.partial_index_acceptance, 'NOT_ALLOWED_IN_B1'); assert.match(r.note, /Fail-closed/); assert(!/\bopen\b[^.]*\bdirectly\b/i.test(r.note), label + ': note tells the agent to open a file: ' + r.note);
    }
    const one = synIndex([cardBlock(1), cardBlock(2), '### 3. SYN-EMPTY\n', cardBlock(4)]);   // one bad card among valid ones: whole index unavailable
    const r1 = await makeBridge(null, one).execute('research_route', { card: 1 }); assert.strictEqual(r1.index_loaded, false); assert.strictEqual(r1.parse_status, 'MALFORMED_CARDS');
  });
  await T('router-strict-args', 'research_route arguments are validated strictly (blank query, string/zero/negative/fractional card)', async () => {
    for (const args of [{ query: '' }, { query: '   ' }, { query: 5 }, { card: '2' }, { card: 0 }, { card: -1 }, { card: 1.5 }, { card: 'abc' }, { line: '3' }, { card: 1, query: 'x' }, { card: 1, line: 2 }]) {
      const r = await synBridge().execute('research_route', args); assert.strictEqual(r.ok, false, JSON.stringify(args)); assert.strictEqual(r.code, 'VALIDATION', JSON.stringify(args)); assert.strictEqual(r.plane, 'RESEARCH');
    }
    assert.strictEqual((await synBridge().execute('research_route', { card: 3 })).cards[0].card_number, 3);
  });

  await T('orientation-project-scope', 'wm_orientation honours project_id (alias of project), rejects conflicts, never falls back to unscoped', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    must(await st.createProject({ project_id: 'proj-a', code: 'PRJA', name: 'A' })); must(await st.createProject({ project_id: 'proj-b', code: 'PRJB', name: 'B' }));
    const ia = must(await st.createItem({ project_id: 'proj-a', title: 'A in progress', status: 'IN_PROGRESS', next_action: 'a-next', provenance_class: 'USER_NOTE' }));
    const ib = must(await st.createItem({ project_id: 'proj-b', title: 'B blocked', status: 'BLOCKED', status_note: 'b-wait', provenance_class: 'USER_NOTE' }));
    must(await st.createSource({ source_id: 'sa', project_id: 'proj-a', surface: 'LOCAL', role: 'PRIMARY', title: 'a src', locator: 'local://a' })); must(await st.createSource({ source_id: 'sb', project_id: 'proj-b', surface: 'LOCAL', role: 'PRIMARY', title: 'b src', locator: 'local://b' }));
    const unscoped = await b.execute('wm_orientation'); assert.strictEqual(unscoped.scope, 'ALL_PROJECTS'); assert.strictEqual(unscoped.projects.total, 2);
    for (const args of [{ project_id: 'proj-a' }, { project: 'proj-a' }, { project: 'PRJA' }, { project_id: 'prja' }, { project: 'proj-a', project_id: 'PRJA' }]) {
      const o = await b.execute('wm_orientation', args); const text = JSON.stringify(o);
      assert.deepStrictEqual(o.scope, { project_id: 'proj-a', code: 'PRJA' }, JSON.stringify(args)); assert.deepStrictEqual(o.projects.items.map(p => p.project_id), ['proj-a']); assert.strictEqual(o.projects.total, 1);
      assert.deepStrictEqual(o.in_progress.map(i => i.work_id), [ia.work_id]); assert.strictEqual(o.blocked.length, 0);
      assert(!text.includes(ib.work_id) && !text.includes('proj-b') && !text.includes('local://b'), 'project B state leaked into A orientation ' + JSON.stringify(args));
    }
    assert.deepStrictEqual((await b.execute('wm_orientation', { project_id: 'proj-b' })).blocked.map(i => i.work_id), [ib.work_id]);
    for (const [tool, args] of [['wm_orientation', { project: 'proj-a', project_id: 'proj-b' }], ['wm_list', { project: 'PRJA', project_id: 'proj-b' }], ['wm_search', { query: 'x', project: 'proj-a', project_id: 'PRJB' }], ['wm_project_sources', { project: 'proj-b', project_id: 'proj-a' }]]) {
      const r = await b.execute(tool, args); assert.strictEqual(r.ok, false, tool); assert.strictEqual(r.code, 'VALIDATION', tool); assert.match(r.error, /different projects/);
    }
    for (const args of [{ project_id: 'nope' }, { project: 'nope' }, { project: 'proj-a', project_id: 'nope' }]) { const r = await b.execute('wm_orientation', args); assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'NOT_FOUND'); assert(!('in_progress' in r), 'must not fall back to an unscoped orientation'); }
    assert.strictEqual((await b.execute('wm_orientation', { project_id: 5 })).code, 'VALIDATION');
  });
  await T('orientation-projects-bounded', 'wm_orientation.projects is {items,total,truncated}, bounded by project_limit (default 10, max 50); nothing silently dropped; startup payload stays small', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    for (let i = 0; i < 150; i++) must(await st.createProject({ project_id: 'px' + i, code: 'PX' + String(i).padStart(3, '0'), name: 'Project ' + i, summary: 'S'.repeat(600) }));
    const o = await b.execute('wm_orientation');
    assert.strictEqual(o.projects.items.length, 10); assert.strictEqual(o.projects.total, 150); assert.strictEqual(o.projects.truncated, true);
    const o3 = await b.execute('wm_orientation', { project_limit: 3 }); assert.strictEqual(o3.projects.items.length, 3); assert.strictEqual(o3.projects.total, 150); assert.strictEqual(o3.projects.truncated, true);
    const big = await b.execute('wm_orientation', { project_limit: 1000 }); assert.strictEqual(big.projects.items.length, 50); assert.deepStrictEqual(big.limit_clamped, { project_limit: 50 }); assert.strictEqual(big.projects.truncated, true);
    assert((await b.execute('wm_orientation', { project_limit: 'ten' })).code === 'VALIDATION' && (await b.execute('wm_orientation', { project_limit: 0 })).code === 'VALIDATION');
    assert(JSON.stringify(o).length < 12000, 'default orientation payload ' + JSON.stringify(o).length); assert(JSON.stringify(big).length < 40000, 'max-project orientation payload ' + JSON.stringify(big).length);
    must(await st.createProject({ project_id: 'only', code: 'ONLY', name: 'x' })); assert.strictEqual((await makeBridge(st).execute('wm_orientation', { project_id: 'only' })).projects.truncated, false);
  });
  await T('strict-tool-arguments', 'runtime argument validation: missing/blank query, string booleans, invalid/clamped limits, non-string filters, non-object args', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st); must(await st.createProject({ project_id: 'sv', code: 'SV', name: 'SV' }));
    for (let i = 0; i < 3; i++) must(await st.createItem({ project_id: 'sv', title: 'strict item ' + i, status: i ? 'OPEN' : 'CURRENT', provenance_class: 'USER_NOTE' }));
    const arch = must(await st.createItem({ project_id: 'sv', title: 'strict archived', provenance_class: 'USER_NOTE' })); must(await st.archiveItem(arch.work_id));
    const bad = async (tool, args, label) => { const r = await b.execute(tool, args); assert.strictEqual(r.ok, false, label + ' ' + JSON.stringify(r).slice(0, 120)); assert.strictEqual(r.code, 'VALIDATION', label + ' ' + JSON.stringify(r).slice(0, 160)); assert.strictEqual(r.plane, 'WORKING'); return r; };
    await bad('wm_search', {}, 'missing query'); await bad('wm_search', { q: 'strict' }, 'mistyped key'); await bad('wm_search', { query: '' }, 'empty query'); await bad('wm_search', { query: '   \t' }, 'whitespace query'); await bad('wm_search', { query: 5 }, 'numeric query');
    await bad('wm_search', { query: 'strict', includeArchived: 'false' }, 'string "false"'); await bad('wm_search', { query: 'strict', includeArchived: 'true' }, 'string "true"'); await bad('wm_search', { query: 'strict', includeArchived: 0 }, 'numeric boolean');
    await bad('wm_list', { includeArchived: 'false' }, 'list string false'); await bad('wm_list', { includeArchived: 1 }, 'list numeric boolean');
    assert.strictEqual((await b.execute('wm_list', { includeArchived: false })).items.length, 3); assert.strictEqual((await b.execute('wm_list', { includeArchived: true })).items.length, 4); assert.strictEqual((await b.execute('wm_search', { query: 'strict', includeArchived: true })).items.length, 4);
    for (const lim of ['abc', '5', '', NaN, 0, -3, 2.5, true, [], {}, Infinity]) { if (lim === '') continue; await bad('wm_list', { limit: lim }, 'limit ' + String(lim)); }
    await bad('wm_search', { query: 'strict', limit: 'abc' }, 'search limit'); await bad('wm_list_projects', { limit: 0 }, 'projects limit'); await bad('wm_orientation', { limit: -1 }, 'orientation limit'); await bad('wm_get', { work_id: 'x', sources_limit: '3' }, 'sources_limit'); await bad('wm_related', { work_id: 'x', limit: 1.5 }, 'related limit'); await bad('wm_project_sources', { project: 'SV', limit: 'x' }, 'project_sources limit');
    // documented contract: omitted/null -> default; above max -> clamped and reported
    assert.strictEqual((await b.execute('wm_list', {})).items.length, 3); assert.strictEqual((await b.execute('wm_list', { limit: null })).items.length, 3); assert.strictEqual((await b.execute('wm_list', {})).limit_clamped, undefined);
    const clamped = await b.execute('wm_list', { limit: 500 }); assert.deepStrictEqual(clamped.limit_clamped, { limit: 50 }); assert.strictEqual((await b.execute('wm_list', { limit: 2 })).items.length, 2);
    assert.deepStrictEqual((await b.execute('wm_orientation', { limit: 99 })).limit_clamped, { limit: 10 });
    const g = await b.execute('wm_get', { work_id: st.listItems({})[0].work_id, sources_limit: 999, relations_limit: 999 }); assert.deepStrictEqual(g.limit_clamped, { sources_limit: 50, relations_limit: 50 });
    // required / typed identifiers and filters
    await bad('wm_get', {}, 'get without work_id'); await bad('wm_get', { work_id: 5 }, 'numeric work_id'); await bad('wm_get', { work_id: '  ' }, 'blank work_id'); await bad('wm_related', {}, 'related without work_id'); await bad('wm_project_sources', {}, 'sources without project');
    await bad('wm_list', { thread: 5 }, 'numeric thread'); await bad('wm_list', { status: 5 }, 'numeric status'); await bad('wm_list', { project: 5 }, 'numeric project');
    assert.strictEqual((await b.execute('wm_list', { status: 'BOGUS' })).ok, false);
    for (const args of ['text', ['a'], 7]) await bad('wm_list', args, 'non-object args');
    assert.strictEqual((await b.execute('wm_list', null)).ok === undefined, true); assert.strictEqual((await b.execute('wm_list', undefined)).items.length, 3);
    // blank optional filters are absent, not errors
    assert.strictEqual((await b.execute('wm_list', { status: '', thread: '  ' })).items.length, 3);   // blank optional FILTERS are absent; a blank SCOPE is rejected (see blank-scope-fails-closed)
  });
  await T('unicode-safe-clipping', 'agent-facing clipping is code-point safe: an emoji exactly across the cap is kept whole, never split into a lone surrogate', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    must(await st.createProject({ project_id: 'uc', code: 'UC', name: 'N'.repeat(199) + '😀' + 'tail', summary: 'S'.repeat(499) + '😀' + 'tail' }));
    const crossing = (n, tail) => 'a'.repeat(n - 1) + '😀' + tail;          // the emoji occupies UTF-16 units n and n+1 -> a plain slice(0, n) would cut it in half
    const it = must(await st.createItem({ project_id: 'uc', title: crossing(200, 'tail'), summary: crossing(500, 'tail'), current_question: crossing(300, 'x'), status: 'IN_PROGRESS',
      status_note: crossing(300, 'x'), next_action: crossing(300, 'x'), body_md: crossing(4000, 'tail'), tags: ['t'], provenance_class: 'USER_NOTE' }));
    assert(loneSurrogate('a'.repeat(199) + '😀'.slice(0, 1)), 'sanity: the detector flags a split pair');
    const o = await b.execute('wm_orientation'); const g = await b.execute('wm_get', { work_id: it.work_id }); const text = JSON.stringify([o, g]);
    assert(!loneSurrogate(text), 'lone surrogate in tool output');
    const row = o.in_progress[0]; assert.strictEqual(row.title, 'a'.repeat(199) + '😀' + '…'); assert.strictEqual([...row.title].length, 201);
    assert.strictEqual(row.summary, 'a'.repeat(499) + '😀' + '…'); assert.strictEqual(row.current_question, 'a'.repeat(299) + '😀' + '…');
    assert.strictEqual(g.item.body_md, 'a'.repeat(3999) + '😀' + '…'); assert.deepStrictEqual(g.item.truncated_fields.sort(), ['body_md', 'current_question', 'next_action', 'status_note', 'summary', 'title'].sort());
    assert.strictEqual(o.projects.items[0].name, 'N'.repeat(199) + '😀' + '…'); assert.strictEqual(o.projects.items[0].summary, 'S'.repeat(499) + '😀' + '…');
    // a string whose code-point count equals the cap is NOT truncated even though its UTF-16 length exceeds it
    const exact = must(await st.createItem({ project_id: 'uc', title: 'a'.repeat(199) + '😀', status: 'OPEN', provenance_class: 'USER_NOTE' }));
    const e = (await b.execute('wm_get', { work_id: exact.work_id })).item; assert.strictEqual(e.title, 'a'.repeat(199) + '😀'); assert(!e.truncated_fields.includes('title'));
    // the cut can land on any boundary: emoji-only text and mixed BMP/astral text
    for (const text2 of ['😀'.repeat(300), '😀a'.repeat(150), 'я'.repeat(199) + '👨‍👩‍👧' + 'z']) {
      const t = must(await st.createItem({ project_id: 'uc', title: text2, status: 'OPEN', provenance_class: 'USER_NOTE' })); const v = (await b.execute('wm_get', { work_id: t.work_id })).item.title;
      assert(!loneSurrogate(v)); assert(v === text2 || [...v].length === 201, 'clipped length'); assert.strictEqual(Buffer.from(v, 'utf8').toString('utf8'), v, 'UTF-8 round trip');
    }
    // research side: card fields are clipped by code point as well
    const md = synIndex([cardBlock(1, { QUESTION: 'q'.repeat(499) + '😀' + 'tail' }), cardBlock(2, { QUESTION: '😀'.repeat(600) })]);
    const rb = makeBridge(null, md); const q1 = (await rb.execute('research_route', { query: 'syn-1' })).cards[0]; const q2 = (await rb.execute('research_route', { query: 'syn-2' })).cards[0];
    assert.strictEqual(q1.QUESTION, 'q'.repeat(499) + '😀' + '…'); assert(q1.truncated_fields.includes('QUESTION')); assert.strictEqual([...q2.QUESTION].length, 501);
    assert(!loneSurrogate(JSON.stringify([q1, q2, await rb.execute('research_route', {})])));
    assert.deepStrictEqual(Router.clipCodePoints('ab😀cd', 3), { text: 'ab😀…', truncated: true }); assert.deepStrictEqual(Router.clipCodePoints('ab😀', 3), { text: 'ab😀', truncated: false });
  });

  // ── Service worker: Research Index fallback policy (mocked runtime) ──
  const makeSw = opts => {
    const vm = require('node:vm'); const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const caches = new Map(), listeners = {}; const net = { mode: 'ok', status: 200, body: IB('FRESH'), calls: 0 }; const timers = [];
    const cachesApi = { async open(name) { if (!caches.has(name)) caches.set(name, new Map()); const c = caches.get(name);
      return { async addAll() {}, async put(req, res) { c.set(req.url || req, res); }, async match(req) { const h = c.get(req.url || req); return h ? h.clone() : undefined; }, async delete(req) { return c.delete(req.url || req); } }; },
      async match(req) { for (const c of caches.values()) { const h = c.get(req.url || req); if (h) return h.clone(); } return undefined; }, async keys() { return [...caches.keys()]; }, async delete(k) { return caches.delete(k); } };
    const ctx = { self: { addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [] }, registration: {} }, caches: cachesApi,
      fetch: async (u, init) => { net.calls++; net.lastInit = init;
        if (net.mode === 'down') throw new TypeError('offline');
        if (net.mode === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new TypeError('aborted'))));
        if (net.mode === 'hang-body') return { status: 200, headers: new Headers(), text: () => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new TypeError('aborted')))) };
        return new Response(net.status === 204 ? null : net.body, { status: net.status, headers: net.headers }); },
      Response, Headers, Request, URL, console, AbortController, importScripts: opts && opts.noRouter ? () => { throw new Error('NetworkError: router script unavailable'); } : () => vm.runInContext(fs.readFileSync(path.join(ROOT, 'research-router.js'), 'utf8'), ctx),
      setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; }, clearTimeout: t => { if (t) t.cleared = true; } };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const name = src.match(/const CACHE_NAME = '([^']+)'/)[1]; const IDX = 'http://127.0.0.1:1/Eiti-Wizard-Lab/docs/research/EXPERIMENT_EVIDENCE_INDEX.md';
    const start = () => { const waits = []; const ev = { request: new Request(IDX), respondWith(p) { this.p = p; }, waitUntil(p) { waits.push(p); } }; listeners.fetch(ev); return { ev, waits }; };
    const fire = async () => { const { ev, waits } = start(); const res = await ev.p; return { res, waits }; };
    const expire = () => { const due = timers.filter(t => !t.cleared); due.forEach(t => { t.cleared = true; t.fn(); }); return due; };
    return { net, fire, start, expire, timers, cache: () => caches.get(name), name, IDX, seed: body => { caches.set(name, new Map([[IDX, new Response(body)]])); } };
  };
  await T('sw-research-5xx-fallback', 'research index: online fresh > stale cache; 5xx and transport failure fall back to a flagged cached copy; cache writes are covered by event.waitUntil', async () => {
    const w = makeSw();
    let { res, waits } = await w.fire(); assert.strictEqual(await res.text(), IB('FRESH')); assert(waits.length >= 1, 'cache write must be registered with event.waitUntil');
    await Promise.all(waits); assert.strictEqual(await w.cache().get(w.IDX).clone().text(), IB('FRESH'), 'fresh 200 is cached once the waited promise settles');
    for (const status of [500, 502, 503, 504, 599]) {
      w.net.status = status; w.net.body = 'SERVER-ERROR'; ({ res, waits } = await w.fire());
      assert.strictEqual(res.status, 200, 'status ' + status); assert.strictEqual(await res.text(), IB('FRESH'), 'stale cached copy served for ' + status);
      assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-stale-cache'); assert.strictEqual(w.cache().has(w.IDX), true, status + ' must not evict or overwrite the cache');
    }
    w.net.status = 200; w.net.body = IB('NEWER'); ({ res, waits } = await w.fire()); await Promise.all(waits);
    assert.strictEqual(await res.text(), IB('NEWER')); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null, 'online fresh beats stale cache'); assert.strictEqual(await w.cache().get(w.IDX).clone().text(), IB('NEWER'));
    w.net.mode = 'down'; ({ res } = await w.fire()); assert.strictEqual(await res.text(), IB('NEWER')); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-offline-cache');
    // no cached copy: the 5xx itself / a 504 is returned (never an invented success)
    const n = makeSw(); n.net.status = 503; n.net.body = 'DOWN'; ({ res } = await n.fire()); assert.strictEqual(res.status, 503); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null);
    n.net.mode = 'down'; ({ res } = await n.fire()); assert.strictEqual(res.status, 504);
  });
  await T('sw-research-404-no-stale', 'research index: 404/410 (authoritative removal) is NOT masked by an old cache and evicts it; other 4xx pass through untouched', async () => {
    for (const status of [404, 410]) {
      const w = makeSw(); w.seed(IB('OLD-INDEX')); w.net.status = status; w.net.body = 'GONE';
      const { res, waits } = await w.fire(); await Promise.all(waits);
      assert.strictEqual(res.status, status); assert.strictEqual(await res.text(), 'GONE'); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null, status + ' served the stale cache');
      assert.strictEqual(w.cache().has(w.IDX), false, status + ' did not evict the stale copy');
      w.net.mode = 'down'; const off = await w.fire(); assert.strictEqual(off.res.status, 504, 'after removal even offline must not resurrect the old index');
    }
    for (const status of [401, 403, 429]) {
      const w = makeSw(); w.seed(IB('OLD-INDEX')); w.net.status = status; w.net.body = 'DENIED'; const { res, waits } = await w.fire(); await Promise.all(waits);
      assert.strictEqual(res.status, status); assert.strictEqual(w.cache().has(w.IDX), true, status + ' must not evict'); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null);
    }
  });
  await T('index-loader-source', 'page loader maps the SW flag to index_source (NETWORK / OFFLINE_CACHE / STALE_CACHE) and the router exposes both header values', async () => {
    assert.strictEqual(Router.OFFLINE_VALUE, 'sw-offline-cache'); assert.strictEqual(Router.STALE_VALUE, 'sw-stale-cache');
    assert(/STALE_VALUE \? 'STALE_CACHE'/.test(INDEX_HTML) && /OFFLINE_VALUE \? 'OFFLINE_CACHE'/.test(INDEX_HTML));
    const b = Bridge.create({ store: null, router: Router, loadResearchIndex: async () => ({ text: SYN_INDEX, source: 'STALE_CACHE' }) });
    assert.strictEqual((await b.execute('research_route', {})).index_source, 'STALE_CACHE');
  });

  // ═══ Frozen merge-blocker round ═══
  await T('direct-card-complete', 'research_route({card:N}) returns every field COMPLETE (live card 11 STATUS = 533 code points, exact source value); only query/overview results are clipped', async () => {
    const raw11 = rawField(INDEX_MD, 11, 'STATUS'); assert([...raw11].length > 500, 'precondition: card 11 STATUS exceeds the query-result cap');
    const c11 = (await ex('research_route', { card: 11 })).cards[0];
    assert.strictEqual(c11.STATUS, raw11); assert.match(c11.STATUS, /\*\*not merged to main\*\*\.$/); assert.deepStrictEqual(c11.truncated_fields, []);
    assert.strictEqual((await ex('research_route', { line: 11 })).cards[0].STATUS, raw11, 'alias is complete too');
    // the same card through a query IS clipped and says how to get the rest
    const viaQuery = await ex('research_route', { query: 'Eiti-Wizard-Lab continuity stages' }); const q11 = viaQuery.cards.find(c => c.card_number === 11);
    assert(q11 && q11.truncated_fields.includes('STATUS') && q11.STATUS.length < raw11.length); assert.match(viaQuery.note, /\{ card: N \} for the complete card/);
    // every real card, every single-line field: exact source value, nothing truncated
    for (const m of INDEX_MD.matchAll(/^### (\d+)\. /gm)) {
      const n = Number(m[1]); const r = (await ex('research_route', { card: n })).cards[0]; assert.deepStrictEqual(r.truncated_fields, [], 'card ' + n);
      for (const k of ['QUESTION', 'STATUS', 'EXECUTION_VERDICT', 'SCIENTIFIC_INTERPRETATION', 'WHAT_WAS_OBSERVED', 'WHAT_IT_SUPPORTS', 'WHAT_IT_DOES_NOT_PROVE', 'OPEN_FINDING', 'PRIMARY_EVIDENCE', 'NOTES'])
        assert.strictEqual(r[k], rawField(INDEX_MD, n, k), `card ${n} ${k}`);
    }
    // synthetic: a very long field is complete on a direct request and clipped (flagged) elsewhere
    const md = synIndex([cardBlock(1, { QUESTION: 'q'.repeat(3000) + '😀' + 'end' })]); const b = makeBridge(null, md);
    assert.strictEqual((await b.execute('research_route', { card: 1 })).cards[0].QUESTION, 'q'.repeat(3000) + '😀' + 'end');
    assert((await b.execute('research_route', { query: 'closed' })).cards[0].truncated_fields.includes('QUESTION')); assert((await b.execute('research_route', {})).cards[0].truncated_fields.length >= 0);
  });
  await T('unknown-arguments-fail-closed', 'every B1 tool rejects unknown argument names (typos like projectId / include_archived / limt) with VALIDATION and executes nothing', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    must(await st.createProject({ project_id: 'ua-a', code: 'PA', name: 'A' })); must(await st.createProject({ project_id: 'ua-b', code: 'PB', name: 'B' }));
    const item = must(await st.createItem({ project_id: 'ua-a', title: 'ua item', provenance_class: 'USER_NOTE' })); must(await st.createItem({ project_id: 'ua-b', title: 'ua other', provenance_class: 'USER_NOTE' }));
    const typos = [['wm_list', { projectId: 'PA' }], ['wm_list', { include_archived: true }], ['wm_list', { limt: 5 }], ['wm_list', { project: 'PA', Status: 'OPEN' }], ['wm_list', { statuss: 'OPEN' }],
      ['wm_search', { query: 'ua', project_code: 'PA' }], ['wm_search', { query_text: 'ua' }], ['wm_search', { q: 'ua' }], ['wm_search', { query: 'ua', include_archived: true }], ['wm_search', { query: 'ua', projectId: 'PA' }],
      ['wm_orientation', { projectId: 'PA' }], ['wm_orientation', { projectLimit: 3 }], ['wm_orientation', { project_limt: 3 }], ['wm_list_projects', { limt: 3 }], ['wm_list_projects', { offset: 1 }],
      ['wm_get', { work_id: item.work_id, workId: item.work_id }], ['wm_get', { work_id: item.work_id, source_limit: 3 }], ['wm_related', { work_id: item.work_id, limt: 1 }],
      ['wm_project_sources', { project: 'PA', projectId: 'PA' }], ['wm_project_sources', { projectId: 'PA' }], ['research_route', { queryy: 'x' }], ['research_route', { cardNumber: 2 }], ['research_route', { card: 1, limit: 3 }]];
    for (const [tool, args] of typos) {
      const r = await b.execute(tool, args); assert.strictEqual(r.ok, false, tool + JSON.stringify(args)); assert.strictEqual(r.code, 'VALIDATION', tool + JSON.stringify(args)); assert.match(r.error, /Unknown argument\(s\)/);
      assert.match(r.error, new RegExp(Object.keys(args).find(k => !Bridge.TOOLS_SPEC.find(t => t.name === tool).parameters.properties[k] && k !== 'line'))); assert(!('items' in r) && !('cards' in r) && !('item' in r), 'nothing may be returned: ' + tool + JSON.stringify(args));
    }
    for (const tool of Bridge.TOOL_NAMES) { const r = await b.execute(tool, { zzz: null }); assert.strictEqual(r.code, 'VALIDATION', tool + ' null-valued unknown key'); }
    // intentionally supported spellings still work: project, project_id (and research_route's line alias)
    assert.strictEqual((await b.execute('wm_list', { project: 'PA' })).items.length, 1); assert.strictEqual((await b.execute('wm_list', { project_id: 'ua-a' })).items.length, 1);
    assert.strictEqual((await makeBridge(null, SYN_INDEX).execute('research_route', { line: 2 })).cards[0].card_number, 2);
    // the allowed set is exactly the declared parameters (+ line): every declared parameter name is accepted by its tool
    for (const spec of Bridge.TOOLS_SPEC) for (const key of Object.keys(spec.parameters.properties)) {
      const r = await b.execute(spec.name, { [key]: null }); assert(!/Unknown argument/.test(r.error || ''), spec.name + '.' + key + ' wrongly rejected as unknown');
    }
  });
  await T('duplicate-card-numbers-fail-closed', 'duplicate research card numbers fail the whole index closed (DUPLICATE_CARD_NUMBER); the normal 23-card index still passes', async () => {
    const dupes = {
      'identical duplicate': [cardBlock(1), cardBlock(1)],
      'same number, different titles': [cardBlock(1, { 'EXPERIMENT_ID / NAME': 'A' }).replace('SYN-1', 'ALPHA'), cardBlock(1, { 'EXPERIMENT_ID / NAME': 'B' }).replace('SYN-1', 'BETA')],
      'non-adjacent duplicate': [cardBlock(1), cardBlock(2), cardBlock(3), cardBlock(2)],
      'duplicate plus a malformed card': [cardBlock(1), cardBlock(1), '### 3. SYN-EMPTY\n'],
    };
    for (const [label, cards] of Object.entries(dupes)) for (const args of [{}, { card: 1 }, { query: 'closed' }]) {
      const r = await makeBridge(null, synIndex(cards)).execute('research_route', args);
      assert.strictEqual(r.index_loaded, false, label); assert.strictEqual(r.parse_status, 'DUPLICATE_CARD_NUMBER', label); assert(!r.cards && !('matched' in r) && !('total_cards' in r), label + ' leaked cards');
      assert(r.duplicate_card_numbers.length >= 1); assert.match(r.diagnostics.reasons[0], /appears \d+ times/); assert.strictEqual(r.partial_index_acceptance, 'NOT_ALLOWED_IN_B1');
    }
    const three = await makeBridge(null, synIndex([cardBlock(5), cardBlock(5), cardBlock(5), cardBlock(6), cardBlock(6)])).execute('research_route', {}); assert.deepStrictEqual(three.duplicate_card_numbers, [5, 6]); assert.match(three.diagnostics.reasons[0], /5 appears 3 times/);
    // the live index: unique numbers, passes
    const nums = [...INDEX_MD.matchAll(/^### (\d+)\. /gm)].map(m => m[1]); assert.strictEqual(new Set(nums).size, nums.length);
    const real = await ex('research_route', {}); assert.strictEqual(real.index_loaded, true); assert.strictEqual(real.parse_status, 'OK'); assert.strictEqual(real.total_cards, nums.length);
    // tampering with the real index: renumbering one card to an existing number fails closed
    const tampered = INDEX_MD.replace('### 2. ', '### 1. '); assert.notStrictEqual(tampered, INDEX_MD);
    const tr = await makeBridge(null, tampered).execute('research_route', { card: 1 }); assert.strictEqual(tr.parse_status, 'DUPLICATE_CARD_NUMBER'); assert(!tr.cards);
  });
  await T('research-single-runtime-path', 'research_route goes through the SAME bridge.execute path as the wm_* tools (also with WmStore=null): non-object args -> VALIDATION, one failure shape', async () => {
    // static: the in-app dispatcher has no direct router call; research_route shares the case block with the wm_* tools and calls bridge.execute
    assert(!/ResearchRouter\.routeWithLoader/.test(INDEX_HTML), 'dispatcher still calls the router directly');
    const block = INDEX_HTML.slice(INDEX_HTML.indexOf("      case 'research_route':\n      case 'wm_orientation'"), INDEX_HTML.indexOf("      case 'task_add': {"));
    assert(block.length > 100, 'research_route must share the dispatcher block with the wm_* tools');
    assert(/window\._wmAgentBridge\.bridge\.execute\(name, args\)/.test(block)); assert(!/ResearchRouter\./.test(block.replace(/router: window\.ResearchRouter/, '')), 'no second behavioural path in the dispatcher');
    assert(!/wizInitSQLite/.test(block.slice(0, block.indexOf('if (!window.WmAgentRead)')).replace(/if \(!isResearch\) \{ try \{ await wizInitSQLite\(\); \} catch \(_\) \{\} \}/, '')), 'research_route must not require SQLite');
    // behavioural: bridge with a null store
    const b = makeBridge(null, SYN_INDEX);
    for (const bad of ['text', [1, 2], 7, true]) for (const tool of Bridge.TOOL_NAMES) { const r = await b.execute(tool, bad); assert.strictEqual(r.ok, false, tool); assert.strictEqual(r.code, 'VALIDATION', tool); assert.match(r.error, /arguments must be an object/); assert.strictEqual(r.plane, tool === 'research_route' ? 'RESEARCH' : 'WORKING'); }
    assert.strictEqual((await b.execute('research_route', { card: 1 })).index_loaded, true); assert.strictEqual((await b.execute('research_route')).index_loaded, true); assert.strictEqual((await b.execute('research_route', null)).index_loaded, true);
    assert.strictEqual((await b.execute('wm_orientation')).code, 'WORKING_MEMORY_UNAVAILABLE');
    // one failure shape for an unavailable router: bridge-level, same fields as every other fail-closed response
    const savedRouter = globalThis.ResearchRouter; delete globalThis.ResearchRouter;   // in Node the bridge would otherwise fall back to the global router
    const noRouter = await Bridge.create({ store: null, router: null }).execute('research_route', { query: 'x' }); globalThis.ResearchRouter = savedRouter;
    assert.strictEqual(noRouter.index_loaded, false); assert.strictEqual(noRouter.parse_status, 'ROUTER_UNAVAILABLE'); assert.strictEqual(noRouter.plane, 'RESEARCH'); assert(noRouter.diagnostics.reasons.length >= 1); assert(!('ok' in noRouter));
  });
  await T('blank-query-semantics', 'research_route: blank optional query is ABSENT when card is given; blank query alone is VALIDATION', async () => {
    const b = synBridge();
    for (const args of [{ card: 1, query: '' }, { card: 1, query: '   ' }, { line: 2, query: '' }, { card: 3, query: '\t\n' }]) {
      const r = await b.execute('research_route', args); assert.strictEqual(r.index_loaded, true, JSON.stringify(args)); assert.strictEqual(r.matched, 1); assert.strictEqual(r.cards[0].card_number, args.card || args.line);
    }
    for (const args of [{ query: '' }, { query: '   ' }, { query: '\t' }]) { const r = await b.execute('research_route', args); assert.strictEqual(r.ok, false, JSON.stringify(args)); assert.strictEqual(r.code, 'VALIDATION'); assert.match(r.error, /non-empty string/); }
    for (const args of [{ card: 1, query: 5 }, { card: 1, query: null ? 'x' : {} }, { card: 1, query: 'x' }]) assert.strictEqual((await b.execute('research_route', args)).code, 'VALIDATION', JSON.stringify(args));
    assert.strictEqual((await b.execute('research_route', { card: 1, query: null })).matched, 1, 'null query is absent');
    assert.strictEqual((await b.execute('research_route', {})).index_loaded, true);
  });
  await T('stale-cache-explicit', 'index_source NETWORK / OFFLINE_CACHE / STALE_CACHE / UNKNOWN: a cached fallback is explicitly marked stale and never looks like fresh navigation', async () => {
    const via = async (source, args) => Bridge.create({ store: null, router: Router, loadResearchIndex: async () => ({ text: SYN_INDEX, source }) }).execute('research_route', args || { card: 1 });
    const net = await via('NETWORK'); assert.strictEqual(net.index_source, 'NETWORK'); assert.strictEqual(net.stale, false); assert(!('warning' in net));
    for (const source of ['STALE_CACHE', 'OFFLINE_CACHE']) for (const args of [{ card: 1 }, { query: 'syn' }, {}]) {
      const r = await via(source, args); assert.strictEqual(r.index_source, source); assert.strictEqual(r.stale, true, source); assert.match(r.warning, /STALE/); assert.match(r.warning, new RegExp(source)); assert(r.note.startsWith(r.warning), 'the note leads with the stale warning');
    }
    const unk = await Bridge.create({ store: null, router: Router, loadResearchIndex: async () => SYN_INDEX }).execute('research_route', { card: 1 }); assert.strictEqual(unk.index_source, 'UNKNOWN'); assert.strictEqual(unk.stale, null);
    // a fail-closed answer from a cached copy is flagged as well
    const bad = await Bridge.create({ store: null, router: Router, loadResearchIndex: async () => ({ text: '<html>x</html>', source: 'STALE_CACHE' }) }).execute('research_route', {}); assert.strictEqual(bad.index_loaded, false); assert.strictEqual(bad.stale, true); assert(bad.warning);
    const doc = fs.readFileSync(path.join(ROOT, 'docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md'), 'utf8');
    for (const v of ['`NETWORK`', '`OFFLINE_CACHE`', '`STALE_CACHE`', '`UNKNOWN`']) assert(doc.includes(v), v + ' documented');
  });
  await T('unicode-total-count', 'body_md_total_chars counts Unicode code points, the same unit as the clipping contract', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'ut', code: 'UT', name: 'UT' })); const b = makeBridge(st);
    for (const [label, body] of [['emoji only', '😀'.repeat(5000)], ['mixed', ('ab😀').repeat(2000)], ['astral boundary', 'a'.repeat(3999) + '😀' + 'tail'.repeat(10)], ['cyrillic', 'я'.repeat(4500)]]) {
      const it = must(await st.createItem({ project_id: 'ut', title: label, body_md: body, provenance_class: 'USER_NOTE' })); const g = (await b.execute('wm_get', { work_id: it.work_id })).item;
      const cps = [...body].length; assert(cps > 4000, label); assert.strictEqual(g.body_md_total_chars, cps, label + ': total must be code points, not UTF-16 units (' + body.length + ')'); assert.strictEqual([...g.body_md].length, 4001, label + ' (4000 + ellipsis)'); assert(g.truncated_fields.includes('body_md'));
    }
    const small = must(await st.createItem({ project_id: 'ut', title: 'small', body_md: '😀'.repeat(100), provenance_class: 'USER_NOTE' })); const sg = (await b.execute('wm_get', { work_id: small.work_id })).item; assert(!('body_md_total_chars' in sg)); assert.strictEqual(sg.body_md, '😀'.repeat(100));
  });
  await T('orientation-source-roles-explicit', 'orientation source_pointers declares included_roles [PRIMARY,NAVIGATION]; total/truncated refer to those roles only; wm_project_sources discovers every role', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    must(await st.createProject({ project_id: 'sr', code: 'SR', name: 'SR' })); must(await st.createProject({ project_id: 'sr-ev', code: 'SREV', name: 'only evidence' }));
    for (const [id, role] of [['p', 'PRIMARY'], ['n', 'NAVIGATION'], ['e', 'EVIDENCE'], ['c', 'CONTEXT'], ['r', 'REFERENCE']]) must(await st.createSource({ source_id: 'sr-' + id, project_id: 'sr', surface: 'LOCAL', role, title: role.toLowerCase(), locator: 'local://' + id }));
    must(await st.createSource({ source_id: 'sr-only-ev', project_id: 'sr-ev', surface: 'LOCAL', role: 'EVIDENCE', title: 'evidence only', locator: 'local://only-ev' }));
    const o = await b.execute('wm_orientation', { project: 'SR' }); const sp = o.source_pointers;
    assert.deepStrictEqual(sp.included_roles, ['PRIMARY', 'NAVIGATION']); assert.strictEqual(sp.full_source_discovery, 'wm_project_sources');
    assert.deepStrictEqual(sp.items.map(i => i.role), ['PRIMARY', 'NAVIGATION']); assert.strictEqual(sp.total, 2); assert.strictEqual(sp.truncated, false);
    const ev = (await b.execute('wm_orientation', { project: 'SREV' })).source_pointers; assert.deepStrictEqual(ev.included_roles, ['PRIMARY', 'NAVIGATION']); assert.deepStrictEqual(ev.items, []); assert.strictEqual(ev.total, 0);
    const all = await b.execute('wm_project_sources', { project: 'SR' }); assert.strictEqual(all.total, 5); assert.deepStrictEqual(all.items.map(i => i.role), ['PRIMARY', 'NAVIGATION', 'CONTEXT', 'EVIDENCE', 'REFERENCE'].sort((x, y) => ({ PRIMARY: 0, NAVIGATION: 1 }[x] ?? 9) - ({ PRIMARY: 0, NAVIGATION: 1 }[y] ?? 9) || 0));
    assert.strictEqual((await b.execute('wm_project_sources', { project: 'SREV' })).items[0].locator, 'local://only-ev');
    assert.match(Bridge.TOOLS_SPEC.find(t => t.name === 'wm_orientation').description, /PRIMARY \+ NAVIGATION roles only; use wm_project_sources/);
    assert.match(fs.readFileSync(path.join(ROOT, 'docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md'), 'utf8'), /included_roles/);
  });

  // ── research network reliability (service worker + page loader) ──
  await T('sw-research-timeout', 'a stalled research-index fetch is aborted after RESEARCH_FETCH_TIMEOUT_MS (shorter than the page budget) and falls back to the cached copy, else 504', async () => {
    const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); const swMs = Number(/RESEARCH_FETCH_TIMEOUT_MS = (\d+)/.exec(swSrc)[1]); const pageMs = Number(/WIZ_RESEARCH_FETCH_TIMEOUT_MS = (\d+)/.exec(INDEX_HTML)[1]);
    assert(swMs >= 1000 && swMs < pageMs, `SW budget (${swMs}) must be bounded and shorter than the page budget (${pageMs})`);
    for (const mode of ['hang', 'hang-body']) {
      const w = makeSw(); w.seed(IB('GOOD')); w.net.mode = mode;
      const { ev } = w.start(); await new Promise(r => setImmediate(r)); assert(w.timers.some(t => !t.cleared && t.ms === swMs), mode + ': the timeout must be armed'); assert(w.net.lastInit && w.net.lastInit.signal, 'fetch must carry an abort signal');
      w.expire(); const res = await ev.p;
      assert.strictEqual(res.status, 200, mode); assert.strictEqual(await res.text(), IB('GOOD')); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-offline-cache', mode);
      const n = makeSw(); n.net.mode = mode; const s2 = n.start(); await new Promise(r => setImmediate(r)); n.expire(); assert.strictEqual((await s2.ev.p).status, 504, mode + ' without a cache fails closed');
    }
    const ok = makeSw(); const run = await ok.fire(); await Promise.all(run.waits); assert(ok.timers.every(t => t.cleared), 'the timer is cleared after a normal response');
  });
  await T('sw-research-cache-poisoning', 'an HTTP 200 that is not the research index (captive portal / proxy page) never replaces the last known-good cached copy', async () => {
    const html = '<!doctype html><html><body>Please sign in to the Wi-Fi</body></html>';
    const w = makeSw(); w.seed(IB('GOOD'));
    for (const body of [html, '', '{"error":"upstream"}', 'STATUS: `RESEARCH_INDEX_ONLY` but no section C', '## C. only a section, no marker']) {
      w.net.status = 200; w.net.body = body; const { res, waits } = await w.fire(); await Promise.all(waits);
      assert.strictEqual(await res.text(), IB('GOOD'), 'a valid cached copy is served instead of the bogus 200: ' + JSON.stringify(body.slice(0, 30))); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-stale-cache');
      assert.strictEqual(await w.cache().get(w.IDX).clone().text(), IB('GOOD'), 'the good cached copy must not be overwritten');
    }
    // no cached copy: the body is passed through (the strict parser fails closed) but is NOT cached
    const n = makeSw(); n.net.body = html; const r2 = await n.fire(); await Promise.all(r2.waits); assert.strictEqual(await r2.res.text(), html); assert.strictEqual(n.cache() && n.cache().has(n.IDX), false, 'bogus 200 must never be cached');
    assert.strictEqual((await makeBridge(null, html).execute('research_route', {})).parse_status, 'NOT_AN_EVIDENCE_INDEX');
    // a valid index still wins and is cached; fresh network > cache
    w.net.body = IB('NEWER'); const ok = await w.fire(); await Promise.all(ok.waits); assert.strictEqual(await ok.res.text(), IB('NEWER')); assert.strictEqual(ok.res.headers.get('X-Eiti-Served-From'), null); assert.strictEqual(await w.cache().get(w.IDX).clone().text(), IB('NEWER'));
    // 404/410 still not masked; 5xx / transport failure still allowed to use the valid copy
    w.net.status = 404; w.net.body = 'gone'; const nf = await w.fire(); await Promise.all(nf.waits); assert.strictEqual(nf.res.status, 404); assert.strictEqual(w.cache().has(w.IDX), false);
  });
  await T('page-loader-timeout', 'the page-side research index loader has its own time budget (body included), maps the SW flags to index_source, and a timeout fails closed', async () => {
    const vm = require('node:vm'); const a = INDEX_HTML.indexOf('const WIZ_RESEARCH_FETCH_TIMEOUT_MS'), b2 = INDEX_HTML.indexOf('async function executeAgentTool(name, args) {');
    assert(a > 0 && b2 > a, 'loader source found'); const src = INDEX_HTML.slice(a, b2);
    const run = mode => { const timers = []; const win = { ResearchRouter: Router };
      const ctx = { window: win, AbortController, setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; }, clearTimeout: t => { t.cleared = true; },
        fetch: async (u, init) => {
          if (mode === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new TypeError('aborted'))));
          const body = mode === 'hang-body' ? () => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new TypeError('aborted')))) : async () => SYN_INDEX;
          const headers = new Headers(); if (mode === 'offline') headers.set(Router.OFFLINE_HEADER, Router.OFFLINE_VALUE); if (mode === 'stale') headers.set(Router.OFFLINE_HEADER, Router.STALE_VALUE);
          return { ok: mode !== 'http500', status: mode === 'http500' ? 500 : 200, headers, text: body }; } };
      vm.createContext(ctx); vm.runInContext(src + '\nthis.loader = wizResearchIndexLoader; this.budget = WIZ_RESEARCH_FETCH_TIMEOUT_MS;', ctx); return { ctx, timers, win }; };
    const swMs = Number(/RESEARCH_FETCH_TIMEOUT_MS = (\d+)/.exec(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'))[1]);
    for (const [mode, source] of [['network', 'NETWORK'], ['offline', 'OFFLINE_CACHE'], ['stale', 'STALE_CACHE']]) { const { ctx, timers } = run(mode); const r = await ctx.loader(); assert.strictEqual(r.source, source); assert.strictEqual(r.text, SYN_INDEX); assert(timers.every(t => t.cleared), 'timer cleared'); assert(ctx.budget > swMs); }
    assert.strictEqual(await run('http500').ctx.loader(), null);
    for (const mode of ['hang', 'hang-body']) {
      const { ctx, timers } = run(mode); const p = ctx.loader(); await new Promise(r => setImmediate(r)); const t = timers.find(x => !x.cleared); assert(t && t.ms === ctx.budget, mode + ': budget armed'); t.cleared = true; t.fn();
      await assert.rejects(p, /aborted/); assert(timers.every(x => x.cleared), 'timer cleared after the abort');
      const routed = await Router.routeWithLoader(() => Promise.reject(new TypeError('aborted')), { query: 'x' });   // what the bridge does with the rejection
      assert.strictEqual(routed.index_loaded, false); assert.strictEqual(routed.parse_status, 'FETCH_FAILED'); assert(!routed.cards);
    }
  });

  // ═══ Final frozen round ═══
  await T('blank-scope-fails-closed', 'a PRESENT project / project_id must be a non-blank string: blank, whitespace, null, non-string -> VALIDATION (never "all projects"); omitting both stays valid', async () => {
    const d = new SQL.Database(); const st = mkStore(d); const b = makeBridge(st);
    must(await st.createProject({ project_id: 'bs-a', code: 'BSA', name: 'A' })); must(await st.createProject({ project_id: 'bs-b', code: 'BSB', name: 'B' }));
    must(await st.createItem({ project_id: 'bs-a', title: 'bs alpha', provenance_class: 'USER_NOTE' })); must(await st.createItem({ project_id: 'bs-b', title: 'bs beta', provenance_class: 'USER_NOTE' }));
    must(await st.createSource({ source_id: 'bs-src', project_id: 'bs-a', surface: 'LOCAL', role: 'PRIMARY', title: 's', locator: 'local://s' }));
    const blanks = ['', ' ', '   ', '\t', '\n', ' \t\n ', null, 0, 5, false, {}, []];
    const tools = [['wm_orientation', {}], ['wm_list', {}], ['wm_search', { query: 'bs' }], ['wm_project_sources', {}]];
    for (const [tool, base] of tools) for (const key of ['project', 'project_id']) for (const v of blanks) {
      const r = await b.execute(tool, Object.assign({}, base, { [key]: v }));
      assert.strictEqual(r.ok, false, `${tool} ${key}=${JSON.stringify(v)} must fail closed`); assert.strictEqual(r.code, 'VALIDATION', `${tool} ${key}=${JSON.stringify(v)}`); assert.match(r.error, /non-empty, non-whitespace string/);
      assert(!('items' in r) && !('in_progress' in r) && !('projects' in r), `${tool} ${key}=${JSON.stringify(v)} leaked data`);
    }
    // blank in one alias + valid in the other is still a present blank scope
    for (const args of [{ project: '', project_id: 'bs-a' }, { project: 'bs-a', project_id: '  ' }, { project: 'BSA', project_id: null }]) assert.strictEqual((await b.execute('wm_list', args)).code, 'VALIDATION', JSON.stringify(args));
    // the four examples of the report, verbatim
    for (const [tool, args] of [['wm_list', { project: '' }], ['wm_list', { project: '   ' }], ['wm_list', { project_id: '' }], ['wm_search', { query: 'a', project: '' }]]) assert.strictEqual((await b.execute(tool, args)).code, 'VALIDATION', tool + JSON.stringify(args));
    // omitted scope = all projects (valid); undefined counts as omitted; real values still scope; unknown still NOT_FOUND; conflicts still VALIDATION
    assert.strictEqual((await b.execute('wm_list', {})).items.length, 2); assert.strictEqual((await b.execute('wm_list', { project: undefined })).items.length, 2); assert.strictEqual((await b.execute('wm_orientation', {})).scope, 'ALL_PROJECTS');
    assert.strictEqual((await b.execute('wm_search', { query: 'bs' })).items.length, 2); assert.strictEqual((await b.execute('wm_list', { project: 'BSA' })).items.length, 1); assert.strictEqual((await b.execute('wm_list', { project_id: 'bs-b' })).items.length, 1);
    assert.strictEqual((await b.execute('wm_list', { project: 'nope' })).code, 'NOT_FOUND'); assert.strictEqual((await b.execute('wm_list', { project: 'BSA', project_id: 'bs-b' })).code, 'VALIDATION');
    assert.strictEqual((await b.execute('wm_project_sources', { project_id: 'bs-a' })).items.length, 1); assert.strictEqual((await b.execute('wm_project_sources', {})).code, 'VALIDATION');
  });
  await T('research-available-accurate', 'wm_orientation.research.available reflects the real router availability; loaded stays false', async () => {
    const d = new SQL.Database(); const st = mkStore(d); must(await st.createProject({ project_id: 'ra', code: 'RA', name: 'RA' }));
    const withRouter = await Bridge.create({ store: st, router: Router }).execute('wm_orientation', {}); assert.deepStrictEqual(withRouter.research, { available: true, loaded: false, entrypoint: Router.INDEX_PATH });
    const saved = globalThis.ResearchRouter; delete globalThis.ResearchRouter;   // in Node the bridge would otherwise fall back to the global router
    try {
      const without = await Bridge.create({ store: st, router: null }).execute('wm_orientation', {}); assert.deepStrictEqual(without.research, { available: false, loaded: false, entrypoint: Router.INDEX_PATH });
      const broken = await Bridge.create({ store: st, router: {} }).execute('wm_orientation', {}); assert.strictEqual(broken.research.available, false);
      const route = await Bridge.create({ store: st, router: null }).execute('research_route', {}); assert.strictEqual(route.parse_status, 'ROUTER_UNAVAILABLE');   // consistent with available:false
    } finally { globalThis.ResearchRouter = saved; }
    assert.strictEqual((await Bridge.create({ store: st }).execute('wm_orientation', {})).research.available, true, 'global router present -> available');
  });
  await T('arg-validation-before-io', 'invalid research_route requests fail BEFORE the loader / network is called (LOADER_CALLS = 0); valid ones call it exactly once', async () => {
    const invalid = [['non-object string', 'text'], ['non-object array', [1]], ['non-object number', 7], ['non-object boolean', true], ['unknown key', { cardd: 1 }], ['unknown key with valid card', { card: 1, projectId: 'x' }],
      ['card string', { card: '11' }], ['card zero', { card: 0 }], ['card negative', { card: -2 }], ['card fraction', { card: 1.5 }], ['card NaN', { card: NaN }], ['card object', { card: {} }],
      ['line string', { line: '3' }], ['line zero', { line: 0 }], ['card + line conflict', { card: 1, line: 2 }], ['card + non-blank query', { card: 1, query: 'x' }], ['line + non-blank query', { line: 1, query: 'x' }],
      ['blank query no card', { query: '' }], ['whitespace query no card', { query: '   \t' }], ['non-string query', { query: 5 }], ['non-string query with card', { card: 1, query: 5 }], ['query object', { query: {} }]];
    for (const [label, args] of invalid) {
      let calls = 0; const loader = async () => { calls++; return INDEX_MD; };
      const viaRouter = await Router.routeWithLoader(loader, args); const viaBridge = await Bridge.create({ store: null, router: Router, loadResearchIndex: loader }).execute('research_route', args);
      for (const [path2, r] of [['router', viaRouter], ['bridge', viaBridge]]) { assert.strictEqual(r.ok, false, label + ' ' + path2); assert.strictEqual(r.code, 'VALIDATION', label + ' ' + path2); assert.strictEqual(r.plane, 'RESEARCH'); }
      assert.strictEqual(calls, 0, label + ': LOADER_CALLS must be 0, was ' + calls);
      assert.strictEqual(Router.route(INDEX_MD, args).code, 'VALIDATION', label + ' (route)'); assert.strictEqual(Router.preflightArgs(args).error.code, 'VALIDATION', label + ' (preflight)');
    }
    // valid requests do reach the loader, once; blank query WITH a card is valid
    for (const [label, args, expectMatched] of [['card', { card: 1 }, 1], ['line alias', { line: 2 }, 1], ['card + blank query', { card: 1, query: '' }, 1], ['card + whitespace query', { card: 3, query: '  ' }, 1], ['query', { query: 'syn' }, undefined], ['overview', {}, undefined], ['null args', null, undefined], ['undefined args', undefined, undefined]]) {
      let calls = 0; const loader = async () => { calls++; return SYN_INDEX; }; const r = await Router.routeWithLoader(loader, args);
      assert.strictEqual(calls, 1, label + ': a valid request calls the loader exactly once'); assert.strictEqual(r.index_loaded, true, label); if (expectMatched !== undefined) assert.strictEqual(r.matched, expectMatched, label);
    }
    // the preflight is a pure function of the arguments (no index, loader or I/O) and its allowed set is the tool's declared set + line
    assert.deepStrictEqual(Router.preflightArgs({ card: 4, query: '' }), { cardNumber: 4, query: null }); assert.deepStrictEqual(Router.preflightArgs({ query: ' x ' }), { cardNumber: null, query: ' x ' });
    assert.deepStrictEqual(Router.ALLOWED_ARGS.slice().sort(), [...Object.keys(Bridge.TOOLS_SPEC.find(t => t.name === 'research_route').parameters.properties), 'line'].sort());
    // a throwing / hanging loader is never reached for an invalid request
    assert.strictEqual((await Router.routeWithLoader(() => { throw new Error('loader must not run'); }, { card: '1' })).code, 'VALIDATION');
  });
  await T('index-source-docs-current', 'no documentation lists index_source values without STALE_CACHE; the canonical set is NETWORK / OFFLINE_CACHE / STALE_CACHE / UNKNOWN', async () => {
    const files = ['AGENT_START_HERE.md', 'docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md'].concat(fs.readdirSync(path.join(ROOT, 'docs/working-memory')).filter(f => f.endsWith('.md')).map(f => 'docs/working-memory/' + f));
    for (const f of new Set(files)) { const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
      for (const [i, line] of text.split('\n').entries()) if (/OFFLINE_CACHE|`UNKNOWN`/.test(line) && /`NETWORK`/.test(line)) { assert(/STALE_CACHE/.test(line), `${f}:${i + 1} lists index_source values without STALE_CACHE: ${line.slice(0, 120)}`); }
    }
    const doc = fs.readFileSync(path.join(ROOT, 'docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md'), 'utf8');
    assert(/`index_source` is `NETWORK`, `OFFLINE_CACHE`, `STALE_CACHE` or `UNKNOWN`/.test(doc), 'surface section lists the canonical four');
    assert(/index_source[^\n]*`NETWORK`[^\n]*`OFFLINE_CACHE`[^\n]*`STALE_CACHE`[^\n]*`UNKNOWN`/.test(doc.slice(doc.indexOf('index_source` / staleness'))), 'contract section lists the canonical four');
    // code and docs agree on the set
    const src = ['research-router.js', 'index.html'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n'); for (const v of ['NETWORK', 'OFFLINE_CACHE', 'STALE_CACHE']) assert(src.includes("'" + v + "'"), v + ' produced by code');
  });

  // ── Last-known-good research cache: strict admission, validated fallbacks ──
  const GOOD = IB('GOOD');
  const brokenVariants = {   // each LOOKS like the index (marker + section C) but fails the strict contract
    'unsupported card content (stray bullet)': IB('BAD').replace('PRIMARY_EVIDENCE: raw.', 'PRIMARY_EVIDENCE: raw.\n- NOTES: a stray bullet'),
    'continuation line': IB('BAD').replace('PRIMARY_EVIDENCE: raw.', 'PRIMARY_EVIDENCE: raw.\ncontinued on the next line'),
    'duplicate field in a card': IB('BAD').replace('STATUS: Closed.\\', 'STATUS: Closed.\\\nSTATUS: Reopened.\\'),
    'missing required field': IB('BAD').replace('EXECUTION_VERDICT: Run complete.\\\n', ''),
    'authority CANON=YES': IB('BAD').replace('CANON: `NO`', 'CANON: `YES`'),
    'authority flag missing': IB('BAD').replace('RUNTIME_AUTHORITY: `NO`\\\n', ''),
    'authority duplicated': IB('BAD').replace('CANON: `NO`\\', 'CANON: `NO`\\\nCANON: `NO`\\'),
    'duplicate card number': IB('BAD').replace('## D. Map', '### 1. SECOND\n\nSTATUS: s\\\nEXECUTION_VERDICT: e\\\nPRIMARY_EVIDENCE: p\n\n## D. Map'),
    'header only, no cards': IB('BAD').slice(0, IB('BAD').indexOf('### 1.')) + '## D. Map\n',
  };
  const swAdmits = async (w, body) => { w.net.status = 200; w.net.body = body; const { res, waits } = await w.fire(); await Promise.all(waits); return { res, cached: w.cache() && w.cache().has(w.IDX) ? await w.cache().get(w.IDX).clone().text() : null }; };
  await T('sw-strict-cache-admission', 'the service worker admits a network 200 into the cache ONLY if the router\'s strict validator accepts it (same function, same verdict as the router)', async () => {
    assert(/ResearchRouter\.validateResearchIndex/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'))); assert(!/looksLikeResearchIndex/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'no weaker second definition of a valid index');
    const corpus = Object.assign({ 'valid minimal index': GOOD, 'live index': INDEX_MD, 'captive portal html': '<!doctype html><html>Sign in</html>', 'empty': '', 'json': '{"e":1}' }, brokenVariants);
    for (const [label, body] of Object.entries(corpus)) {
      const verdict = Router.validateResearchIndex(body).ok; const w = makeSw(); const { res, cached } = await swAdmits(w, body);   // no prior cache
      assert.strictEqual(cached !== null, verdict, `${label}: SW admission (${cached !== null}) must equal router validity (${verdict})`);
      assert.strictEqual(await res.text(), body, label + ': with no valid cache the body is passed through (the router then fails closed)');
      assert.strictEqual((await makeBridge(null, body).execute('research_route', { card: 1 })).index_loaded, verdict, label + ': router verdict');
    }
    const live = makeSw(); await swAdmits(live, INDEX_MD); assert.strictEqual(live.cache().get(live.IDX) && await live.cache().get(live.IDX).clone().text(), INDEX_MD, 'the real index is admitted verbatim');
  });
  await T('sw-malformed-200-keeps-last-known-good', 'A/B/E: a malformed / unsupported-content / captive 200 never replaces a valid cached copy; the old copy is served flagged STALE_CACHE-style (sw-stale-cache)', async () => {
    const corpus = Object.assign({ 'captive portal html': '<!doctype html><html>Sign in to the Wi-Fi</html>', 'empty body': '', 'json error': '{"error":"upstream"}' }, brokenVariants);
    for (const [label, body] of Object.entries(corpus)) {
      const w = makeSw(); w.seed(GOOD); const { res, cached } = await swAdmits(w, body);
      assert.strictEqual(await res.text(), GOOD, label + ': the old valid copy must be served'); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-stale-cache', label); assert.strictEqual(cached, GOOD, label + ': the cache must be unchanged');
      // and end to end: what the router sees is explicitly stale and valid
      const viaPage = await Bridge.create({ store: null, router: Router, loadResearchIndex: async () => ({ text: GOOD, source: 'STALE_CACHE' }) }).execute('research_route', { card: 1 });
      assert.strictEqual(viaPage.stale, true); assert.match(viaPage.warning, /STALE/);
    }
    // D: a valid, different network index replaces the cache normally (fresh network > cache)
    const w = makeSw(); w.seed(GOOD); const NEW = IB('NEWER'); const { res, cached } = await swAdmits(w, NEW);
    assert.strictEqual(await res.text(), NEW); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null); assert.strictEqual(cached, NEW);
  });
  await T('sw-invalid-cache-not-served', 'C: a malformed cached copy is never treated as known-good: not served as fallback (offline / timeout / 5xx / malformed 200) and nothing malformed is served as research', async () => {
    const badCache = brokenVariants['unsupported card content (stray bullet)'];
    for (const mode of ['down', 'hang']) {
      const w = makeSw(); w.seed(badCache); w.net.mode = mode; const { ev } = w.start(); await new Promise(r => setImmediate(r)); if (mode === 'hang') w.expire(); const res = await ev.p;
      assert.strictEqual(res.status, 504, mode + ': an invalid cache must not be served'); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null);
    }
    const w5 = makeSw(); w5.seed(badCache); w5.net.status = 503; w5.net.body = 'down'; const r5 = await w5.fire(); assert.strictEqual(r5.res.status, 503); assert.strictEqual(r5.res.headers.get('X-Eiti-Served-From'), null);
    // malformed cache + malformed network 200 -> the malformed network body is passed through un-flagged and the ROUTER fails closed on it (never served as research)
    const wc = makeSw(); wc.seed(badCache); const bad200 = brokenVariants['authority CANON=YES']; const { res, cached } = await swAdmits(wc, bad200);
    assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null); assert.strictEqual(await res.text(), bad200); assert.strictEqual(cached, badCache, 'the old malformed copy is not replaced by the new malformed one');
    for (const body of [bad200, badCache]) { const r = await makeBridge(null, body).execute('research_route', { card: 1 }); assert.strictEqual(r.index_loaded, false); assert(!r.cards); assert(['AUTHORITY_CONTRACT_INVALID', 'UNSUPPORTED_CARD_CONTENT'].includes(r.parse_status)); }
    // a valid cache next to a transport failure is still served (flagged), proving the check is validity, not "never serve the cache"
    const wv = makeSw(); wv.seed(GOOD); wv.net.mode = 'down'; const rv = await wv.fire(); assert.strictEqual(await rv.res.text(), GOOD); assert.strictEqual(rv.res.headers.get('X-Eiti-Served-From'), 'sw-offline-cache');
  });
  await T('sw-validator-unavailable-fails-closed', 'if the router script cannot be imported the service worker admits nothing and trusts no cached copy', async () => {
    const w = makeSw({ noRouter: true }); w.seed(GOOD);
    const { res, cached } = await swAdmits(w, IB('NEWER')); assert.strictEqual(await res.text(), IB('NEWER')); assert.strictEqual(cached, GOOD, 'nothing is admitted without the validator');
    w.net.mode = 'down'; assert.strictEqual((await w.fire()).res.status, 504, 'the cached copy is not trusted without the validator');
  });

  await T('docs', 'AGENT_START_HERE keeps history and documents both planes', async () => {
    const d = fs.readFileSync(path.join(ROOT, 'AGENT_START_HERE.md'), 'utf8');
    for (const s of ['DEFAULT_RUNTIME_MODE        = WORKING', 'WORKING_MEMORY != RESEARCH_INDEX', 'RESEARCH_INDEX != RUNTIME_AUTHORITY', 'RESEARCH_RESULT != USER_DECISION', 'MEMORY_CONTINUITY != RESEARCH_EVIDENCE_INDEX', 'PR #28'])
      assert(d.includes(s), s);
    assert(INDEX_MD.includes('RESEARCH_INDEX_ONLY') && INDEX_MD.includes('CANON: `NO`'));
    const b1 = fs.readFileSync(path.join(ROOT, 'docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md'), 'utf8');
    // ONE canonical start sequence; in-app (runtime tools) vs repository agents are distinguished; no unconditional "read the index first"
    assert.strictEqual((d.match(/^## Canonical start sequence/gm) || []).length, 1, 'exactly one canonical start sequence');
    assert(!/^\d+\. Read \[docs\/research\/EXPERIMENT_EVIDENCE_INDEX\.md\]/m.test(d), 'the old unconditional "read the index" step is gone');
    const seq = d.slice(d.indexOf('## Canonical start sequence'), d.indexOf('Repository notes'));
    assert.strictEqual((seq.match(/^\d+\. /gm) || []).length, 6, 'six numbered steps');
    assert(/In-app agent/.test(d) && /Repository agent/.test(d) && /no\*\* `wm_\*` \/ `research_route` tools/.test(d), 'in-app vs repository agents documented');
    assert(/when runtime Working Memory is available/i.test(seq) && /Repository agent: runtime Working Memory is not available/.test(seq), 'wm_orientation only where runtime WM exists');
    assert(/only when the task requires research/i.test(seq) && /primary evidence/.test(seq) && /CONSISTENCY/.test(seq));
    assert(!/\bold sequence|Fresh-agent sequence/.test(d), 'no second start sequence');
    for (const s2 of ['FINAL_MODEL_MIXED_ANSWER_ENFORCEMENT = NOT_IMPLEMENTED', 'FRESH_MODEL_BEHAVIOR = NOT_RUN', 'MALFORMED_CARDS', '`STATUS`, `EXECUTION_VERDICT` and `PRIMARY_EVIDENCE`', 'PARTIAL_INDEX_ACCEPTANCE = NOT_ALLOWED_IN_B1', 'matched_card_numbers', 'omitted_card_numbers', 'limit_clamped', 'sw-stale-cache', 'UNSUPPORTED_CARD_CONTENT', '`project_limit`', 'code points', 'validateResearchIndex', 'Blank scope fails closed', 'preflightArgs', '`research: { available, loaded: false']) assert(b1.includes(s2), s2);
  });

  console.log(`\n${passed}/${passed + failed} tests passed.`);
  completed = true;
  process.exit(failed ? 1 : 0);
})();

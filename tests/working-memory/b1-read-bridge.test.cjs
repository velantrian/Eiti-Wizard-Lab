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

async function T(id, name, fn) {
  try { await fn(); passed++; console.log(`PASS  [${id}] ${name}`); }
  catch (e) { failed++; console.log(`FAIL  [${id}] ${name}\n      ${e.stack.split('\n').slice(0, 4).join('\n      ')}`); }
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
    assert(o.projects[0].truncated_fields.includes('name') && o.projects[0].truncated_fields.includes('summary'));
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
    const store = new Map(), listeners = {}; let netBody = 'NEW', netUp = true, netCalls = 0;
    const cachesApi = { async open(name) { if (!store.has(name)) store.set(name, new Map()); const c = store.get(name);
      return { async addAll() {}, async put(req, res) { c.set(typeof req === 'string' ? req : req.url, res); }, async match(req) { const hit = c.get(typeof req === 'string' ? req : req.url); return hit ? hit.clone() : undefined; } }; },
      async match(req) { for (const c of store.values()) { const hit = c.get(typeof req === 'string' ? req : req.url); if (hit) return hit.clone(); } return undefined; },
      async keys() { return [...store.keys()]; }, async delete(k) { return store.delete(k); } };
    const ctx = { self: { addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => [] }, registration: {} },
      caches: cachesApi, fetch: async () => { netCalls++; if (!netUp) throw new TypeError('offline'); return new Response(netBody, { status: 200 }); }, Response, Headers, Request, URL, console };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const name = src.match(/const CACHE_NAME = '([^']+)'/)[1]; assert.notStrictEqual(name, 'eiti-wizard-lab-v1.8.10-wm0'); assert.match(name, /^eiti-wizard-lab-/);
    const assets = src.slice(src.indexOf('STATIC_ASSETS'), src.indexOf('];')); for (const f of ['working-memory.js', 'wm-agent-read.js', 'research-router.js']) assert(assets.includes("'/" + f + "'"), f);
    const fire = async url => { const ev = { request: new Request('http://127.0.0.1:1' + url), respondWith(p) { this.p = p; }, waitUntil() {} }; listeners.fetch(ev); return ev.p; };
    const IDX = '/Eiti-Wizard-Lab/docs/research/EXPERIMENT_EVIDENCE_INDEX.md';
    store.set('eiti-wizard-lab-v1.8.10-wm0', new Map([['http://127.0.0.1:1' + IDX, new Response('OLD')], ['http://127.0.0.1:1/Eiti-Wizard-Lab/working-memory.js', new Response('OLD-JS')]]));
    // online: fresh network copy wins over the old cached copy, and is stored
    let res = await fire(IDX); assert.strictEqual(await res.text(), 'NEW'); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), null); assert(netCalls >= 1);
    await new Promise(r => setTimeout(r, 5)); assert(store.get(name).has('http://127.0.0.1:1' + IDX));
    // offline: cached copy, flagged
    netUp = false; res = await fire(IDX); assert.strictEqual(await res.text(), 'NEW'); assert.strictEqual(res.headers.get('X-Eiti-Served-From'), 'sw-offline-cache');
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
    const r = await makeBridge(null, big).execute('research_route', { card: 2 });
    assert(r.cards[0].QUESTION.length <= 401); assert(r.cards[0].truncated_fields.includes('QUESTION'));
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
  await T('docs', 'AGENT_START_HERE keeps history and documents both planes', async () => {
    const d = fs.readFileSync(path.join(ROOT, 'AGENT_START_HERE.md'), 'utf8');
    for (const s of ['DEFAULT_RUNTIME_MODE        = WORKING', 'WORKING_MEMORY != RESEARCH_INDEX', 'RESEARCH_INDEX != RUNTIME_AUTHORITY', 'RESEARCH_RESULT != USER_DECISION', 'MEMORY_CONTINUITY != RESEARCH_EVIDENCE_INDEX', 'PR #28'])
      assert(d.includes(s), s);
    assert(INDEX_MD.includes('RESEARCH_INDEX_ONLY') && INDEX_MD.includes('CANON: `NO`'));
    const b1 = fs.readFileSync(path.join(ROOT, 'docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md'), 'utf8');
    for (const s2 of ['FINAL_MODEL_MIXED_ANSWER_ENFORCEMENT = NOT_IMPLEMENTED', 'FRESH_MODEL_BEHAVIOR = NOT_RUN', 'MALFORMED_CARDS', '`STATUS`, `EXECUTION_VERDICT` and `PRIMARY_EVIDENCE`']) assert(b1.includes(s2), s2);
  });

  console.log(`\n${passed}/${passed + failed} tests passed.`);
  process.exit(failed ? 1 : 0);
})();

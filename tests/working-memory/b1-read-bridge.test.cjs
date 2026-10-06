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
function makeBridge(store) { return Bridge.create({ store, router: Router, loadResearchIndex: async () => INDEX_MD }); }

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
    const r = await ex('wm_list_projects'); assert.deepStrictEqual(r.projects.map(p => p.code), ['FIRN-B1', 'OTHER']);
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
    assert.strictEqual(g.item.status, 'IN_PROGRESS'); assert.strictEqual(g.sources.length, 1);
    assert.strictEqual(g.sources[0].locator, 'github://synthetic/firn#main'); assert.strictEqual(g.sources[0].is_primary, true);
    assert.deepStrictEqual(g.relations.map(r => [r.from_work_id, r.relation_type, r.to_work_id]), [[ids.blk, 'BLOCKED_BY', ids.prog]]);
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
    const r = await ex('wm_related', { work_id: ids.prog }); assert.strictEqual(r.inferred_edges, false); assert.strictEqual(r.relations.length, 1);
    assert.strictEqual((await ex('wm_related', { work_id: ids.cur })).relations.length, 0);
  });
  await T('sources', 'wm_project_sources returns surface/role/locator and does not fetch', async () => {
    const r = await ex('wm_project_sources', { project: 'FIRN-B1' });
    assert.strictEqual(r.fetched, false); assert.deepStrictEqual(r.sources.map(s => [s.surface, s.role, s.locator]).sort(),
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
    assert(o.source_pointers.some(s => s.locator === 'github://synthetic/firn#main'));
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
    assert.strictEqual((await b2.execute('wm_related', { work_id: ids.blk })).relations.length, 1);
    assert.strictEqual((await b2.execute('wm_get', { work_id: ids.prog })).sources[0].locator, 'github://synthetic/firn#main');
  });

  // ── Research router ──
  await T('router-real-index', 'research_route parses the real index: 23 lines, JST-CAUSAL-01 stays CANDIDATE/NOT_RUN, header preserved', async () => {
    const all = await ex('research_route'); assert.strictEqual(all.index_loaded, true); assert.strictEqual(all.total_lines, 23);
    assert.strictEqual(all.header, 'RESEARCH_INDEX_ONLY CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO'); assert.strictEqual(all.promoted_to_working, false);
    const c = (await ex('research_route', { line: 21 })).cards[0];
    assert.strictEqual(c.plane, 'RESEARCH'); assert.match(c.title, /JST-CAUSAL-01/);
    assert.match(c.STATUS, /Candidate next experiment, not a completed result/); assert.strictEqual(c.execution_verdict_token, 'NOT_RUN');
    assert.match(c.PRIMARY_EVIDENCE, /D01/); assert.strictEqual(c.GITHUB_REF.includes('UNKNOWN'), true);
  });
  await T('router-unknown', 'UNKNOWN verdict stays UNKNOWN (not FALSE/ABSENT); absent field is null; no-match is not "absent"', async () => {
    const c = (await ex('research_route', { line: 1 })).cards[0];
    assert.strictEqual(c.execution_verdict_token, 'UNKNOWN'); assert.match(c.EXECUTION_VERDICT, /`UNKNOWN`/);
    assert(!/FALSE|ABSENT/.test(c.EXECUTION_VERDICT));
    const syn = Router.route('## C. Experiment line index\n\n### 1. Synthetic\n\nSTATUS: Something.\\\n', { line: 1 }).cards[0];
    assert.strictEqual(syn.EXECUTION_VERDICT, null); assert.strictEqual(syn.execution_verdict_token, null);
    const none = await ex('research_route', { query: 'zzz-nothing' }); assert.strictEqual(none.matched, 0); assert.match(none.note, /Not evidence of absence/);
  });
  await T('router-not-run', 'NOT_RUN is never rewritten to PASS/FAIL', async () => {
    const md = '## C. Experiment line index\n\n### 1. SYN-NOTRUN-01\n\nEXPERIMENT_ID / NAME: SYN-NOTRUN-01.\\\nEXECUTION_VERDICT: `NOT_RUN`.\\\nSTATUS: Candidate.\\\n';
    const c = Router.route(md, { query: 'notrun' }).cards[0];
    assert.strictEqual(c.execution_verdict_token, 'NOT_RUN'); assert(!/PASS|FAIL/.test(JSON.stringify(c)));
  });
  await T('router-unavailable', 'unloadable index yields pointer only, nothing invented; loader failure tolerated', async () => {
    const b = Bridge.create({ store, router: Router, loadResearchIndex: async () => { throw new Error('offline'); } });
    const r = await b.execute('research_route', { query: 'TCE' }); assert.strictEqual(r.index_loaded, false); assert.strictEqual(r.entrypoint, Router.INDEX_PATH); assert(!r.cards);
  });
  await T('router-bounded', 'router output is bounded', async () => {
    assert(JSON.stringify(await ex('research_route', { query: 'e' })).length < 12000);
  });

  // ── Contamination ──
  await T('contam-A', 'research CANDIDATE/NOT_RUN is a research candidate, not a working decision; WM has no such decision', async () => {
    const c = (await ex('research_route', { query: 'JST-CAUSAL-01' })).cards.find(x => /JST-CAUSAL-01/.test(x.title));
    assert.strictEqual(c.plane, 'RESEARCH'); assert.strictEqual(c.execution_verdict_token, 'NOT_RUN');
    assert.strictEqual((await ex('wm_search', { query: 'JST-CAUSAL-01' })).total, 0);
    assert.strictEqual((await ex('wm_list', { type: 'DECISION', status: 'CURRENT' })).items.some(i => /JST/.test(i.title)), false);
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
  await T('intent', 'deterministic intent routing: working / research / mixed / default', async () => {
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
  });

  console.log(`\n${passed}/${passed + failed} tests passed.`);
  process.exit(failed ? 1 : 0);
})();

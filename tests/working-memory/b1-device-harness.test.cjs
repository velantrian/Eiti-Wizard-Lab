// B1-DEVICE-01 native test harness: node-level acceptance tests (no browser needed).
// The harness itself runs here inside a vm with a tiny DOM stub against a REAL sql.js database + the real WorkingMemory store, so the exact-entry
// table, the stale-harness matrix and the physical wm_* / FTS guard are exercised on the production code path. The real-browser flow lives in
// b1-device-browser.test.mjs. Synthetic frozen fixture only; no model is invoked.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert');
const ROOT = path.resolve(__dirname, '../..');
const initSqlJs = require(path.join(ROOT, 'sql-wasm.js'));
const WASM = fs.readFileSync(path.join(ROOT, 'sql-wasm.wasm'));
const WM = require(path.join(ROOT, 'working-memory.js'));
const HARNESS = fs.readFileSync(path.join(ROOT, 'b1-device-harness.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW_JS = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// The three DIFFERENT frozen checkpoints from B1-DEVICE STEP 1 — written out independently of the harness source.
const SEED_HASH = '780bfac4bce6442f46f5fc9827b0d8cc25cba3f4c80ad7e54bc2e87dabba1ec0';
const LOGICAL_EXPORT_HASH = '9334861791b8f64db8575d802159ac7c2d197a17fad563920dfd154ea1114b2a';
const RAW_FILE_SHA256 = '29b0e3d2e2025f1fab8979ae40169be78ce455549573617b57bd213e45eb73d4';
const COUNTS = { projects: 2, items: 9, sources: 3, relations: 1, item_sources: 1, changes: 16 };
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
// Reference definitions (STEP 1), re-implemented here with node crypto.
const BY_TITLE = {
  'FIRN current focus: resume Gate B1 orientation': 'cur', 'FIRN in-progress: polish parser adapters': 'prog', 'FIRN open: clarify export scope': 'open',
  'FIRN blocked: waiting owner review': 'blk', 'FIRN unknown: unexplained latency spike': 'unk', 'FIRN completed: seed schema ready': 'done',
  'FIRN model proposal: try Graphiti donor': 'hyp', 'FIRN user decision: keep DEFAULT_MODE WORKING': 'dec', 'OTHER distractor open: secret decoy task': 'oth',
};
const seedHash = d => { const ids = {}; for (const it of d.items) { const k = BY_TITLE[it.title]; if (k) ids[k] = it.work_id; }
  return sha256(JSON.stringify({ projects: ['FIRN', 'OTHER'], ids, description: 'Deterministic synthetic FIRN + OTHER distractor; statuses CURRENT/IN_PROGRESS/OPEN/BLOCKED/UNKNOWN/COMPLETED; MODEL_PROPOSAL; USER_DECISION; source+relation' })); };
const logicalHash = d => sha256(JSON.stringify({ format: d.format, projects: d.projects, sources: d.sources, items: d.items, item_sources: d.item_sources, relations: d.relations, changes: d.changes }));

let passed = 0, failed = 0, completed = false;
process.on('exit', code => { if (!completed && code === 0) { console.log('FAIL  [harness] the suite did not run to completion'); process.exitCode = 3; } });
async function T(id, name, fn) {
  let timer;
  try { await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('test timed out after 60s')), 60000); })]); passed++; console.log(`PASS  [${id}] ${name}`); }
  catch (e) { failed++; console.log(`FAIL  [${id}] ${name}\n      ${e.stack.split('\n').slice(0, 5).join('\n      ')}`); }
  finally { clearTimeout(timer); }
}
const embedded = () => { const m = HARNESS.match(/const FIXTURE_JSON = ("(?:[^"\\]|\\.)*");/); assert(m, 'FIXTURE_JSON literal not found'); return JSON.parse(m[1]); };
// Code only: block comments, whole-line comments and the fixture string literal are removed before token scans.
const codeOnly = () => HARNESS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l) && !/const FIXTURE_JSON = /.test(l)).join('\n');

// Build identity recipe (the harness recomputes the same thing at runtime from Function.prototype.toString).
const fnText = t => t.slice(t.indexOf('(function B1DeviceHarness() {') + 1, t.lastIndexOf('})();') + 1);
const buildIdOf = t => sha256(fnText(t).replace(/const HARNESS_BUILD_ID = '[0-9a-f]{12}';/, "const HARNESS_BUILD_ID = '';")).slice(0, 12);
const withId = (t, id) => t.replace(/\n  const HARNESS_BUILD_ID = '[0-9a-f]{12}';/, "\n  const HARNESS_BUILD_ID = '" + id + "';");
const declaredId = t => (t.match(/\n  const HARNESS_BUILD_ID = '([0-9a-f]{12})';/) || [])[1];
const HARNESS_ID = declaredId(HARNESS);
// A self-consistent OTHER build of the harness (a different but internally valid file), e.g. an older build.
const otherBuild = mutate => { const t = mutate(HARNESS); assert.notStrictEqual(t, HARNESS, 'mutation had no effect'); return withId(t, buildIdOf(t)); };

// ── The exact-entry table, shared by the index.html gate test and the harness test ────────────────────────────────────────────
const ORIGIN = 'http://127.0.0.1:8080';
const CANONICAL = ['/Eiti-Wizard-Lab/index.html?b1device=1', '/Eiti-Wizard-Lab/?b1device=1'];
// The app writes its own panel route into the hash on every load and Android reloads / restores tabs with it: that is NOT a variant of the entry condition.
const PANELS = ['projects', 'chat', 'agent', 'settings', 'notes', 'memory', 'history', 'files', 'eiti-files', 'diary', 'board'];
const CANONICAL_ROUTES = PANELS.flatMap(x => ['/Eiti-Wizard-Lab/index.html?b1device=1#' + x, '/Eiti-Wizard-Lab/?b1device=1#' + x]);
const NOT_EXACT = [
  // query
  '/Eiti-Wizard-Lab/index.html', '/Eiti-Wizard-Lab/', '/Eiti-Wizard-Lab/index.html?', '/Eiti-Wizard-Lab/index.html?b1device', '/Eiti-Wizard-Lab/index.html?b1device=',
  '/Eiti-Wizard-Lab/index.html?b1device=0', '/Eiti-Wizard-Lab/index.html?b1device=true', '/Eiti-Wizard-Lab/index.html?b1device=01', '/Eiti-Wizard-Lab/index.html?b1device=11',
  '/Eiti-Wizard-Lab/index.html?b1device=%31', '/Eiti-Wizard-Lab/index.html?b1device=1&x=1', '/Eiti-Wizard-Lab/index.html?x=1&b1device=1', '/Eiti-Wizard-Lab/index.html?b1device=1&b1device=1',
  '/Eiti-Wizard-Lab/index.html?b1device=1&b1device=0', '/Eiti-Wizard-Lab/index.html?b1device=1&', '/Eiti-Wizard-Lab/index.html?&b1device=1', '/Eiti-Wizard-Lab/index.html?B1DEVICE=1',
  '/Eiti-Wizard-Lab/index.html?b1device%3D1', '/Eiti-Wizard-Lab/index.html?x=b1device=1', '/Eiti-Wizard-Lab/?b1device=1&x=1', '/Eiti-Wizard-Lab/?x=1&b1device=1', '/Eiti-Wizard-Lab/?b1device=%31',
  // fragment
  '/Eiti-Wizard-Lab/index.html?b1device=1#', '/Eiti-Wizard-Lab/index.html?b1device=1#x', '/Eiti-Wizard-Lab/index.html?b1device=1#b1device=1', '/Eiti-Wizard-Lab/index.html#?b1device=1', '/Eiti-Wizard-Lab/?b1device=1#x',
  '/Eiti-Wizard-Lab/index.html?b1device=1#CHAT', '/Eiti-Wizard-Lab/index.html?b1device=1#chat-x', '/Eiti-Wizard-Lab/index.html?b1device=1#chat/', '/Eiti-Wizard-Lab/index.html?b1device=1#chat#x', '/Eiti-Wizard-Lab/index.html?b1device=1#%63hat',
  '/Eiti-Wizard-Lab/index.html?b1device=1#panel-chat', '/Eiti-Wizard-Lab/index.html?b1device=1#?b1device=1', '/Eiti-Wizard-Lab/?b1device=1#', '/Eiti-Wizard-Lab/?b1device=1#settings2',
  '/Eiti-Wizard-Lab/index.html?b1device=1&x=1#chat', '/Eiti-Wizard-Lab/index.html?x=1#chat', '/Eiti-Wizard-Lab/other.html?b1device=1#chat',
  // path
  '/Eiti-Wizard-Lab/index.html/?b1device=1', '/Eiti-Wizard-Lab/index.htm?b1device=1', '/Eiti-Wizard-Lab/other.html?b1device=1', '/Eiti-Wizard-Lab//index.html?b1device=1', '/eiti-wizard-lab/index.html?b1device=1',
  '/other/index.html?b1device=1', '/index.html?b1device=1', '/?b1device=1', '/Eiti-Wizard-Lab-copy/index.html?b1device=1', '/Eiti-Wizard-Lab/docs/index.html?b1device=1', '/Eiti-Wizard-Lab?b1device=1',
];
const locationOf = p => { const u = new URL(ORIGIN + p); return { pathname: u.pathname, search: u.search, hash: u.hash, href: u.href, origin: u.origin }; };
// What the page shows AFTER the app started: the app itself rewrites the hash (history.replaceState '#chat'); path and query stay as opened.
const afterAppStart = p => { const u = new URL(ORIGIN + p); u.hash = '#chat'; return { pathname: u.pathname, search: u.search, hash: u.hash, href: u.href, origin: u.origin }; };

// ── Harness runner: the real harness file in a vm, tiny DOM stub, real sql.js DB + real WorkingMemory store ───────────────────
function makeStore(SQL, { skipFts } = {}) {
  const db = new SQL.Database(); let n = 0;
  const store = WM.create(db, { now: () => '2026-10-07T00:00:00.000Z', actorClass: 'SYSTEM', idFactory: p => p + String(++n).padStart(6, '0'), persist: async () => ({ verified: true }) });
  return { db, store };
}
function runHarness(opts) {
  const { src = HARNESS, path: p = CANONICAL[0], db, store, onLine = true, noCrypto = false } = opts;
  const currentLocation = opts.currentPath ? afterAppStart(opts.currentPath) : afterAppStart(p);                 // the location the harness sees when it runs
  const navigationEntries = opts.noNavigationEntry ? [] : [{ name: ORIGIN + p }];                               // the URL as OPENED (fragment included)
  const id = declaredId(src);
  const expectedAttr = 'expectedAttr' in opts ? opts.expectedAttr : id;
  const scriptSrc = opts.scriptSrc || (ORIGIN + '/Eiti-Wizard-Lab/b1-device-harness.js?h=' + id);
  const registry = new Map();
  class El {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.styles = {}; this._id = ''; this.textContent = ''; this.disabled = false;
      this.style = { setProperty: (k, v) => { this.styles[k] = v; } }; }
    set id(v) { this._id = v; registry.set(v, this); } get id() { return this._id; }
    appendChild(c) { this.children.push(c); return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
    async tap() { if (this.disabled) return false; for (const f of this.listeners.click || []) await f(); return true; }   // a disabled button dispatches no click
    async forceClick() { for (const f of this.listeners.click || []) await f(); }                                         // simulates devtools re-enabling the button
  }
  const body = new El('body');
  const script = { src: scriptSrc, getAttribute: k => (k === 'data-expected-build' ? expectedAttr : null) };
  const document = { body, documentElement: new El('html'), currentScript: script, getElementById: i => registry.get(i) || null, createElement: t => new El(t), addEventListener() {} };
  const ctx = vm.createContext({ document, location: currentLocation, performance: { getEntriesByType: t => (t === 'navigation' ? navigationEntries : []) }, navigator: { onLine, userAgent: 'stub-ua', serviceWorker: { controller: null } },
    crypto: noCrypto ? undefined : crypto.webcrypto, TextEncoder, URL, isSecureContext: true, caches: { keys: async () => [] }, APP_VERSION: 'test', setTimeout, Date });
  ctx.window = ctx; ctx.WorkingMemory = WM;
  if (store) ctx.WmStore = store;
  if (db) ctx._wizDB = db;
  vm.runInContext(src, ctx, { filename: 'b1-device-harness.js' });
  const get = i => registry.get(i);
  const env = { ctx, body, registry, get,
    state: () => (get('b1device-root') ? get('b1device-root').attrs['data-run-state'] : null),
    // crypto.subtle.digest completes on the thread pool, so wait on the clock (not on a number of event-loop turns)
    async settled() { const t0 = Date.now(); while (Date.now() - t0 < 15000) { const s = env.state(); if (s && s !== 'VERIFYING') return s; await new Promise(r => setTimeout(r, 2)); } throw new Error('verification never settled'); },
    out: () => ({ verdict: get('b1d-verdict').attrs['data-verdict'], text: get('b1d-out').textContent }),
    async press(btn) { await get(btn).tap(); return env.out(); },
    async force(btn) { await get(btn).forceClick(); return env.out(); },
    buttonsDisabled: () => ['b1d-check', 'b1d-import', 'b1d-fingerprint'].map(b => get(b).disabled) };
  return env;
}
const physDump = db => { const names = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.map(v => v[0]).filter(n => n.startsWith('wm_'));
  return sha256(JSON.stringify(names.map(n => { let r; try { r = db.exec('SELECT * FROM "' + n + '"'); } catch (e) { r = 'ERR'; } return [n, r]; }))); };
const otherDump = db => sha256(JSON.stringify(db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.map(v => v[0]).filter(n => !n.startsWith('wm_')).map(n => [n, db.exec('SELECT * FROM "' + n + '"')])));
const NO_PASS = /IMPORT_PASS|FINGERPRINT_PASS|ENV_OK|PASS: imported/;
// The complete expected physical wm_* namespace of THIS WorkingMemory schema: six data tables + the FTS5 index + its five shadow tables.
const EXPECTED_PHYSICAL = ['wm_projects', 'wm_sources', 'wm_items', 'wm_item_sources', 'wm_relations', 'wm_changes',
  'wm_items_fts', 'wm_items_fts_content', 'wm_items_fts_docsize', 'wm_items_fts_idx', 'wm_items_fts_data', 'wm_items_fts_config'];
const wmTables = db => db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.map(v => v[0]).filter(n => n.startsWith('wm_')).sort();

(async () => {
  const SQL = await initSqlJs({ wasmBinary: WASM });

  await T('fixture-frozen', 'the embedded fixture is the exact frozen file: raw SHA-256, SEED_HASH, LOGICAL_EXPORT_HASH and counts all match (three different checkpoints, none substituted)', async () => {
    const raw = embedded();
    assert.strictEqual(sha256(raw), RAW_FILE_SHA256, 'raw file SHA-256');
    const fx = JSON.parse(raw);
    assert.strictEqual(fx.format, 'eiti-working-memory-export/1');
    assert.strictEqual(seedHash(fx), SEED_HASH, 'SEED_HASH');
    assert.strictEqual(logicalHash(fx), LOGICAL_EXPORT_HASH, 'LOGICAL_EXPORT_HASH');
    for (const k of Object.keys(COUNTS)) assert.strictEqual(fx[k].length, COUNTS[k], k);
    assert(new Set([SEED_HASH, LOGICAL_EXPORT_HASH, RAW_FILE_SHA256]).size === 3, 'three distinct checkpoints');
    for (const [name, v] of [['EXPECTED_SEED', SEED_HASH], ['EXPECTED_LOGICAL', LOGICAL_EXPORT_HASH], ['FIXTURE_RAW_SHA256', RAW_FILE_SHA256]])
      assert(new RegExp(`const ${name} = '${v}';`).test(HARNESS), name + ' constant');
    assert(/const EXPECTED = \{ projects: 2, items: 9, sources: 3, relations: 1, item_sources: 1, changes: 16 \};/.test(HARNESS), 'expected counts constant');
  });

  await T('fixture-real-import', 'WmStore.importJSON(exact fixture) on an empty store reproduces counts, LOGICAL_EXPORT_HASH and SEED_HASH; a second import is a no-op (the harness must abort on a non-empty store instead)', async () => {
    const { store } = makeStore(SQL);
    const res = await store.importJSON(JSON.parse(embedded()));
    assert(res.ok === true && res.data.noOp === false && res.data.imported === 32, JSON.stringify(res));
    const d = store.exportData();
    for (const k of Object.keys(COUNTS)) assert.strictEqual(d[k].length, COUNTS[k], k);
    assert.strictEqual(logicalHash(d), LOGICAL_EXPORT_HASH); assert.strictEqual(seedHash(d), SEED_HASH);
    const again = await store.importJSON(JSON.parse(embedded()));
    assert(again.ok === true && again.data.noOp === true && again.data.imported === 0, 'second import is a no-op');
    assert.strictEqual(logicalHash(store.exportData()), LOGICAL_EXPORT_HASH, 'second import changed nothing');
  });

  await T('harness-safety-scan', 'harness code: no network / storage / cookie / console / eval / HTML injection / external URL; only WmStore.exportData + WmStore.importJSON; the only SQL is fixed read-only SELECTs on the app handle; no API-key, token, Canon, wiz_ref, Continuity or ledger access', async () => {
    const code = codeOnly();
    const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/, /localStorage/, /sessionStorage/, /indexedDB/i, /document\.cookie/, /\bcookie/i,
      /\bconsole\b/, /\beval\s*\(/, /new\s+Function/, /\binnerHTML/, /\bouterHTML/, /insertAdjacentHTML/, /document\.write/, /https?:\/\//, /\bcdn/i, /\/\/[a-z0-9.-]+\.[a-z]{2,}\//i,
      /api[_-]?key/i, /\btoken/i, /bearer/i, /authorization/i, /password/i, /credential/i, /wiz_ref/i, /WizRef/, /wiz_facts/, /wiz_events_ledger/, /ledger/i, /continuity/i, /carrier/i,
      /experiment_registry/, /canon/i, /executeAgentTool/, /_wizSaveDB/, /wizInitSQLite/, /AGENT_TOOLS_SPEC/, /callModel|chat\s*\(|completion/i,
      /caches\.(open|delete|match|put)/, /serviceWorker\.(register|getRegistrations|ready)/, /\.unregister\s*\(/, /\.postMessage\s*\(/, /\.run\s*\(/, /\.prepare\s*\(/, /\.export\s*\(/, /\.close\s*\(/,
      /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/];
    for (const re of forbidden) assert(!re.test(code), 'forbidden pattern in harness code: ' + re);
    const methods = new Set([...code.matchAll(/\bstore\.(\w+)/g)].map(m => m[1]));
    assert.deepStrictEqual([...methods].sort(), ['exportData', 'importJSON'], 'only the two documented WmStore methods are used: ' + [...methods]);
    const globals = new Set([...code.matchAll(/\bwindow\.(\w+)/g)].map(m => m[1]));
    for (const g of globals) assert(['WmStore', 'WorkingMemory', 'caches', 'crypto', 'isSecureContext', '_wizDB'].includes(g), 'unexpected window.' + g);
    const nav = new Set([...code.matchAll(/\bnavigator\.(\w+)/g)].map(m => m[1]));
    for (const g of nav) assert(['userAgent', 'serviceWorker', 'onLine'].includes(g), 'unexpected navigator.' + g);
    const perf = [...code.matchAll(/\bperformance\.(\w+)\(([^)]*)\)/g)].map(m => m[1] + '(' + m[2] + ')');
    assert.deepStrictEqual(perf, ["getEntriesByType('navigation')"], 'performance is used only to read the navigation entry: ' + perf);
    const loc = new Set([...code.matchAll(/\blocation\.(\w+)/g)].map(m => m[1]));
    for (const g of loc) assert(['pathname', 'search', 'href', 'origin'].includes(g), 'unexpected location.' + g);
    assert(/window\.caches\.keys\(\)/.test(code) && !/window\.caches\.(?!keys\b)/.test(code), 'only the cache NAME list is read');
    // the only SQL the harness can issue: exec() of fixed SELECTs on the app handle (db.exec), nothing else touches the database
    const execs = [...code.matchAll(/\bdb\.exec\(([^;]*?)\)(?:\)|\.|;|\s)/g)].map(m => m[1].trim());
    assert(execs.length >= 4, 'db.exec call sites: ' + execs.length);
    for (const e of execs) assert(/^(["'])SELECT /.test(e), 'non-SELECT exec: ' + e);
    assert.deepStrictEqual([...code.matchAll(/\bdb\.(\w+)/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort(), ['exec'], 'only db.exec is used on the app handle');
    assert(/const db = window\._wizDB;/.test(code));
    // the single write: one importJSON call, after the logical empty guard, the physical guard and the fixture integrity check
    assert.strictEqual((code.match(/store\.importJSON\(/g) || []).length, 1);
    const at = (s, from) => code.indexOf(s, from), imp = at('store.importJSON(');
    assert(at('before.total !== 0') > 0 && at('before.total !== 0') < at('const phys = physicalGuard();', at('before.total !== 0')) && at('fixtureIntegrity()', at('async function importFixture')) < imp, 'logical guard -> physical guard -> fixture integrity -> import');
    assert(at('if (!phys.ok)', at('async function importFixture')) > 0 && at('if (!phys.ok)', at('async function importFixture')) < imp, 'physical guard precedes the import');
    const required = code.match(/const PHYSICAL_REQUIRED = \[([^\]]*)\];/);
    assert(required, 'PHYSICAL_REQUIRED present');
    assert.deepStrictEqual([...required[1].matchAll(/'(wm_[a-z_]+)'/g)].map(m => m[1]), EXPECTED_PHYSICAL, 'the harness requires exactly the 12 expected wm_* tables');
    { const fnStart = at('async function importFixture');
      assert(at('physicalGuard(true)', fnStart) > fnStart && at('physicalGuard(true)', fnStart) < at('snapshotOf(store)', fnStart) && at('physicalGuard(true)', fnStart) < imp, 'IMPORT: the namespace-presence check precedes every logical read and the import');
      const chkStart = at('async function checkEnvironment');
      assert(at('physicalGuard(true)', chkStart) > chkStart && at('physicalGuard(true)', chkStart) < at('snapshotOf(store)', chkStart), 'CHECK: the namespace-presence check precedes the logical read'); }
    for (const re of [/raw !== FIXTURE_RAW_SHA256/, /seed !== EXPECTED_SEED/, /logical !== EXPECTED_LOGICAL/]) assert(re.test(code), 'integrity comparison present: ' + re);
    assert(code.indexOf('logical !== EXPECTED_LOGICAL', imp) > 0 && code.indexOf('seed !== EXPECTED_SEED', imp) > 0, 'post-import verification of both hashes follows the import');
    assert(/FINGERPRINT_' \+ verdict/.test(code) && /const verdict = okCounts && okHash \? 'PASS' : 'FAIL';/.test(code), 'fingerprint verdict derives from counts AND both hashes');
    // every action refuses first unless the device run is VALID
    for (const fn of ['checkEnvironment', 'importFixture', 'runFingerprint'])
      assert(new RegExp(`async function ${fn}\\(\\) \\{\\s*if \\(!isValid\\(\\)\\) return invalidResult\\(\\);`).test(code), fn + ' must refuse when the run is not VALID');
    assert(/function isExactEntry\(\) \{\s*try \{\s*const nav = performance\.getEntriesByType\('navigation'\)\[0\];\s*if \(!nav \|\| typeof nav\.name !== 'string'\) return false;[^\n]*\n\s*return ENTRY_PATHS\.some\(p => \{ const base = location\.origin \+ p \+ ENTRY_SEARCH; return nav\.name === base \|\| \(nav\.name\.indexOf\(base \+ '#'\) === 0 && APP_ROUTE\.test\(nav\.name\.slice\(base\.length\)\)\); \}\) &&\s*ENTRY_PATHS\.indexOf\(location\.pathname\) !== -1 && location\.search === ENTRY_SEARCH;\s*\} catch \(_\) \{ return false; \}\s*\}\s*if \(!isExactEntry\(\)\) return;/.test(code), 'exact entry check (navigation entry + app route only + current path/query, fail-closed)');
    assert(code.indexOf('if (!isExactEntry()) return;') > 0 && code.indexOf('if (!isExactEntry()) return;') < code.indexOf('const ROOT_ID') && code.indexOf('if (!isExactEntry()) return;') < code.indexOf('document.getElementById'), 'the exact entry check precedes everything else');
    assert((code.match(/addButton\('b1d-/g) || []).length === 3, 'exactly three action buttons');
  });

  await T('gate-in-sync', 'index.html carries exactly ONE harness gate and no static harness tag; the build id is declared once in the harness, equals the hash of its own function text, and equals the id in the gate; sw.js is untouched by the harness', async () => {
    const gates = INDEX_HTML.match(/<script>\s*\(function \(\) \{\s*try \{\s*var p = location\.pathname;[\s\S]*?<\/script>/g) || [];
    assert.strictEqual(gates.length, 1, 'exactly one gate');
    assert.strictEqual((INDEX_HTML.match(/b1-device-harness\.js/g) || []).length, 1, 'harness file referenced exactly once in index.html');
    assert(!/<script[^>]*src=["']b1-device-harness/.test(INDEX_HTML), 'no static script tag for the harness');
    assert.strictEqual((HARNESS.match(/\n  const HARNESS_BUILD_ID = '[0-9a-f]{12}';/g) || []).length, 1, 'build id declared exactly once');
    const id = declaredId(HARNESS);
    assert.strictEqual(buildIdOf(HARNESS), id, 'HARNESS_BUILD_ID is stale — set it to ' + buildIdOf(HARNESS) + ' (SHA-256 of the function text with the id literal masked, first 12 hex) and update the gate in index.html');
    const gateId = gates[0].match(/var EXPECTED_HARNESS_BUILD = '([0-9a-f]{12})';/);
    assert(gateId, 'EXPECTED_HARNESS_BUILD in gate');
    assert.strictEqual(gateId[1], id, 'gate EXPECTED_HARNESS_BUILD must equal the harness build id ' + id);
    assert(/s\.src = 'b1-device-harness\.js\?h=' \+ EXPECTED_HARNESS_BUILD;/.test(gates[0]) && /s\.setAttribute\('data-expected-build', EXPECTED_HARNESS_BUILD\);/.test(gates[0]), 'gate passes the expected build in ?h= and data-expected-build');
    assert(!/b1-device|b1device/i.test(SW_JS), 'sw.js (production service worker) does not know the harness: it is not precached and CACHE_NAME is unchanged');
    assert(/const CACHE_NAME = 'eiti-wizard-lab-v1\.8\.10-wm1';/.test(SW_JS), 'CACHE_NAME unchanged');
    assert.strictEqual((INDEX_HTML.match(/b1device/g) || []).length, 2, 'the query name b1device appears only in the gate (its comment + its exact-match condition)');
  });

  await T('APP_ROUTES_IN_SYNC', 'the fragments the gate and the harness accept are exactly the app\'s own panel routes (every id="panel-*" of index.html and nothing else): a new panel without updating both lists fails here', async () => {
    const panels = [...INDEX_HTML.matchAll(/id="panel-([a-z-]+)"/g)].map(m => m[1]).sort();
    assert.deepStrictEqual(panels, PANELS.slice().sort(), 'index.html panels vs the test list');
    const listOf = re => re.match(/\^#\(\?:([a-z|-]+)\)\$/)[1].split('|').sort();
    const harnessRe = HARNESS.match(/const APP_ROUTE = (\/\^#\(\?:[a-z|-]+\)\$\/);/)[1];
    const gate = INDEX_HTML.match(/<script>\s*\(function \(\) \{\s*try \{\s*var p = location\.pathname;[\s\S]*?<\/script>/)[0];
    const gateRe = gate.match(/!(\/\^#\(\?:[a-z|-]+\)\$\/)\.test\(location\.hash\)/)[1];
    assert.deepStrictEqual(listOf(harnessRe), panels, 'harness APP_ROUTE'); assert.deepStrictEqual(listOf(gateRe), panels, 'gate route list');
  });

  await T('EXACT_GATE_INDEX_HTML', 'the index.html gate injects the harness for EXACTLY <canonical path>?b1device=1 (both canonical page paths) and for NOTHING else: other query params, duplicates, %31 / 01 / true, any fragment, any other path', async () => {
    const gate = INDEX_HTML.match(/<script>\s*(\(function \(\) \{\s*try \{\s*var p = location\.pathname;[\s\S]*?)<\/script>/)[1];
    const run = p => {
      const appended = [];
      const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
      vm.runInNewContext(gate, { location: locationOf(p), document: { createElement: tag => Object.assign(el, { tag }), head: { appendChild: n => appended.push(n) } } });
      return appended;
    };
    assert(NOT_EXACT.length >= 35, 'table size ' + NOT_EXACT.length);
    for (const p of NOT_EXACT) assert.strictEqual(run(p).length, 0, 'gate must stay inert for ' + p);
    for (const p of CANONICAL.concat(CANONICAL_ROUTES)) {
      const a = run(p); assert.strictEqual(a.length, 1, p); assert.strictEqual(a[0].tag, 'script');
      assert(/^b1-device-harness\.js\?h=[0-9a-f]{12}$/.test(a[0].src), a[0].src); assert.strictEqual(a[0].attrs['data-expected-build'], HARNESS_ID);
    }
    assert(!/URLSearchParams/.test(gate), 'the gate must not use a lenient query parser');
    vm.runInNewContext(gate, { location: undefined, document: {} });                      // a broken environment never throws into the page
  });

  await T('EXACT_GATE_HARNESS', 'the harness re-checks the exact entry condition against the URL the page was OPENED with (navigation entry, fragment included) and the current path / query: for every non-exact URL it does nothing at all — even if an older looser gate injected it; both canonical paths activate it although the app rewrites the hash itself', async () => {
    for (const p of NOT_EXACT) {
      const { db, store } = makeStore(SQL);
      const env = runHarness({ path: p, db, store });
      assert.strictEqual(env.registry.size, 0, 'harness built UI for ' + p); assert.strictEqual(env.body.children.length, 0, 'harness appended to body for ' + p);
      assert.strictEqual(env.state(), null);
    }
    for (const p of CANONICAL.concat(CANONICAL_ROUTES)) {
      const { db, store } = makeStore(SQL);
      const env = runHarness({ path: p, db, store }); assert.strictEqual(await env.settled(), 'VALID', p);          // current location carries the app's '#chat'
      assert.strictEqual(env.get('b1d-title').textContent, 'B1-DEVICE TEST — NON PRODUCTION');
    }
    { const { db, store } = makeStore(SQL); const env = runHarness({ noNavigationEntry: true, db, store });          // cannot prove how the page was opened => inert
      assert.strictEqual(env.registry.size, 0, 'no navigation entry'); }
    for (const cur of ['/Eiti-Wizard-Lab/index.html?b1device=1&x=1', '/Eiti-Wizard-Lab/other.html?b1device=1', '/Eiti-Wizard-Lab/index.html']) {  // path / query changed after the page was opened
      const { db, store } = makeStore(SQL); const env = runHarness({ path: CANONICAL[0], currentPath: cur, db, store });
      assert.strictEqual(env.registry.size, 0, 'current location ' + cur); }
    { const { db, store } = makeStore(SQL); const env = runHarness({ path: CANONICAL[0] + '#x', currentPath: CANONICAL[0], db, store });   // opened with a fragment, the app has since replaced it by '#chat'
      assert.strictEqual(env.registry.size, 0, 'opened with a fragment'); }
  });

  await T('VALID_RUN', 'a verified run (self-hash, page marker, script URL, online) enables the three buttons; CHECK read-only, FINGERPRINT FAIL on empty, IMPORT PASS with exact hashes, second IMPORT aborts, FINGERPRINT PASS; non-wm tables untouched', async () => {
    const { db, store } = makeStore(SQL);
    db.run('CREATE TABLE continuity_carrier(id TEXT PRIMARY KEY, v TEXT)'); db.run("INSERT INTO continuity_carrier VALUES('1','sentinel')");
    const env = runHarness({ db, store }); assert.strictEqual(await env.settled(), 'VALID');
    assert.deepStrictEqual(env.buttonsDisabled(), [false, false, false]);
    assert(env.out().text.includes('DEVICE_RUN = VALID') && env.out().text.includes('BUILD_CHECK = OK') && env.out().text.includes('HARNESS_BUILD = ' + HARNESS_ID));
    // the bounded contract: internally VALID, but explicitly NOT current-deployment evidence until the human compares HARNESS_BUILD BEFORE IMPORT
    assert(env.out().text.includes('NOT current-deployment evidence until HARNESS_BUILD is compared with the expected build id BEFORE IMPORT') && env.out().text.includes('FRESHNESS = NOT_PROVEN_BY_HARNESS') &&
      env.out().text.includes('ONLINE_REPORTED = YES (navigator.onLine; not a freshness proof)') && env.out().text.includes('BEFORE IMPORT: compare HARNESS_BUILD above'), env.out().text);
    assert.strictEqual(env.get('b1d-status').textContent, 'BUILD CONSISTENT · ' + HARNESS_ID + ' · freshness NOT proven — compare with the expected build id BEFORE import');
    const w0 = physDump(db), o0 = otherDump(db);
    const chk = await env.press('b1d-check'); assert.strictEqual(chk.verdict, 'ENV_OK');
    assert(chk.text.includes('WM_EMPTY = YES (rows=0)') && chk.text.includes('WM_PHYSICAL_EMPTY = YES (wm_* tables checked=12)') && chk.text.includes('IMPORT_WOULD_PROCEED = YES') && chk.text.includes('WRITES_PERFORMED = NO'), chk.text);
    assert.strictEqual(physDump(db), w0, 'CHECK wrote');
    const fp0 = await env.press('b1d-fingerprint'); assert.strictEqual(fp0.verdict, 'FAIL'); assert.strictEqual(physDump(db), w0);
    const imp = await env.press('b1d-import'); assert.strictEqual(imp.verdict, 'IMPORT_PASS', imp.text);
    for (const s of ['WM_PHYSICAL_EMPTY = YES', 'SEED_HASH(fixture) = ' + SEED_HASH + ' (verified)', 'importJSON = ok imported=32 unchanged=0', 'LOGICAL_EXPORT_HASH = ' + LOGICAL_EXPORT_HASH, 'SEED_HASH = ' + SEED_HASH]) assert(imp.text.includes(s), s);
    assert.strictEqual(otherDump(db), o0, 'non-wm tables changed');
    assert.strictEqual(logicalHash(store.exportData()), LOGICAL_EXPORT_HASH);
    const w1 = physDump(db);
    const again = await env.press('b1d-import'); assert.strictEqual(again.verdict, 'IMPORT_FAIL'); assert(again.text.includes('WM not empty (rows=32)') && again.text.includes('WRITE_ATTEMPTED = NO')); assert.strictEqual(physDump(db), w1);
    const fp = await env.press('b1d-fingerprint'); assert.strictEqual(fp.verdict, 'PASS'); assert(fp.text.startsWith('FINGERPRINT_PASS') && fp.text.includes('LOGICAL_EXPORT_HASH = ' + LOGICAL_EXPORT_HASH));
  });

  await T('STALE_HARNESS_DETECTED', 'stale / mismatched / tampered / offline pages and harnesses => STALE_HARNESS + DEVICE_RUN_INVALID: every button disabled, every action refuses even when force-clicked, no write, no ENV_OK / IMPORT_PASS / FINGERPRINT_PASS', async () => {
    const olderBuild = otherBuild(t => t.replace("'SEED_HASH(fixture) = '", "'SEED_HASH(fixture)  = '"));
    const cases = [
      ['page marker missing (older gate)', { expectedAttr: null }, /PAGE_BUILD_MARKER_MISSING/, 'YES'],
      ['page expects another build', { expectedAttr: 'aaaaaaaaaaaa' }, /PAGE_HARNESS_BUILD_MISMATCH/, 'YES'],
      ['script URL carries another build', { scriptSrc: ORIGIN + '/Eiti-Wizard-Lab/b1-device-harness.js?h=bbbbbbbbbbbb' }, /HARNESS_URL_BUILD_MISMATCH/, 'YES'],
      ['script URL without a build', { scriptSrc: ORIGIN + '/Eiti-Wizard-Lab/b1-device-harness.js' }, /HARNESS_URL_BUILD_MISMATCH/, 'YES'],
      ['older but self-consistent harness build behind a newer page', { src: olderBuild, expectedAttr: HARNESS_ID, scriptSrc: ORIGIN + '/Eiti-Wizard-Lab/b1-device-harness.js?h=' + HARNESS_ID }, /PAGE_HARNESS_BUILD_MISMATCH/, 'YES'],
      ['tampered harness code, declared id kept', { src: HARNESS.replace("'ENV_FAIL'", "'ENV_OK'") }, /HARNESS_SELF_HASH_MISMATCH/, 'YES'],
      ['harness without a valid declared id', { src: HARNESS.replace(/\n  const HARNESS_BUILD_ID = '[0-9a-f]{12}';/, "\n  const HARNESS_BUILD_ID = '';"), expectedAttr: HARNESS_ID }, /HARNESS_SELF_HASH_MISMATCH/, 'YES'],
      ['offline: cached page / harness cannot be shown to be current', { onLine: false }, /OFFLINE_FRESHNESS_UNVERIFIED/, 'POSSIBLE'],
      ['build verification impossible (no WebCrypto)', { noCrypto: true }, /BUILD_VERIFICATION_ERROR/, 'YES'],
    ];
    for (const [name, o, reason, stale] of cases) {
      const { db, store } = makeStore(SQL);
      db.run('CREATE TABLE continuity_carrier(id TEXT PRIMARY KEY, v TEXT)'); db.run("INSERT INTO continuity_carrier VALUES('1','sentinel')");
      const w0 = physDump(db), o0 = otherDump(db);
      const env = runHarness(Object.assign({ db, store }, o));
      assert.strictEqual(await env.settled(), 'INVALID', name);
      assert.deepStrictEqual(env.buttonsDisabled(), [true, true, true], name + ': buttons');
      assert.strictEqual(env.out().verdict, 'DEVICE_RUN_INVALID', name);
      assert(reason.test(env.out().text) && env.out().text.includes('STALE_HARNESS = ' + stale) && env.out().text.startsWith('DEVICE_RUN_INVALID'), name + '\n' + env.out().text);
      assert(env.get('b1d-status').textContent === 'STALE_HARNESS · DEVICE_RUN_INVALID', name + ': status banner');
      if (o.onLine === false) assert(env.out().text.includes('ONLINE_REPORTED = NO'), name + ': the offline observation is shown');
      for (const b of ['b1d-check', 'b1d-import', 'b1d-fingerprint']) {
        assert.strictEqual(await env.get(b).tap(), false, name + ': a disabled button dispatches no click');
        const r = await env.force(b);                                                // devtools re-enables the button and clicks: the action itself refuses
        assert.strictEqual(r.verdict, 'DEVICE_RUN_INVALID', name + ' / ' + b); assert(!NO_PASS.test(r.text), name + ' / ' + b + ': ' + r.text); assert(r.text.includes('WRITES_PERFORMED = NO'));
        assert.deepStrictEqual(env.buttonsDisabled(), [true, true, true], name + ': buttons stay disabled after a forced click');
      }
      assert.strictEqual(physDump(db), w0, name + ': wm_* changed'); assert.strictEqual(otherDump(db), o0, name + ': other tables changed');
      assert.strictEqual(store.exportData().items.length, 0, name + ': import happened');
    }
  });

  const contaminate = {
    'orphan row in wm_items_fts': db => db.run("INSERT INTO wm_items_fts(work_id,title,summary,body_md,tags_json) VALUES('WRK-ORPHAN','orphan title','','','[]')"),
    'wm_items_fts_content contamination': db => db.run("INSERT INTO wm_items_fts_content(id,c0,c1,c2,c3,c4) VALUES(901,'WRK-X','t','','','[]')"),
    'wm_items_fts_docsize contamination': db => db.run("INSERT INTO wm_items_fts_docsize(id,sz) VALUES(902, x'01')"),
    'wm_items_fts_idx contamination': db => db.run("INSERT INTO wm_items_fts_idx(segid,term,pgno) VALUES(7,'zz',1)"),
    'wm_items_fts_data extra block': db => db.run("INSERT INTO wm_items_fts_data(id,block) VALUES(4242, x'00')"),
    'wm_items_fts_config extra key': db => db.run("INSERT INTO wm_items_fts_config(k,v) VALUES('rogue', 1)"),
    'unknown wm_* table with a row': db => { db.run('CREATE TABLE wm_rogue(x)'); db.run('INSERT INTO wm_rogue VALUES(1)'); },
  };
  await T('PHYSICAL_GUARD', 'the logical export stays EMPTY under every physical contamination (the old guard is blind to it) but CHECK reports WM_PHYSICAL_EMPTY = NO and IMPORT aborts with WM_PHYSICAL_NOT_EMPTY before any write: nothing imported, nothing cleaned, contamination preserved', async () => {
    for (const [name, mutate] of Object.entries(contaminate)) {
      const { db, store } = makeStore(SQL);
      mutate(db);
      assert.strictEqual(store.exportData().items.length + store.exportData().changes.length + store.exportData().projects.length, 0, name + ': logical export must still be empty (that is the point)');
      const w0 = physDump(db), o0 = otherDump(db);
      const env = runHarness({ db, store }); assert.strictEqual(await env.settled(), 'VALID');
      const chk = await env.press('b1d-check');
      assert(chk.text.includes('WM_EMPTY = YES (rows=0)') && chk.text.includes('WM_PHYSICAL_EMPTY = NO') && chk.text.includes('CODE = WM_PHYSICAL_NOT_EMPTY') && /IMPORT_WOULD_PROCEED = NO \(WM_PHYSICAL_NOT_EMPTY — import aborts\)/.test(chk.text), name + '\n' + chk.text);
      const imp = await env.press('b1d-import');
      assert.strictEqual(imp.verdict, 'IMPORT_FAIL', name); assert(imp.text.includes('CODE = WM_PHYSICAL_NOT_EMPTY') && /WM_PHYSICAL_NOT_EMPTY — abort before import; nothing was cleaned up/.test(imp.text) && imp.text.includes('WRITE_ATTEMPTED = NO'), name + '\n' + imp.text);
      assert(!/PASS: imported|importJSON = ok/.test(imp.text), name);
      assert.strictEqual(physDump(db), w0, name + ': a table changed (import ran or contamination was cleaned)'); assert.strictEqual(otherDump(db), o0);
      assert.strictEqual(store.exportData().items.length, 0, name + ': items imported');
    }
  });

  await T('PHYSICAL_NAMESPACE_COMPLETE', 'every one of the 12 expected wm_* tables (six data tables, wm_items_fts and its five shadow tables) is REQUIRED: dropping any single one => WM_PHYSICAL_UNVERIFIABLE, IMPORT_WOULD_PROCEED = NO, WRITE_ATTEMPTED = NO; WmStore.importJSON is never called (counted), no SQL write is issued, nothing is recreated or repaired', async () => {
    { const { db } = makeStore(SQL); assert.deepStrictEqual(wmTables(db), EXPECTED_PHYSICAL.slice().sort(), 'a pristine WorkingMemory DB has exactly the 12 expected tables'); }
    for (const dropped of EXPECTED_PHYSICAL) {
      const { db, store } = makeStore(SQL);
      db.run('DROP TABLE "' + dropped + '"');                                                    // note: dropping the virtual table wm_items_fts removes its five shadow tables with it
      const absent = EXPECTED_PHYSICAL.filter(n => !wmTables(db).includes(n)); assert(absent.includes(dropped), dropped + ' really is absent');
      let importCalls = 0, exportCalls = 0, sqlWrites = 0;
      const counting = { exportData: () => { exportCalls++; return store.exportData(); }, importJSON: (...a) => { importCalls++; return store.importJSON(...a); } };
      const runOrig = db.run.bind(db); db.run = (...a) => { sqlWrites++; return runOrig(...a); };    // the harness must never issue a write itself
      const w0 = physDump(db), o0 = otherDump(db), tablesBefore = wmTables(db);
      const env = runHarness({ db, store: counting }); assert.strictEqual(await env.settled(), 'VALID', dropped);
      const chk = await env.press('b1d-check');
      assert.strictEqual(chk.verdict, 'ENV_FAIL', dropped + ': an incomplete physical namespace is an environment failure');
      assert(chk.text.includes('WM_PHYSICAL_EMPTY = UNVERIFIABLE') && chk.text.includes('CODE = WM_PHYSICAL_UNVERIFIABLE') && chk.text.includes('IMPORT_WOULD_PROCEED = NO') && chk.text.includes('WRITES_PERFORMED = NO') &&
        chk.text.includes('WM_EMPTY = UNKNOWN') && absent.every(n => chk.text.includes(n)), dropped + '\n' + chk.text);
      const imp = await env.press('b1d-import');
      assert.strictEqual(imp.verdict, 'IMPORT_FAIL', dropped);
      assert(imp.text.includes('CODE = WM_PHYSICAL_UNVERIFIABLE') && imp.text.includes('WM_PHYSICAL_UNVERIFIABLE — abort before import; nothing was recreated, cleaned or changed') && imp.text.includes('WRITE_ATTEMPTED = NO') &&
        absent.every(n => imp.text.includes(n)) && !/PASS: imported|importJSON = ok/.test(imp.text), dropped + '\n' + imp.text);
      assert.strictEqual(importCalls, 0, dropped + ': WmStore.importJSON must never be called');
      assert.strictEqual(exportCalls, 0, dropped + ': the incomplete namespace is not even read logically');
      assert.strictEqual(sqlWrites, 0, dropped + ': no SQL write issued');
      assert.deepStrictEqual(wmTables(db), tablesBefore, dropped + ': nothing recreated'); assert.strictEqual(physDump(db), w0, dropped + ': a table changed (repaired / cleaned)'); assert.strictEqual(otherDump(db), o0);
      const exportCallsBeforeFingerprint = exportCalls;
      const fp = await env.press('b1d-fingerprint'); assert(fp.verdict !== 'PASS' && !/^FINGERPRINT_PASS/.test(fp.text), dropped + ': fingerprint must not pass');
      assert.strictEqual(importCalls, 0, dropped + ': still never called');
      if (process.env.B1DEV_VERBOSE) console.log('      dropped ' + dropped.padEnd(22) + ' absent=' + String(absent.length).padStart(2) + '  CHECK=' + chk.verdict + '(WM_PHYSICAL_UNVERIFIABLE, IMPORT_WOULD_PROCEED=NO)  IMPORT=' + imp.verdict + '(WRITE_ATTEMPTED=NO)  importJSON calls=' + importCalls + '  exportData calls before FINGERPRINT=' + exportCallsBeforeFingerprint + '  SQL writes=' + sqlWrites + '  FINGERPRINT=' + fp.verdict);
    }
  });

  await T('PHYSICAL_GUARD_EDGES', 'physical guard edges: an empty extra wm_* table is allowed; a pristine DB passes (12 tables); missing app handle or missing core / FTS tables are WM_PHYSICAL_UNVERIFIABLE and abort before import; a logical row is still caught by the logical guard', async () => {
    { const { db, store } = makeStore(SQL); db.run('CREATE TABLE wm_empty_extra(x)');
      const env = runHarness({ db, store }); await env.settled(); const imp = await env.press('b1d-import'); assert.strictEqual(imp.verdict, 'IMPORT_PASS', 'empty extra table must not block: ' + imp.text); }
    { const { store } = makeStore(SQL); const env = runHarness({ store }); await env.settled();
      const chk = await env.press('b1d-check'); assert(chk.text.includes('WM_PHYSICAL_EMPTY = UNVERIFIABLE') && chk.text.includes('CODE = WM_PHYSICAL_UNVERIFIABLE') && chk.text.includes('IMPORT_WOULD_PROCEED = NO'), chk.text);
      const imp = await env.press('b1d-import'); assert.strictEqual(imp.verdict, 'IMPORT_FAIL'); assert(imp.text.includes('WM_PHYSICAL_UNVERIFIABLE') && imp.text.includes('WRITE_ATTEMPTED = NO'), imp.text); assert.strictEqual(store.exportData().items.length, 0); }
    { const { db, store } = makeStore(SQL); db.run('DROP TRIGGER wm_items_fts_insert'); db.run('DROP TRIGGER wm_items_fts_update'); db.run('DROP TABLE wm_items_fts');
      const w0 = physDump(db); const env = runHarness({ db, store }); await env.settled();
      const imp = await env.press('b1d-import'); assert(imp.verdict === 'IMPORT_FAIL' && /WM_PHYSICAL_UNVERIFIABLE/.test(imp.text) && /missing expected wm_\* table\(s\): .*wm_items_fts/.test(imp.text) && imp.text.includes('WRITE_ATTEMPTED = NO'), imp.text); assert.strictEqual(physDump(db), w0); }
    { const { db, store } = makeStore(SQL); const r = await store.createProject({ project_id: 'p1', code: 'P1', name: 'pre' }); assert(r.ok);
      const w0 = physDump(db); const env = runHarness({ db, store }); await env.settled();
      const imp = await env.press('b1d-import'); assert(imp.verdict === 'IMPORT_FAIL' && /WM not empty \(rows=\d+\) — abort/.test(imp.text) && imp.text.includes('WRITE_ATTEMPTED = NO'), imp.text); assert.strictEqual(physDump(db), w0); }
  });

  console.log(`\n${passed}/${passed + failed} tests passed.`);
  completed = true; process.exitCode = failed ? 1 : 0;
})().catch(e => { console.log('FAIL  [harness]', e.stack); completed = true; process.exitCode = 3; });

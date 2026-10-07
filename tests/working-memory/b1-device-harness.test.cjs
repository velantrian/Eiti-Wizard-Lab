// B1-DEVICE-01 native test harness: static / node-level acceptance tests (no browser needed).
// The real-browser flow lives in b1-device-browser.test.mjs. Synthetic frozen fixture only; no model is invoked.
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
  try { await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('test timed out after 30s')), 30000); })]); passed++; console.log(`PASS  [${id}] ${name}`); }
  catch (e) { failed++; console.log(`FAIL  [${id}] ${name}\n      ${e.stack.split('\n').slice(0, 4).join('\n      ')}`); }
  finally { clearTimeout(timer); }
}
const embedded = () => { const m = HARNESS.match(/const FIXTURE_JSON = ("(?:[^"\\]|\\.)*");/); assert(m, 'FIXTURE_JSON literal not found'); return JSON.parse(m[1]); };
// Code only: block comments, whole-line comments and the fixture string literal are removed before token scans.
const codeOnly = () => HARNESS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l) && !/const FIXTURE_JSON = /.test(l)).join('\n');

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
    // the harness constants equal the owner-supplied values
    for (const [name, v] of [['EXPECTED_SEED', SEED_HASH], ['EXPECTED_LOGICAL', LOGICAL_EXPORT_HASH], ['FIXTURE_RAW_SHA256', RAW_FILE_SHA256]])
      assert(new RegExp(`const ${name} = '${v}';`).test(HARNESS), name + ' constant');
    assert(/const EXPECTED = \{ projects: 2, items: 9, sources: 3, relations: 1, item_sources: 1, changes: 16 \};/.test(HARNESS), 'expected counts constant');
  });

  await T('fixture-real-import', 'WmStore.importJSON(exact fixture) on an empty store reproduces counts, LOGICAL_EXPORT_HASH and SEED_HASH; a second import is a no-op (the harness must abort on a non-empty store instead)', async () => {
    const db = new SQL.Database(); let n = 0;
    const store = WM.create(db, { now: () => '2026-10-07T00:00:00.000Z', actorClass: 'SYSTEM', idFactory: p => p + String(++n).padStart(6, '0'), persist: async () => ({ verified: true }) });
    const res = await store.importJSON(JSON.parse(embedded()));
    assert(res.ok === true && res.data.noOp === false && res.data.imported === 32, JSON.stringify(res));
    const d = store.exportData();
    for (const k of Object.keys(COUNTS)) assert.strictEqual(d[k].length, COUNTS[k], k);
    assert.strictEqual(logicalHash(d), LOGICAL_EXPORT_HASH); assert.strictEqual(seedHash(d), SEED_HASH);
    const again = await store.importJSON(JSON.parse(embedded()));
    assert(again.ok === true && again.data.noOp === true && again.data.imported === 0, 'second import is a no-op');
    assert.strictEqual(logicalHash(store.exportData()), LOGICAL_EXPORT_HASH, 'second import changed nothing');
  });

  await T('harness-safety-scan', 'harness code: no network / storage / cookie / console / eval / HTML injection / external URL; only WmStore.exportData + WmStore.importJSON; no API-key, token, Canon, wiz_ref, Continuity, ledger or app-DB access', async () => {
    const code = codeOnly();
    const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /importScripts/, /localStorage/, /sessionStorage/, /indexedDB/i, /document\.cookie/, /\bcookie/i,
      /\bconsole\b/, /\beval\s*\(/, /new\s+Function/, /\binnerHTML/, /\bouterHTML/, /insertAdjacentHTML/, /document\.write/, /https?:\/\//, /\bcdn/i, /\/\/[a-z0-9.-]+\.[a-z]{2,}\//i,
      /api[_-]?key/i, /\btoken/i, /bearer/i, /authorization/i, /password/i, /credential/i, /wiz_ref/i, /WizRef/, /wiz_facts/, /wiz_events_ledger/, /ledger/i, /continuity/i, /carrier/i,
      /experiment_registry/, /canon/i, /executeAgentTool/, /_wizDB/, /_wizSaveDB/, /wizInitSQLite/, /AGENT_TOOLS_SPEC/, /callModel|chat\s*\(|completion/i,
      /caches\.(open|delete|match|put)/, /serviceWorker\.(register|getRegistrations|ready)/, /\.unregister\s*\(/, /\.postMessage\s*\(/, /\.run\s*\(/, /\.exec\s*\(/];
    for (const re of forbidden) assert(!re.test(code), 'forbidden pattern in harness code: ' + re);
    const methods = new Set([...code.matchAll(/\bstore\.(\w+)/g)].map(m => m[1]));
    assert.deepStrictEqual([...methods].sort(), ['exportData', 'importJSON'], 'only the two documented WmStore methods are used: ' + [...methods]);
    const globals = new Set([...code.matchAll(/\bwindow\.(\w+)/g)].map(m => m[1]));
    for (const g of globals) assert(['WmStore', 'WorkingMemory', 'caches', 'crypto', 'isSecureContext'].includes(g), 'unexpected window.' + g);
    const nav = new Set([...code.matchAll(/\bnavigator\.(\w+)/g)].map(m => m[1]));
    for (const g of nav) assert(['userAgent', 'serviceWorker'].includes(g), 'unexpected navigator.' + g);
    // the only storage-ish thing read is the cache NAME list (caches.keys) for the SW/cache version
    assert(/window\.caches\.keys\(\)/.test(code) && !/window\.caches\.(?!keys\b)/.test(code));
    // writes happen in exactly one place: the single importJSON call, after the empty-store guard
    assert.strictEqual((code.match(/store\.importJSON\(/g) || []).length, 1);
    assert(code.indexOf('before.total !== 0') > 0 && code.indexOf('before.total !== 0') < code.indexOf('store.importJSON('), 'empty-store guard precedes the import');
    assert(code.indexOf('fixtureIntegrity()') < code.indexOf('store.importJSON('), 'fixture integrity check precedes the import');
    for (const re of [/raw !== FIXTURE_RAW_SHA256/, /seed !== EXPECTED_SEED/, /logical !== EXPECTED_LOGICAL/]) assert(re.test(code), 'integrity comparison present: ' + re);
    assert(code.indexOf('logical !== EXPECTED_LOGICAL', code.indexOf('store.importJSON(')) > 0 && code.indexOf('seed !== EXPECTED_SEED', code.indexOf('store.importJSON(')) > 0, 'post-import verification of both hashes follows the import');
    assert(/FINGERPRINT_' \+ verdict/.test(code) && /const verdict = okCounts && okHash \? 'PASS' : 'FAIL';/.test(code), 'fingerprint verdict derives from counts AND both hashes');
    assert(/button/.test(code) && (code.match(/addButton\('b1d-/g) || []).length === 3, 'exactly three action buttons');
  });

  await T('gate-in-sync', 'index.html carries exactly ONE harness gate, no static harness tag; its build id equals SHA-256(b1-device-harness.js)[0:12]; the service worker is untouched by the harness', async () => {
    const gates = INDEX_HTML.match(/<script>\s*\(function \(\) \{\s*try \{\s*if \(new URLSearchParams\(location\.search\)\.get\('b1device'\) !== '1'\) return;[\s\S]*?<\/script>/g) || [];
    assert.strictEqual(gates.length, 1, 'exactly one gate');
    assert.strictEqual((INDEX_HTML.match(/b1-device-harness\.js/g) || []).length, 1, 'harness referenced exactly once in index.html');
    assert(!/<script[^>]*src=["']b1-device-harness/.test(INDEX_HTML), 'no static script tag for the harness');
    const id = gates[0].match(/b1-device-harness\.js\?h=([0-9a-f]{12})'/);
    assert(id, 'build id in gate');
    assert.strictEqual(id[1], sha256(fs.readFileSync(path.join(ROOT, 'b1-device-harness.js'))).slice(0, 12), 'gate build id is stale — update ?h= in index.html to the new SHA-256 prefix of b1-device-harness.js');
    assert(!/b1-device|b1device/i.test(SW_JS), 'sw.js (production service worker) does not know the harness: it is not precached and CACHE_NAME is unchanged');
    assert(/const CACHE_NAME = 'eiti-wizard-lab-v1\.8\.10-wm1';/.test(SW_JS), 'CACHE_NAME unchanged');
    assert.strictEqual((INDEX_HTML.match(/b1device/g) || []).length, 2, 'the query name b1device appears only in the gate (its comment + its condition)');
  });

  await T('gate-inert', 'the gate injects the harness for EXACTLY ?b1device=1 and does nothing for every other URL (normal UI path)', async () => {
    const gate = INDEX_HTML.match(/<script>\s*(\(function \(\) \{\s*try \{\s*if \(new URLSearchParams\(location\.search\)\.get\('b1device'\)[\s\S]*?)<\/script>/)[1];
    const run = search => {
      const appended = [];
      const doc = { createElement: tag => ({ tag }), head: { appendChild: n => appended.push(n) } };
      vm.runInNewContext(gate, { location: { search }, URLSearchParams, document: doc });
      return appended;
    };
    for (const s of ['', '?', '?b1device=0', '?b1device=', '?b1device=true', '?b1device=11', '?b1device', '?xb1device=1', '?b1device_=1', '?a=b1device=1', '?B1DEVICE=1', '#b1device=1'])
      assert.strictEqual(run(s).length, 0, 'must stay inert for ' + JSON.stringify(s));
    for (const s of ['?b1device=1', '?x=1&b1device=1', '?b1device=1&x=1']) {
      const a = run(s); assert.strictEqual(a.length, 1, s); assert.strictEqual(a[0].tag, 'script');
      assert(/^b1-device-harness\.js\?h=[0-9a-f]{12}$/.test(a[0].src), a[0].src);
    }
    // a broken environment never throws into the page
    vm.runInNewContext(gate, { location: undefined, URLSearchParams, document: {} });
  });

  console.log(`\n${passed}/${passed + failed} tests passed.`);
  completed = true; process.exitCode = failed ? 1 : 0;
})().catch(e => { console.log('FAIL  [harness]', e.stack); completed = true; process.exitCode = 3; });

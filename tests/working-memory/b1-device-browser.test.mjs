// B1-DEVICE-01 native test harness: real-browser acceptance test (phone viewport, touch taps, fresh browser profiles).
// Requires Chromium and puppeteer-core; the application itself remains dependency-free. Synthetic frozen fixture only; no model is invoked.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const pupPath = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteer = (await import(pupPath.startsWith('/') ? pathToFileURL(path.join(pupPath, 'lib/esm/puppeteer/puppeteer-core.js')).href : pupPath)).default;
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';

// Frozen checkpoints (independent of the harness source).
const SEED_HASH = '780bfac4bce6442f46f5fc9827b0d8cc25cba3f4c80ad7e54bc2e87dabba1ec0';
const LOGICAL_EXPORT_HASH = '9334861791b8f64db8575d802159ac7c2d197a17fad563920dfd154ea1114b2a';
const STATUSES = ['WRK-FIRN-20261006-001  CURRENT', 'WRK-FIRN-20261006-002  IN_PROGRESS', 'WRK-FIRN-20261006-003  OPEN', 'WRK-FIRN-20261006-004  BLOCKED',
  'WRK-FIRN-20261006-005  UNKNOWN', 'WRK-FIRN-20261006-006  COMPLETED', 'WRK-FIRN-20261006-007  OPEN', 'WRK-FIRN-20261006-008  CURRENT', 'WRK-OTHER-20261006-001  OPEN'];
const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'b1-device-'));
fs.symlinkSync(ROOT, path.join(temp, 'Eiti-Wizard-Lab'));
const portProbe = net.createServer();
await new Promise((resolve, reject) => portProbe.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: temp, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${port}/Eiti-Wizard-Lab/index.html`;

let browser, passed = 0, failed = 0, completed = false;
process.on('exit', code => { if (!completed && code === 0) { console.log('FAIL  [harness] the suite did not run to completion'); process.exitCode = 3; } });
async function T(name, fn) {
  if (process.env.B1DEV_ONLY && !name.includes(process.env.B1DEV_ONLY)) return;   // dev convenience: run one scenario
  let timer;
  try { await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('scenario timed out after 150s')), 150000); })]); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String(e.stack || e).split('\n').slice(0, +(process.env.B1DEV_LINES || 6)).join('\n      ')); }
  finally { clearTimeout(timer); }
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function phone(opts = {}) {
  const context = await browser.createBrowserContext();          // fresh profile: empty IndexedDB / localStorage
  const page = await context.newPage();
  if (opts.bypassSW !== false) await page.setBypassServiceWorker(true);
  await page.setUserAgent(SAMSUNG_UA);
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e.message || e)));
  page.requests = []; page.on('request', r => page.requests.push(r.url()));
  return { context, page };
}
const ready = page => page.waitForFunction(() => window._wizDB && window.WorkingMemory && window.WmStore, { timeout: 30000 });
const openHarness = async (page, query = '?b1device=1') => { await page.goto(BASE + query, { waitUntil: 'load' }); await ready(page); await page.waitForSelector('#b1device-root', { timeout: 15000 }); };
async function tap(page, id) {
  await page.tap('#' + id);
  await page.waitForFunction(() => document.querySelector('#b1d-verdict').getAttribute('data-verdict') !== 'RUNNING', { timeout: 40000 });
  return page.evaluate(() => ({ verdict: document.querySelector('#b1d-verdict').getAttribute('data-verdict'), text: document.querySelector('#b1d-out').textContent }));
}
// Hash of every table of the app's SQLite DB, split into wm_* and everything else (Canon / wiz_ref / Continuity / ledger / facts ...).
const dbParts = page => page.evaluate(async () => {
  const db = window._wizDB;
  const names = (db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0] || { values: [] }).values.map(v => v[0]);
  const wm = {}, other = {};
  for (const n of names) { let rows; try { rows = db.exec('SELECT * FROM "' + n + '"'); } catch (e) { rows = 'ERR'; } (n.startsWith('wm_') ? wm : other)[n] = rows; }
  const hash = async o => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(o))))).map(b => b.toString(16).padStart(2, '0')).join('');
  return { wm: await hash(wm), other: await hash(other), otherTables: Object.keys(other), wmRows: ['wm_projects', 'wm_sources', 'wm_items', 'wm_item_sources', 'wm_relations', 'wm_changes'].reduce((n, t) => n + (Array.isArray(wm[t]) && wm[t][0] ? wm[t][0].values.length : 0), 0) };   // the six data tables (FTS shadow tables carry internal rows)
});
const sentinelTables = page => page.evaluate(() => {
  for (const t of ['wiz_events_ledger', 'continuity_carrier', 'experiment_registry']) { window._wizDB.run(`CREATE TABLE IF NOT EXISTS ${t}(id TEXT PRIMARY KEY, v TEXT)`); window._wizDB.run(`INSERT OR REPLACE INTO ${t} VALUES('1','sentinel')`); }
  window._wizDB.run("INSERT OR REPLACE INTO wiz_facts(id, claim) VALUES('sentinel-fact','sentinel claim')");
});
const wmExport = page => page.evaluate(() => window.WmStore.exportData());
const logicalOf = d => crypto.createHash('sha256').update(JSON.stringify({ format: d.format, projects: d.projects, sources: d.sources, items: d.items, item_sources: d.item_sources, relations: d.relations, changes: d.changes })).digest('hex');
// Spies installed AFTER the app is up and BEFORE the buttons are pressed: everything the harness does is attributed by call stack.
const installSpies = page => page.evaluate(() => {
  const spy = window.__b1spy = { harness: [], all: {} };
  const mark = (kind, detail) => { spy.all[kind] = (spy.all[kind] || 0) + 1; if (/b1-device-harness/.test(new Error().stack || '')) spy.harness.push(kind + ':' + (detail === undefined ? '' : detail)); };
  const wrap = (obj, name, kind, detailOf) => { const orig = obj[name]; obj[name] = function () { mark(kind, detailOf ? detailOf(arguments) : ''); return orig.apply(this, arguments); }; };
  for (const m of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) wrap(Storage.prototype, m, 'storage.' + m, a => a[0]);
  wrap(indexedDB, 'open', 'indexedDB.open', a => a[0]);
  wrap(window, 'fetch', 'fetch', a => String(a[0]));
  wrap(XMLHttpRequest.prototype, 'open', 'xhr', a => a[1]);
  wrap(navigator, 'sendBeacon', 'sendBeacon');
  for (const m of ['open', 'delete', 'match', 'has']) wrap(window.caches, m, 'caches.' + m);
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get() { mark('cookie.get'); return cookie.get.call(this); }, set(v) { mark('cookie.set'); cookie.set.call(this, v); } });
  const WS = window.WebSocket; window.WebSocket = function () { mark('WebSocket'); return new WS(...arguments); };
});
const spyReport = page => page.evaluate(() => ({ harness: window.__b1spy.harness, all: window.__b1spy.all }));
const wrapStore = (page, importStub) => page.evaluate(src => { const real = window.WmStore; window.__realStore = real; const stub = eval('(' + src + ')'); window.WmStore = { exportData: () => real.exportData(), importJSON: payload => stub(real, payload) }; }, importStub.toString());
const restoreStore = page => page.evaluate(() => { window.WmStore = window.__realStore; });

try {
  let ok = false;
  for (let i = 0; i < 100 && !ok; i++) { try { ok = (await fetch(BASE)).ok; } catch (_) {} if (!ok) await new Promise(r => setTimeout(r, 100)); }
  assert(ok, 'static server did not start');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });

  await T('NORMAL_UI_UNCHANGED: without ?b1device=1 (also ?b1device=0 / true / empty / no query) there is no harness screen, no harness script, no harness request, no overlay', async () => {
    for (const q of ['', '?b1device=0', '?b1device=true', '?b1device=', '?b1device', '?x=1', '#b1device=1']) {
      const { context, page } = await phone();
      await page.goto(BASE + q, { waitUntil: 'load' }); await ready(page);
      await new Promise(r => setTimeout(r, 400));
      const state = await page.evaluate(() => ({ root: !!document.getElementById('b1device-root'), scripts: [...document.scripts].map(s => s.src).filter(s => /b1-device/.test(s)),
        text: /B1-DEVICE TEST/.test(document.body.innerText), fixed: [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).zIndex === '2147483647').length }));
      assert.deepEqual(state, { root: false, scripts: [], text: false, fixed: 0 }, 'harness visible for ' + JSON.stringify(q));
      assert(!page.requests.some(u => /b1-device-harness/.test(u)), 'harness requested for ' + JSON.stringify(q));
      assert.deepEqual(page.errors, [], 'page errors for ' + JSON.stringify(q));
      await context.close();
    }
  });

  await T('NORMAL_UI_UNCHANGED (DOM): the live page without the query equals the page served WITHOUT the gate (head + body after load)', async () => {
    const snapshot = async stripGate => {
      const { context, page } = await phone();
      if (stripGate) {
        await page.setRequestInterception(true);
        page.on('request', req => {
          if (req.url().split('?')[0] === BASE) fetch(BASE).then(r => r.text()).then(t => req.respond({ status: 200, contentType: 'text/html', body: t.replace(/<script>\s*\(function \(\) \{\s*try \{\s*if \(new URLSearchParams\(location\.search\)\.get\('b1device'\)[\s\S]*?<\/script>/, '') }));
          else req.continue();
        });
      }
      await page.goto(BASE, { waitUntil: 'load' }); await ready(page); await new Promise(r => setTimeout(r, 600));
      const html = await page.evaluate(() => ({ body: document.body.innerHTML.replace(/\d{13}/g, 'TS'), head: [...document.head.children].map(c => c.tagName + ':' + (c.src || c.href || c.id || (c.tagName === 'SCRIPT' ? c.textContent.trim().slice(0, 40) : ''))) }));
      await context.close(); return html;
    };
    const withGate = await snapshot(false), withoutGate = await snapshot(true);
    const gateHead = withGate.head.filter(h => /^SCRIPT:\(function \(\) \{/.test(h) && !withoutGate.head.includes(h));
    assert.equal(gateHead.length, 1, 'exactly one extra head element (the inert gate): ' + JSON.stringify(gateHead));
    assert.deepEqual(withGate.head.filter(h => !gateHead.includes(h)), withoutGate.head, 'head differs beyond the gate');
    assert.equal(withGate.body, withoutGate.body, 'body differs when the gate is present');
  });

  await T('PHONE_SCREEN: ?b1device=1 shows the clearly marked NON PRODUCTION screen with the three required buttons, usable at 360 px with touch', async () => {
    const { context, page } = await phone();
    await openHarness(page);
    const ui = await page.evaluate(() => {
      const root = document.getElementById('b1device-root'), r = root.getBoundingClientRect();
      const btn = id => { const b = document.getElementById(id), x = b.getBoundingClientRect(), top = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return { label: b.textContent, w: Math.round(x.width), h: Math.round(x.height), left: Math.round(x.left), right: Math.round(x.right), unobstructed: top === b }; };
      return { title: document.getElementById('b1d-title').textContent, sub: document.getElementById('b1d-sub').textContent, root: { w: r.width, h: r.height, z: getComputedStyle(root).zIndex, noHScroll: root.scrollWidth <= root.clientWidth },
        buttons: ['b1d-check', 'b1d-import', 'b1d-fingerprint'].map(btn), allButtons: [...root.querySelectorAll('button')].map(b => b.textContent), verdict: document.getElementById('b1d-verdict').getAttribute('data-verdict'), ext: [...root.querySelectorAll('[src],[href],link,img,iframe')].length };
    });
    assert.equal(ui.title, 'B1-DEVICE TEST — NON PRODUCTION'); assert(/TEST ONLY/.test(ui.sub));
    assert.deepEqual(ui.allButtons, ['CHECK ENVIRONMENT', 'IMPORT FROZEN FIXTURE', 'RUN FINGERPRINT']);
    assert.equal(ui.root.w, 360); assert.equal(ui.root.h, 740); assert.equal(ui.root.z, '2147483647'); assert(ui.root.noHScroll, 'horizontal scroll inside the screen');
    for (const b of ui.buttons) { assert(b.h >= 48 && b.w >= 300 && b.left >= 0 && b.right <= 360 && b.unobstructed, JSON.stringify(b)); }
    assert.equal(ui.verdict, 'NONE'); assert.equal(ui.ext, 0, 'no external resource inside the screen');
    assert.deepEqual(page.errors, []);
    await context.close();
  });

  await T('DEVICE_FLOW: CHECK (read-only) -> FINGERPRINT on empty = FAIL -> IMPORT = PASS -> second IMPORT aborts -> FINGERPRINT = PASS (exact hashes, counts, work_id+status) -> reopen -> still PASS; nothing else touched', async () => {
    const { context, page } = await phone();
    await openHarness(page); await sentinelTables(page);
    const f0 = await dbParts(page);
    assert.equal(f0.wmRows, 0, 'fresh profile: wm_* empty');
    assert(f0.otherTables.includes('wiz_events_ledger') && f0.otherTables.includes('continuity_carrier') && f0.otherTables.includes('experiment_registry') && f0.otherTables.some(t => t.startsWith('wiz_ref_')), 'sentinel + wiz_ref tables present');
    await installSpies(page);
    const requestsBefore = page.requests.length;

    const check = await tap(page, 'b1d-check');
    assert.equal(check.verdict, 'ENV_OK');
    for (const s of ['WmStore = PRESENT', 'WmStore.exportData = function', 'WmStore.importJSON = function', 'WorkingMemory.EXPORT_FORMAT = eiti-working-memory-export/1', 'FIXTURE_SELF_CHECK = PASS',
      'FIXTURE_RAW_SHA256 = 29b0e3d2e2025f1fab8979ae40169be78ce455549573617b57bd213e45eb73d4', 'WM_EMPTY = YES (rows=0)', 'IMPORT_WOULD_PROCEED = YES', 'WRITES_PERFORMED = NO', 'APP_VERSION = 1.8.8', 'SW_CACHE = ', 'HARNESS_BUILD = ', 'USER_AGENT = ' + SAMSUNG_UA])
      assert(check.text.includes(s), 'CHECK output missing: ' + s + '\n' + check.text);
    assert.deepEqual(await dbParts(page), f0, 'CHECK ENVIRONMENT changed the database');

    const emptyFp = await tap(page, 'b1d-fingerprint');
    assert.equal(emptyFp.verdict, 'FAIL'); assert(/^FINGERPRINT_FAIL/.test(emptyFp.text) && emptyFp.text.includes('NOTE: wm_* is empty'));
    assert.deepEqual(await dbParts(page), f0, 'FINGERPRINT changed the database');

    const imp = await tap(page, 'b1d-import');
    assert.equal(imp.verdict, 'IMPORT_PASS', imp.text);
    for (const s of ['SEED_HASH(fixture) = ' + SEED_HASH + ' (verified)', 'importJSON = ok imported=32 unchanged=0', 'wm_projects = 2', 'wm_sources = 3', 'wm_items = 9', 'wm_item_sources = 1', 'wm_relations = 1', 'wm_changes = 16',
      'LOGICAL_EXPORT_HASH = ' + LOGICAL_EXPORT_HASH, 'SEED_HASH = ' + SEED_HASH, 'PASS: imported exact fixture; projects=2 items=9 sources=3 relations=1 item_sources=1 changes=16'])
      assert(imp.text.includes(s), 'IMPORT output missing: ' + s + '\n' + imp.text);
    const f1 = await dbParts(page);
    assert.equal(f1.other, f0.other, 'IMPORT touched a non-wm table (Canon / wiz_ref / Continuity / ledger / registry / facts)');
    assert.notEqual(f1.wm, f0.wm); assert.equal(f1.wmRows, 32);
    const exported = await wmExport(page);                                       // independent of the harness: node crypto over the real export
    assert.equal(logicalOf(exported), LOGICAL_EXPORT_HASH);
    assert.deepEqual(['projects', 'items', 'sources', 'relations', 'item_sources', 'changes'].map(k => exported[k].length), [2, 9, 3, 1, 1, 16]);

    const again = await tap(page, 'b1d-import');
    assert.equal(again.verdict, 'IMPORT_FAIL'); assert(again.text.includes('WM not empty (rows=32) — abort') && again.text.includes('WRITE_ATTEMPTED = NO'), again.text);
    assert.deepEqual(await dbParts(page), f1, 'aborted IMPORT changed the database');

    const fp = await tap(page, 'b1d-fingerprint');
    assert.equal(fp.verdict, 'PASS'); assert(/^FINGERPRINT_PASS/.test(fp.text));
    const appVersion = await page.evaluate(() => APP_VERSION);
    for (const s of ['APP_VERSION = ' + appVersion, 'LOGICAL_EXPORT_HASH = ' + LOGICAL_EXPORT_HASH, 'SEED_HASH = ' + SEED_HASH, 'EXPECTED_LOGICAL = ' + LOGICAL_EXPORT_HASH, 'EXPECTED_SEED = ' + SEED_HASH, 'wm_changes = 16', 'WRITES_PERFORMED = NO', ...STATUSES.map(s => '  ' + s)])
      assert(fp.text.includes(s), 'FINGERPRINT output missing: ' + s + '\n' + fp.text);
    assert(fp.text.includes('work_id_status = ' + STATUSES.map(s => s.replace('  ', ':')).sort().join('|')));
    assert.deepEqual(await dbParts(page), f1, 'FINGERPRINT changed the database');

    // what the harness itself did to the outside world while buttons were pressed
    const spies = await spyReport(page);
    assert.deepEqual(spies.harness.filter(x => !/^caches\.keys/.test(x)), [], 'harness-attributed storage / network / cookie / cache access: ' + JSON.stringify(spies.harness));
    assert.equal(page.requests.length, requestsBefore, 'network requests while the harness ran: ' + JSON.stringify(page.requests.slice(requestsBefore)));
    assert.deepEqual(page.errors, []);

    // "close and reopen": same profile, fresh page — the import is durable and the harness reports the same fingerprint
    const reopened = await context.newPage();
    await reopened.setBypassServiceWorker(true); await reopened.setUserAgent(SAMSUNG_UA); await reopened.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
    reopened.errors = []; reopened.on('pageerror', e => reopened.errors.push(String(e.message || e)));
    await page.close();
    await openHarness(reopened);
    const fp2 = await tap(reopened, 'b1d-fingerprint');
    assert.equal(fp2.verdict, 'PASS', fp2.text); assert(fp2.text.includes('LOGICAL_EXPORT_HASH = ' + LOGICAL_EXPORT_HASH) && fp2.text.includes('SEED_HASH = ' + SEED_HASH));
    assert.equal((await dbParts(reopened)).other, f0.other, 'non-wm tables after reopen');
    // normal UI of the same profile: the data is there, the screen is not
    await reopened.goto(BASE, { waitUntil: 'load' }); await ready(reopened);
    assert.equal(await reopened.evaluate(() => !!document.getElementById('b1device-root')), false);
    assert.equal(logicalOf(await wmExport(reopened)), LOGICAL_EXPORT_HASH);
    assert.deepEqual(reopened.errors, []);
    await context.close();
  });

  await T('FAIL_CLOSED: non-empty wm_* -> IMPORT aborts before any write (WRITE_ATTEMPTED = NO), rows unchanged; CHECK says import would not proceed', async () => {
    const { context, page } = await phone();
    await openHarness(page);
    await page.evaluate(async () => { const r = await window.WmStore.createProject({ project_id: 'preexisting', code: 'PRE', name: 'Pre-existing project' }); if (!r.ok) throw new Error(JSON.stringify(r)); });
    const before = await dbParts(page); assert(before.wmRows > 0);
    const check = await tap(page, 'b1d-check');
    assert.equal(check.verdict, 'ENV_OK'); assert(check.text.includes('WM_EMPTY = NO') && check.text.includes('IMPORT_WOULD_PROCEED = NO'), check.text);
    const imp = await tap(page, 'b1d-import');
    assert.equal(imp.verdict, 'IMPORT_FAIL'); assert(/WM not empty \(rows=\d+\) — abort/.test(imp.text) && imp.text.includes('WRITE_ATTEMPTED = NO'), imp.text);
    assert.deepEqual(await dbParts(page), before, 'rows changed');
    const fp = await tap(page, 'b1d-fingerprint'); assert.equal(fp.verdict, 'FAIL');
    await context.close();
  });

  await T('FAIL_CLOSED: a tampered fixture (one byte changed in the served harness) is refused by the raw-SHA check before any write; CHECK reports FIXTURE_SELF_CHECK = FAIL', async () => {
    const { context, page } = await phone();
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (/b1-device-harness\.js/.test(req.url())) {
        const body = (await (await fetch(req.url())).text()).replace('Project FIRN synthetic', 'Project FIRN syntheti_');
        req.respond({ status: 200, contentType: 'application/javascript', body });
      } else req.continue();
    });
    await openHarness(page);
    const before = await dbParts(page);
    const check = await tap(page, 'b1d-check'); assert.equal(check.verdict, 'ENV_FAIL'); assert(check.text.includes('FIXTURE_SELF_CHECK = FAIL') && /fixture raw SHA-256 mismatch/.test(check.text), check.text);
    const imp = await tap(page, 'b1d-import');
    assert.equal(imp.verdict, 'IMPORT_FAIL'); assert(/fixture raw SHA-256 mismatch/.test(imp.text) && imp.text.includes('WRITE_ATTEMPTED = NO'), imp.text);
    assert.deepEqual(await dbParts(page), before, 'rows written from a tampered fixture');
    await context.close();
  });

  await T('FAIL_CLOSED: importJSON failure is reported verbatim (code, rolledBack, persistenceState), nothing is claimed PASS, and a retry on the unchanged empty store succeeds', async () => {
    const { context, page } = await phone();
    await openHarness(page);
    const before = await dbParts(page);
    await wrapStore(page, async () => ({ ok: false, saved: false, code: 'WM_WRITE_FAILED', error: 'IndexedDB read-back mismatch (bytes differ at offset 27)', rolledBack: true, persistenceState: 'RESTORED' }));
    const bad = await tap(page, 'b1d-import');
    assert.equal(bad.verdict, 'IMPORT_FAIL');
    assert(bad.text.includes('importJSON failed: WM_WRITE_FAILED IndexedDB read-back mismatch') && bad.text.includes('rolledBack=true persistenceState=RESTORED') && bad.text.includes('WRITE_ATTEMPTED = YES'), bad.text);
    assert(!/PASS: imported/.test(bad.text));
    assert.deepEqual(await dbParts(page), before);
    await restoreStore(page);
    const retry = await tap(page, 'b1d-import'); assert.equal(retry.verdict, 'IMPORT_PASS', retry.text);
    assert.equal((await tap(page, 'b1d-fingerprint')).verdict, 'PASS');
    await context.close();
  });

  await T('FAIL_CLOSED: if the store ends up holding anything other than the exact fixture, IMPORT and FINGERPRINT say FAIL (a wrong import is never PASS)', async () => {
    const { context, page } = await phone();
    await openHarness(page);
    // importJSON "succeeds" but with one status changed -> same counts, different logical hash
    await wrapStore(page, async (real, payload) => { const p = JSON.parse(JSON.stringify(payload)); p.items[4].status = 'OPEN'; p.changes.forEach(c => { if (c.work_id === p.items[4].work_id && c.change_type === 'CREATE_ITEM') c.after_json = c.after_json.replace('"status":"UNKNOWN"', '"status":"OPEN"'); }); return real.importJSON(p); });
    const bad = await tap(page, 'b1d-import');
    assert.equal(bad.verdict, 'IMPORT_FAIL'); assert(/LOGICAL hash mismatch/.test(bad.text) && /rows were written — clear this browser profile/.test(bad.text) && bad.text.includes('WRITE_ATTEMPTED = YES'), bad.text);
    assert(!/PASS: imported/.test(bad.text));
    const fp = await tap(page, 'b1d-fingerprint'); assert.equal(fp.verdict, 'FAIL'); assert(/^FINGERPRINT_FAIL/.test(fp.text));
    await context.close();
  });

  await T('FAIL_CLOSED: drift after a good import is detected by FINGERPRINT (FAIL), WmStore missing / null is reported on every button', async () => {
    const { context, page } = await phone();
    await openHarness(page);
    assert.equal((await tap(page, 'b1d-import')).verdict, 'IMPORT_PASS');
    assert.equal((await tap(page, 'b1d-fingerprint')).verdict, 'PASS');
    await page.evaluate(async () => { const r = await window.WmStore.updateItem('WRK-FIRN-20261006-005', { status: 'OPEN' }); if (!r.ok) throw new Error(JSON.stringify(r)); });
    const drift = await tap(page, 'b1d-fingerprint'); assert.equal(drift.verdict, 'FAIL'); assert(/^FINGERPRINT_FAIL/.test(drift.text) && !drift.text.includes('LOGICAL_EXPORT_HASH = ' + LOGICAL_EXPORT_HASH));
    await page.evaluate(() => { window.__realStore = window.WmStore; window.WmStore = null; });
    const c = await tap(page, 'b1d-check'), i = await tap(page, 'b1d-import'), f = await tap(page, 'b1d-fingerprint');
    assert.equal(c.verdict, 'ENV_FAIL'); assert(c.text.includes('WmStore = NULL'), c.text);
    assert.equal(i.verdict, 'IMPORT_FAIL'); assert(i.text.includes('WmStore missing') && i.text.includes('WRITE_ATTEMPTED = NO'));
    assert.equal(f.verdict, 'FAIL');
    await context.close();
  });

  await T('SERVICE_WORKER: with the real service worker the harness loads, SW/cache version is observable, and the production SW is untouched (harness not precached; served cache-first by build id)', async () => {
    const { context, page } = await phone({ bypassSW: false });
    // Steady-state visit: the app's first-visit version reset (pre-existing) deletes eiti-wizard-lab-* caches asynchronously, which can race with the
    // service worker's install and leave SW_CACHE = NONE on a brand-new profile. The harness reports whatever is observable; here the version is seeded
    // (like b1-sw-upgrade.test.mjs) so the cache name is deterministic.
    const appVersion = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/const APP_VERSION = '([^']+)'/)[1];
    await page.evaluateOnNewDocument(v => { try { localStorage.setItem('wiz_lab_app_version', v); } catch (_) {} }, appVersion);
    await page.goto(BASE + '?b1device=1', { waitUntil: 'load' }); await ready(page); await page.waitForSelector('#b1device-root', { timeout: 15000 });
    await page.waitForFunction(async () => navigator.serviceWorker.controller && (await caches.keys()).some(k => k.startsWith('eiti-wizard-lab-')), { timeout: 30000 });
    const swSource = await (await fetch(BASE.replace('index.html', 'sw.js'))).text();
    assert(!/b1-device/.test(swSource), 'sw.js mentions the harness');
    const check = await tap(page, 'b1d-check');
    assert.equal(check.verdict, 'ENV_OK', check.text);
    const cacheName = swSource.match(/const CACHE_NAME = '([^']+)'/)[1];
    assert(check.text.includes('SW_CACHE = ' + cacheName) && check.text.includes('SW_CONTROL = CONTROLLED'), check.text);
    const build = await page.evaluate(() => new URL([...document.scripts].find(s => /b1-device-harness/.test(s.src)).src).searchParams.get('h'));
    assert(check.text.includes('HARNESS_BUILD = ' + build));
    assert.equal(build, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'b1-device-harness.js'))).digest('hex').slice(0, 12));
    assert.equal((await tap(page, 'b1d-import')).verdict, 'IMPORT_PASS');
    assert.equal((await tap(page, 'b1d-fingerprint')).verdict, 'PASS');
    assert.deepEqual(page.errors, []);
    await context.close();
  });

  console.log(`\n${passed}/${passed + failed} browser scenarios passed.`);
  completed = true; process.exitCode = failed ? 1 : 0;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
  fs.rmSync(temp, { recursive: true, force: true });
}

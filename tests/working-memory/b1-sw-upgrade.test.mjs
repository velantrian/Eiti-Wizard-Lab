// Gate B1 service-worker test in a real browser (service worker NOT bypassed).
//  1. A returning client of the Gate A baseline (old SW + old cache) upgrades to the B1 tree:
//     old cache removed, fresh scripts loaded, wm_* read bridge available.
//  2. The Research Index is network-first: an updated index is seen online despite the SW,
//     and the offline fallback is flagged OFFLINE_CACHE.
// Requires Chromium and puppeteer-core; the application itself remains dependency-free.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BASELINE = '72c5f7f06a254798accb2ccde77801cbb7b82aef';   // Gate A merge: sw.js CACHE_NAME eiti-wizard-lab-v1.8.10-wm0
const pupPath = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteer = (await import(pupPath.startsWith('/')
  ? pathToFileURL(path.join(pupPath, 'lib/esm/puppeteer/puppeteer-core.js')).href
  : pupPath)).default;
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-sw-'));
const oldTree = path.join(temp, 'old'), newTree = path.join(temp, 'new'), site = path.join(temp, 'site');
fs.mkdirSync(oldTree); fs.mkdirSync(site);
execFileSync('sh', ['-c', `git -C "${ROOT}" archive ${BASELINE} | tar -x -C "${oldTree}"`]);
fs.cpSync(ROOT, newTree, { recursive: true, filter: p => !/[\\/](\.git|node_modules)([\\/]|$)/.test(p) });
const serve = tree => { try { fs.unlinkSync(path.join(site, 'Eiti-Wizard-Lab')); } catch (_) {} fs.symlinkSync(tree, path.join(site, 'Eiti-Wizard-Lab')); };
serve(oldTree);
const cacheName = tree => fs.readFileSync(path.join(tree, 'sw.js'), 'utf8').match(/const CACHE_NAME = '([^']+)'/)[1];
const OLD_CACHE = cacheName(oldTree), NEW_CACHE = cacheName(newTree);
assert.notEqual(OLD_CACHE, NEW_CACHE, 'CACHE_NAME must differ from the baseline');

const portProbe = net.createServer();
await new Promise((resolve, reject) => portProbe.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: site, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/Eiti-Wizard-Lab/index.html`;
let browser;
const route = (page, args) => page.evaluate(async a => JSON.parse(await executeAgentTool('research_route', a)), args);
try {
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) { try { ready = (await fetch(url)).ok; } catch (_) {} if (!ready) await new Promise(r => setTimeout(r, 100)); }
  assert(ready, 'static server did not start');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error.message || error)));

  // ── 1a. old client: baseline SW + cache, no bridge ──
  // A genuine RETURNING client already has the app version stored; on a first visit index.html deletes every
  // eiti-wizard-lab-* cache while the service worker is installing (version-bump cleanup), which would race this test.
  const appVersion = tree => fs.readFileSync(path.join(tree, 'index.html'), 'utf8').match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)[1];
  assert.equal(appVersion(oldTree), appVersion(newTree), 'APP_VERSION changed: that path wipes caches and is a different scenario');
  await page.evaluateOnNewDocument(v => { try { localStorage.setItem('wiz_lab_app_version', v); } catch (_) {} }, appVersion(oldTree));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && window.WmStore, { timeout: 30000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async n => (await caches.keys()).includes(n), { timeout: 30000 }, OLD_CACHE);
  const oldState = await page.evaluate(() => ({ listProjects: typeof window.WmStore.listProjects, bridge: !!window.WmAgentRead }));
  assert.deepEqual(oldState, { listProjects: 'undefined', bridge: false }, 'baseline client unexpectedly has B1');

  // ── 1b. deploy B1; the returning client reloads while the OLD service worker is still in control ──
  serve(newTree);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && window.WmStore && window.WmAgentRead, { timeout: 30000 });
  const transient = await page.evaluate(async () => ({ listProjects: typeof window.WmStore.listProjects, wm: JSON.parse(await executeAgentTool('wm_orientation', {})),
    research: JSON.parse(await executeAgentTool('research_route', { query: 'NOT_RUN' })) }));
  if (transient.listProjects !== 'function') {   // stale cache-first working-memory.js: must degrade explicitly, never crash
    assert.equal(transient.wm.code, 'WORKING_MEMORY_UNAVAILABLE'); assert.match(transient.wm.error, /stale or incomplete/);
  }
  assert.equal(transient.research.index_loaded, true, 'research_route must not depend on the stale Working Memory script');

  // ── 1c. new SW installs, old cache is removed, fresh scripts are served ──
  await page.waitForFunction(async (oldName, newName) => { const k = await caches.keys(); return k.includes(newName) && !k.includes(oldName); }, { timeout: 30000 }, OLD_CACHE, NEW_CACHE);
  const keys = await page.evaluate(() => caches.keys());
  assert(!keys.includes(OLD_CACHE), 'old cache not removed'); assert(keys.includes(NEW_CACHE));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && window.WmStore && window.WmAgentRead, { timeout: 30000 });
  const fresh = await page.evaluate(async () => ({ controlled: !!navigator.serviceWorker.controller, listProjects: typeof window.WmStore.listProjects,
    script: (await (await fetch('working-memory.js')).text()).includes('listItemSources'), wm: JSON.parse(await executeAgentTool('wm_orientation', {})),
    tools: AGENT_TOOLS_SPEC.map(t => t.name).filter(n => /^wm_|^research_route$/.test(n)).length }));
  assert.equal(fresh.controlled, true, 'page is not controlled by the service worker (test would not exercise the SW)');
  assert.equal(fresh.listProjects, 'function'); assert(fresh.script, 'served working-memory.js is stale'); assert.equal(fresh.tools, 8);
  assert.equal(fresh.wm.mode, 'WORKING'); assert.equal(fresh.wm.ok, undefined);
  console.log('PASS  returning client: old cache removed, B1 scripts loaded, wm_* read bridge available');

  // ── 2. Research Index freshness through the service worker ──
  const before = await route(page, { card: 1 });
  assert.equal(before.index_loaded, true); assert.equal(before.index_source, 'NETWORK'); assert(!before.cards[0].STATUS.includes('FRESHNESS-MARKER'));
  const idxPath = path.join(newTree, 'docs/research/EXPERIMENT_EVIDENCE_INDEX.md');
  const idx = fs.readFileSync(idxPath, 'utf8'); const at = idx.indexOf('\n### 1. ');
  const edited = idx.slice(0, at) + idx.slice(at).replace('\nSTATUS: ', '\nSTATUS: FRESHNESS-MARKER ');
  assert.notEqual(edited, idx); fs.writeFileSync(idxPath, edited);
  const online = await route(page, { card: 1 });   // an earlier fetch put the OLD text in the SW cache; network-first must still return the new text
  assert(online.cards[0].STATUS.includes('FRESHNESS-MARKER'), 'stale research index served despite online'); assert.equal(online.index_source, 'NETWORK');
  console.log('PASS  updated research index refreshed online despite the service worker');

  // ── offline fallback (server stopped): cached copy, explicitly flagged ──
  server.kill(); await new Promise(r => setTimeout(r, 500));
  const offline = await route(page, { card: 1 });
  assert.equal(offline.index_loaded, true); assert.equal(offline.index_source, 'OFFLINE_CACHE'); assert(offline.cards[0].STATUS.includes('FRESHNESS-MARKER'));
  console.log('PASS  offline fallback serves the cached index and is flagged OFFLINE_CACHE');
  assert.deepEqual(pageErrors, [], 'browser errors: ' + JSON.stringify(pageErrors));
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.rmSync(temp, { recursive: true, force: true });
}

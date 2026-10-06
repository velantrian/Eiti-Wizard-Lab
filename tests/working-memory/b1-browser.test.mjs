// Gate B1 browser test: agent read bridge through the real app dispatcher and IndexedDB.
// Requires Chromium and puppeteer-core; the application itself remains dependency-free.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const pupPath = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteer = (await import(pupPath.startsWith('/')
  ? pathToFileURL(path.join(pupPath, 'lib/esm/puppeteer/puppeteer-core.js')).href
  : pupPath)).default;
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-browser-'));
fs.symlinkSync(ROOT, path.join(temp, 'Eiti-Wizard-Lab'));
const portProbe = net.createServer();
await new Promise((resolve, reject) => portProbe.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: temp, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/Eiti-Wizard-Lab/index.html`;
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try { ready = (await fetch(url)).ok; } catch (_) {}
    if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'static server did not start');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setBypassServiceWorker(true);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error.message || error)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && window.WorkingMemory && window.WmStore, { timeout: 30000 });

  // B1: bounded browser checks for the agent read bridge (synthetic data only).
  const ready2 = await page.evaluate(() => ({ bridge: !!window.WmAgentRead, router: !!window.ResearchRouter,
    tools: window.AGENT_TOOLS_SPEC ? true : typeof AGENT_TOOLS_SPEC !== 'undefined' }));
  assert(ready2.bridge && ready2.router, 'WmAgentRead / ResearchRouter not loaded');
  const toolsRegistered = await page.evaluate(() => AGENT_TOOLS_SPEC.map(t => t.name).filter(n => /^wm_|^research_route$/.test(n)).sort());
  assert.deepEqual(toolsRegistered, ['research_route','wm_get','wm_list','wm_list_projects','wm_orientation','wm_project_sources','wm_related','wm_search']);

  await page.evaluate(async () => {
    const p = await window.WmStore.createProject({ project_id: 'b1-browser', code: 'B1-BROWSER', name: 'B1 browser fixture' });
    await window.WmStore.createSource({ source_id: 'b1-src', project_id: p.data.project_id, surface: 'LOCAL', role: 'PRIMARY', title: 'Synthetic', locator: 'local://synthetic/b1' });
    const mk = (title, extra) => window.WmStore.createItem(Object.assign({ project_id: 'b1-browser', title, provenance_class: 'USER_NOTE' }, extra));
    await mk('Browser current', { status: 'CURRENT' });
    const prog = await mk('Browser in progress', { status: 'IN_PROGRESS', next_action: 'Continue browser step' });
    await mk('Browser blocked', { status: 'BLOCKED', status_note: 'waiting' });
    await mk('Browser unknown', { status: 'UNKNOWN' });
    await window.WmStore.addItemSource({ work_id: prog.data.work_id, source_id: 'b1-src', is_primary: true });
  });
  // Page-level tool dispatch: executeAgentTool is the real dispatcher the agent loop uses.
  const readAll = () => page.evaluate(async () => {
    const out = {};
    for (const [n, a] of [['wm_orientation', { project: 'B1-BROWSER' }], ['wm_list_projects', {}], ['wm_list', { project: 'B1-BROWSER' }],
      ['wm_search', { query: 'blocked' }], ['wm_project_sources', { project: 'B1-BROWSER' }]]) out[n] = JSON.parse(await executeAgentTool(n, a));
    const fp = () => JSON.stringify(['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes'].map(t => window._wizDB.exec('SELECT * FROM ' + t + ' ORDER BY 1,2')));
    return { out, fp: fp() };
  });
  const fpBefore = await page.evaluate(() => JSON.stringify(['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes'].map(t => window._wizDB.exec('SELECT * FROM ' + t + ' ORDER BY 1,2'))));
  const first = await readAll();
  assert.equal(first.out.wm_orientation.mode, 'WORKING');
  assert.equal(first.out.wm_orientation.research.loaded, false);
  assert.equal(first.out.wm_orientation.blocked[0].title, 'Browser blocked');
  assert.equal(first.out.wm_orientation.in_progress[0].next_action, 'Continue browser step');
  assert.equal(first.out.wm_project_sources.sources[0].locator, 'local://synthetic/b1');
  assert.equal(first.fp, fpBefore, 'read tools mutated wm_*');
  const route = await page.evaluate(async () => JSON.parse(await executeAgentTool('research_route', { query: 'NOT_RUN' })));
  assert.equal(route.plane, 'RESEARCH'); assert.equal(route.promoted_to_working, false);
  assert.equal(route.index_loaded, true); assert.equal(route.parse_status, 'OK'); assert(route.matched >= 1, 'NOT_RUN query found no research cards');
  assert(route.cards.every(c => !('execution_verdict_token' in c)), 'derived verdict field present');
  const both = await page.evaluate(async () => JSON.parse(await executeAgentTool('research_route', { card: 1, query: 'x' })));
  assert.equal(both.ok, false); assert.equal(both.code, 'VALIDATION');
  const fpAfterRoute = await page.evaluate(() => JSON.stringify(['wm_projects','wm_sources','wm_items','wm_item_sources','wm_relations','wm_changes'].map(t => window._wizDB.exec('SELECT * FROM ' + t + ' ORDER BY 1,2'))));
  assert.equal(fpAfterRoute, fpBefore, 'research_route mutated wm_*');
  const prompt = await page.evaluate(() => window.WmAgentRead.GUIDANCE.includes('DEFAULT_RUNTIME_MODE = WORKING'));
  assert(prompt);

  // WORKING PLANE FAILURE != RESEARCH PLANE FAILURE: research_route must work with WmStore unavailable.
  const noWm = await page.evaluate(async () => {
    const saved = window.WmStore; window.WmStore = null;
    try {
      return { research: JSON.parse(await executeAgentTool('research_route', { query: 'NOT_RUN' })), working: JSON.parse(await executeAgentTool('wm_orientation', {})) };
    } finally { window.WmStore = saved; }
  });
  assert.equal(noWm.research.index_loaded, true); assert(noWm.research.matched >= 1);
  assert.equal(noWm.working.ok, false); assert.equal(noWm.working.code, 'WORKING_MEMORY_UNAVAILABLE');
  assert.equal(await page.evaluate(() => !!window.WmStore), true, 'WmStore restored');

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && window.WmStore && window.WmAgentRead, { timeout: 30000 });
  const second = await readAll();
  assert.deepEqual(second.out.wm_orientation, first.out.wm_orientation, 'orientation changed across reload');
  assert.equal(second.fp, fpBefore, 'reload + read tools changed wm_*');
  assert.deepEqual(pageErrors, [], 'browser errors: ' + JSON.stringify(pageErrors));
  console.log('PASS  B1 browser: tools registered, orientation via real dispatcher, read tools no mutation, reload preserves orientation, no page errors');
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.rmSync(temp, { recursive: true, force: true });
}

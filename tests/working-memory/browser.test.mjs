// Browser integration test for Working Memory durability through real IndexedDB.
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

  const writeResult = await page.evaluate(async () => {
    const p = await window.WmStore.createProject({ project_id: 'wm-browser-project', name: 'Browser persistence fixture' });
    const s = await window.WmStore.createSource({ source_id: 'wm-browser-source', title: 'Synthetic source', project_id: p.data.project_id });
    const i = await window.WmStore.createItem({
      work_id: 'wm-browser-item', project_id: p.data.project_id, title: 'Durable browser record',
      type: 'TASK', status: 'OPEN', priority: 'HIGH', summary: 'IndexedDB read-back fixture',
      body_md: 'Only synthetic test data.', tags: ['browser','durable'], non_canon: true,
    });
    const link = await window.WmStore.addItemSource({ work_id: i.data.work_id, source_id: s.data.source_id, is_primary: true });
    const relation = await window.WmStore.addRelation({ from_work_id: i.data.work_id, to_work_id: i.data.work_id, relation_type: 'RELATED_TO' }).catch(error => ({ rejected: error.message }));
    return { project: p, source: s, item: i, link, relation };
  });
  for (const key of ['project','source','item','link']) assert(writeResult[key].ok && writeResult[key].saved, `${key} was not durably saved: ${JSON.stringify(writeResult[key])}`);
  assert(writeResult.item.persistence.verified === true, 'WM mutation did not receive verified persistence acknowledgement');
  assert(!writeResult.relation.ok && writeResult.relation.code === 'SELF_RELATION', 'self relation did not fail closed');

  const independentRead = await page.evaluate(async workId => {
    const buffer = await new Promise((resolve, reject) => {
      const request = indexedDB.open('wiz_lab_mem_store', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = event => {
        const db = event.target.result;
        const get = db.transaction('kv', 'readonly').objectStore('kv').get('wiz_lab_sqlite_db');
        get.onsuccess = () => { db.close(); resolve(get.result); };
        get.onerror = () => { db.close(); reject(get.error); };
      };
    });
    if (!buffer) throw new Error('SQLite snapshot missing from IndexedDB');
    const SQL = await initSqlJs({ locateFile: file => file });
    const fresh = new SQL.Database(new Uint8Array(buffer));
    const rows = fresh.exec('SELECT title, non_canon FROM wm_items WHERE work_id=?', [workId]);
    const links = fresh.exec('SELECT count(*) FROM wm_item_sources WHERE work_id=?', [workId])[0].values[0][0];
    fresh.close();
    return { item: rows.length ? rows[0].values[0] : null, links, bytes: buffer.byteLength };
  }, 'wm-browser-item');
  assert.deepEqual(independentRead.item, ['Durable browser record', 1]);
  assert.equal(independentRead.links, 1);
  assert(independentRead.bytes > 0);

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && window.WmStore, { timeout: 30000 });
  const afterReload = await page.evaluate(() => ({
    item: window.WmStore.getItem('wm-browser-item'),
    projectCount: window._wizDB.exec("SELECT count(*) FROM wm_projects WHERE project_id='wm-browser-project'")[0].values[0][0],
    changeCount: window._wizDB.exec("SELECT count(*) FROM wm_changes WHERE work_id='wm-browser-item'")[0].values[0][0],
  }));
  assert.equal(afterReload.item.title, 'Durable browser record');
  assert.equal(afterReload.item.non_canon, 1);
  assert.equal(afterReload.projectCount, 1);
  assert(afterReload.changeCount >= 2);
  assert.deepEqual(pageErrors, [], 'browser errors: ' + JSON.stringify(pageErrors));
  console.log('PASS  real IndexedDB durable save, independent SQL.js read-back, reload, and WM change-log verification');
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.rmSync(temp, { recursive: true, force: true });
}

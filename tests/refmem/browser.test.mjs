// Headless-browser acceptance tests (real index.html, real IndexedDB, real UI).
// Requires Chrome + puppeteer-core (not vendored; the app has no package.json):
//   PUPPETEER_CORE=/path/to/node_modules/puppeteer-core CHROME_PATH=/usr/bin/google-chrome \
//   [MAIN_ROOT=/path/to/checkout/of/main] node tests/refmem/browser.test.mjs
// Uses only SYNTHETIC fixtures. Serves the repo via python3 -m http.server.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawn } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const pupPath = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteer = (await import(pupPath.startsWith('/') ? pathToFileURL(path.join(pupPath, 'lib/esm/puppeteer/puppeteer-core.js')).href : pupPath)).default;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const FXDIR = path.join(HERE, 'fixtures');
const v1 = fs.readFileSync(path.join(FXDIR, 'synthetic.v1.fixture.jsonl'), 'utf8');

function serve(root, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refmem-srv-'));
  fs.symlinkSync(root, path.join(dir, 'Eiti-Wizard-Lab'));
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  return { url: `http://127.0.0.1:${port}/Eiti-Wizard-Lab/index.html`, stop: () => p.kill() };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
async function T(id, name, fn) {
  try { await fn(); results.push([id, 'PASS', name]); console.log(`PASS  [${id}] ${name}`); }
  catch (e) { results.push([id, 'FAIL', name, e.message]); console.log(`FAIL  [${id}] ${name}\n      ${e.message}`); }
}
async function launch(downloadDir) {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  if (downloadDir) {
    const s = await b.target().createCDPSession();
    await s.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  }
  return b;
}
async function open(browser, url) {
  const page = await browser.newPage();
  await page.setBypassServiceWorker(true);
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => logs.push(m.text()));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window._wizDB && typeof executeAgentTool === 'function' && typeof switchPanel === 'function', { timeout: 30000 });
  return { page, errors, logs };
}
// Independent read-back: NEW IndexedDB connection → stored bytes → fresh sql.js DB → count wiz_ref_items.
const IDB_REF_COUNT = async () => {
  const buf = await new Promise((res, rej) => {
    const q = indexedDB.open('wiz_lab_mem_store', 1);
    q.onerror = () => rej(q.error);
    q.onsuccess = e => { const d = e.target.result; const g = d.transaction('kv', 'readonly').objectStore('kv').get('wiz_lab_sqlite_db');
      g.onsuccess = () => { d.close(); res(g.result); }; g.onerror = () => { d.close(); rej(g.error); }; };
  });
  if (!buf) return -1;
  const SQL = await initSqlJs({ locateFile: f => f });
  const d = new SQL.Database(new Uint8Array(buf));
  let n = 0; try { n = d.exec('SELECT count(*) FROM wiz_ref_items')[0].values[0][0]; } catch (e) { n = 0; }
  d.close(); return n;
};
const srv = serve(ROOT, Number(process.env.REFMEM_PORT || 18791));
const mainSrv = process.env.MAIN_ROOT ? serve(path.resolve(process.env.MAIN_ROOT), Number(process.env.REFMEM_PORT || 18791) + 1) : null;
// readiness poll for the static servers (not a persistence wait)
for (const u of [srv.url, mainSrv && mainSrv.url].filter(Boolean)) {
  let up = false; for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(u)).ok; } catch (e) {} if (!up) await sleep(100); }
  if (!up) throw new Error('static server not reachable: ' + u);
}
const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'refmem-dl-'));
const browser = await launch(dl);
try {
  let P;
  await T(1, 'app boots: no page errors (vs main baseline if MAIN_ROOT given), SQLite ready, ref schema present', async () => {
    P = await open(browser, srv.url);
    const st = await P.page.evaluate(() => ({
      ref: !!window.WizRef, tables: window._wizDB.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.flat(),
      schema: window.WizRef.getMeta(window._wizDB, 'schema_version'),
    }));
    assert(st.ref && st.schema === '2');
    for (const t of ['wiz_facts', 'wiz_l2_digests', 'wiz_ref_items', 'wiz_ref_sources', 'wiz_ref_relations', 'wiz_ref_meta']) assert(st.tables.includes(t), t);
    assert(P.logs.some(l => l.includes('[WizMem] SQLite')), 'SQLite boot log missing');
    if (mainSrv) {
      const b2 = await launch(); const M = await open(b2, mainSrv.url); await b2.close();
      const extra = P.errors.filter(e => !M.errors.includes(e));
      assert.strictEqual(extra.length, 0, 'new page errors vs main: ' + JSON.stringify(extra));
      console.log(`      (page errors: branch ${P.errors.length}, main ${M.errors.length}, new-on-branch 0)`);
    } else assert.strictEqual(P.errors.length, 0, JSON.stringify(P.errors));
  });

  await T(3, 'memory panel (EITI memory list, L3 profile, L2 digests) renders and quick-add works; ref card renders', async () => {
    const r = await P.page.evaluate(async () => {
      switchPanel('memory'); await new Promise(r => setTimeout(r, 600));
      document.getElementById('memAddBlock').style.display = 'flex';
      document.getElementById('memQuickText').value = 'UI test personal fact'; document.getElementById('memQuickTag').value = 'general';
      memQuickAdd(); await new Promise(r => setTimeout(r, 900));
      return { list: document.getElementById('memEntriesList').innerText, l3: !!document.getElementById('memL3List').innerHTML,
        l2: !!document.getElementById('memL2List').innerHTML, eitiN: document.getElementById('mem-stat-eiti-n').textContent,
        card: !!document.getElementById('wizRefCard'), stats: document.getElementById('wizRefStats').textContent,
        active: document.getElementById('panel-memory').classList.contains('active') || getComputedStyle(document.getElementById('panel-memory')).display !== 'none' };
    });
    assert(r.list.includes('UI test personal fact'), 'quick-add not rendered');
    assert(r.l3 && r.l2 && r.card && /schema v2/.test(r.stats) && Number(r.eitiN) >= 1, JSON.stringify(r));
  });

  await T(4, 'agent tools mem_add / mem_search / mem_validate work in the page; ref_* registered alongside', async () => {
    const r = await P.page.evaluate(async () => ({
      add: await executeAgentTool('mem_add', { tag: 'interest', text: 'I enjoy synergy in team sports' }),
      search: await executeAgentTool('mem_search', { query: 'synergy' }),
      val: await executeAgentTool('mem_validate', { text: 'synergy in team' }),
      state: window._wizDB.exec("SELECT epistemic_state FROM wiz_facts WHERE claim LIKE '%team sports%'")[0].values[0][0],
      tools: AGENT_TOOLS_SPEC.map(t => t.name).filter(n => /^(mem|ref)_/.test(n)),
    }));
    assert(/L1/.test(r.add) && /team sports/.test(r.search) && /Validated/.test(r.val) && r.state === 'Validated', JSON.stringify(r));
    assert.deepStrictEqual(r.tools, ['mem_add', 'mem_list', 'mem_delete', 'mem_search', 'mem_validate', 'ref_search', 'ref_source', 'ref_project', 'ref_trace']);
  });

  await T(16, 'ref_search and mem_search (agent tools) return separate datasets; ref output carries provenance', async () => {
    const imp = await P.page.evaluate(async t => { const r = await wizRefImportJSONL(t); return { c: r.committed, p: r.persisted }; }, v1);
    assert(imp.c && imp.p === true, 'import not committed+persisted ' + JSON.stringify(imp));
    const r = await P.page.evaluate(async () => ({
      mem: await executeAgentTool('mem_search', { query: 'synergy' }), ref: await executeAgentTool('ref_search', { query: 'synergy' }),
      src: await executeAgentTool('ref_source', { source_id: 'fx:src:lens-list' }), prj: await executeAgentTool('ref_project', { project_id: 'demo-project-x' }),
      tr: await executeAgentTool('ref_trace', { item_id: 'fx:hyp-2' }),
    }));
    assert(/team sports/.test(r.mem) && !/Lens/.test(r.mem));
    assert(/Lens 'synergy'/.test(r.ref) && !/team sports/.test(r.ref));
    for (const s of ['[REFERENCE MEMORY]', 'HUMAN_LENS', 'HUMAN_REFERENCE_ONLY', 'HUMAN_REFERENCE', 'SOURCE_ASSERTION', 'fx:src:lens-list', 'as_of: 2026-09-25', 'rev=fx-rev-1']) assert(r.ref.includes(s), s);
    assert(/SOURCE \(current record\) fx:src:lens-list/.test(r.src) && /NOT IMPLEMENTATION EVIDENCE/.test(r.prj) && /SUPERSEDES fx:hyp-1/.test(r.tr), JSON.stringify(r).slice(0, 400));
  });

  await T(6, 'reference survives page reload via SQLite → IndexedDB (wiz_lab_mem_store / wiz_lab_sqlite_db) — no sleep: awaited ack + independent read-back, then reload', async () => {
    // import in #16 resolved persisted=true only after tx.oncomplete + read-back; verify again from a NEW connection
    const stored = await P.page.evaluate(IDB_REF_COUNT);
    assert.strictEqual(stored, 14, 'IndexedDB bytes (independent connection) do not contain the reference rows');
    await P.page.reload({ waitUntil: 'load' });
    await P.page.waitForFunction(() => window._wizDB, { timeout: 30000 });
    const n = await P.page.evaluate(() => window._wizDB.exec('SELECT count(*) FROM wiz_ref_items')[0].values[0][0]);
    assert.strictEqual(n, 14);
    const facts = await P.page.evaluate(() => window._wizDB.exec("SELECT count(*) FROM wiz_facts WHERE epistemic_state='Validated'")[0].values[0][0]);
    assert.strictEqual(facts, 1, 'personal facts not persisted alongside');
  });

  await T(15, 'boot-time wizDecayTick (ran on reload) left wiz_ref_* untouched', async () => {
    const r = await P.page.evaluate(() => { const d = window._wizDB; const before = JSON.stringify(d.exec('SELECT * FROM wiz_ref_items ORDER BY 1'));
      wizDecayTick(); wizDecayTick(); return before === JSON.stringify(d.exec('SELECT * FROM wiz_ref_items ORDER BY 1')) &&
      d.exec("SELECT count(*) FROM wiz_ref_items WHERE lifecycle NOT IN ('ACTIVE','SUPERSEDED')")[0].values[0][0] === 0; });
    assert(r);
  });

  await T(17, 'UI import of a local JSONL file → IMPORT_PERSISTED = TRUE only after confirmed IndexedDB write; file deleted; SQLite copy persists after reload (no sleep)', async () => {
    const b = await launch(); const Q = await open(b, srv.url);
    const tmp = path.join(os.tmpdir(), `refmem-ui-${process.pid}.private.jsonl`); fs.writeFileSync(tmp, v1);
    await Q.page.evaluate(() => switchPanel('memory'));
    const input = await Q.page.$('#wizRefFile'); await input.uploadFile(tmp);
    await Q.page.waitForFunction(() => document.getElementById('wizRefResult').dataset.state === 'done', { timeout: 15000 });
    const ui = await Q.page.evaluate(() => ({ p: document.getElementById('wizRefResult').dataset.persisted, t: document.getElementById('wizRefResult').textContent, flag: window.WIZ_REF_IMPORT_PERSISTED }));
    assert(ui.p === 'true' && ui.flag === true && /IMPORT_PERSISTED = TRUE/.test(ui.t) && /can be deleted now/.test(ui.t), JSON.stringify(ui));
    const stored = await Q.page.evaluate(IDB_REF_COUNT); // independent connection, immediately after the ack
    assert.strictEqual(stored, 14);
    fs.unlinkSync(tmp); assert(!fs.existsSync(tmp));
    await Q.page.reload({ waitUntil: 'load' }); await Q.page.waitForFunction(() => window._wizDB, { timeout: 30000 });
    const n = await Q.page.evaluate(() => window._wizDB.exec('SELECT count(*) FROM wiz_ref_items')[0].values[0][0]);
    await b.close(); assert.strictEqual(n, 14);
  });

  await T('P1-3f', 'failure path: IndexedDB write aborted → IMPORT_PERSISTED = FALSE, explicit warning, NO "safe to delete" message; nothing persisted after reload', async () => {
    const b = await launch(); const Q = await open(b, srv.url);
    await Q.page.evaluate(() => { // stub: every IndexedDB put aborts its transaction
      IDBObjectStore.prototype.put = function () { const tx = this.transaction; tx.abort(); return {}; };
      switchPanel('memory');
    });
    const tmp = path.join(os.tmpdir(), `refmem-fail-${process.pid}.private.jsonl`); fs.writeFileSync(tmp, v1);
    const input = await Q.page.$('#wizRefFile'); await input.uploadFile(tmp); fs.unlinkSync(tmp);
    await Q.page.waitForFunction(() => document.getElementById('wizRefResult').dataset.state === 'done', { timeout: 15000 });
    const ui = await Q.page.evaluate(() => ({ p: document.getElementById('wizRefResult').dataset.persisted, t: document.getElementById('wizRefResult').textContent, flag: window.WIZ_REF_IMPORT_PERSISTED }));
    assert(ui.p === 'false' && ui.flag === false && /IMPORT_PERSISTED = FALSE/.test(ui.t) && /KEEP your local file/.test(ui.t) && !/can be deleted/.test(ui.t), JSON.stringify(ui));
    await Q.page.reload({ waitUntil: 'load' }); await Q.page.waitForFunction(() => window._wizDB, { timeout: 30000 });
    const n = await Q.page.evaluate(() => window._wizDB.exec('SELECT count(*) FROM wiz_ref_items')[0].values[0][0]);
    await b.close(); assert.strictEqual(n, 0, 'aborted write must not have persisted');
  });

  await T(18, 'UI "Export backup" → import into a fresh browser profile: identical items/statuses, nothing promoted', async () => {
    await P.page.evaluate(() => switchPanel('memory'));
    const before = fs.readdirSync(dl);
    await P.page.evaluate(() => wizRefUiExport());
    let file = null; for (let i = 0; i < 40 && !file; i++) { await sleep(250); file = fs.readdirSync(dl).find(f => !before.includes(f) && f.endsWith('.jsonl')); }
    assert(file, 'no download'); assert(/\.private\.jsonl$/.test(file), 'backup must be gitignored-named');
    const text = fs.readFileSync(path.join(dl, file), 'utf8'); fs.unlinkSync(path.join(dl, file));
    const q = "SELECT item_id,source_status,epistemic_state,lifecycle,superseded_by,claim FROM wiz_ref_items ORDER BY 1";
    const a = await P.page.evaluate(q => JSON.stringify(window._wizDB.exec(q)), q);
    const b = await launch(); const Q = await open(b, srv.url);
    const r = await Q.page.evaluate(async (t, q) => { const res = await wizRefImportJSONL(t); return { ok: res.ok, rows: JSON.stringify(window._wizDB.exec(q)) }; }, text, q);
    await b.close();
    assert(r.ok); assert.strictEqual(r.rows, a);
  });
} finally {
  await browser.close(); srv.stop(); if (mainSrv) mainSrv.stop();
}
const fail = results.filter(r => r[1] !== 'PASS');
console.log(`\n${results.length - fail.length}/${results.length} passed`);
fs.writeFileSync(path.join(os.tmpdir(), 'refmem-browser-results.json'), JSON.stringify(results, null, 1));
process.exit(fail.length ? 1 : 0);

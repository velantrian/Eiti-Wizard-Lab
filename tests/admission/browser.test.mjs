// Headless-browser tests for the Memory Admission Controller v0.1 (REVIEW mode, step 1 of 2):
// real index.html, real IndexedDB, real UI. Requires Chrome + puppeteer-core (not vendored):
//   PUPPETEER_CORE=/path/to/node_modules/puppeteer-core CHROME_PATH=/usr/bin/google-chrome \
//   [MAIN_ROOT=/path/to/checkout/of/main] [ADM_PORT=18801] node tests/admission/browser.test.mjs
// SYNTHETIC fixtures only. Serves the repo via python3 -m http.server.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawn } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const pupPath = process.env.PUPPETEER_CORE || 'puppeteer-core';
const puppeteer = (await import(pupPath.startsWith('/') ? pathToFileURL(path.join(pupPath, 'lib/esm/puppeteer/puppeteer-core.js')).href : pupPath)).default;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const BASE = fs.readFileSync(path.join(HERE, 'fixtures', 'synthetic.reference-base.fixture.jsonl'), 'utf8');
const INC = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'synthetic.incoming.fixture.json'), 'utf8'));

function serve(root, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adm-srv-'));
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
async function launch() { return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] }); }
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
// in-page: independent dump of all wiz_ref* objects + personal tables
const DUMPS = () => {
  const rows = sql => { const r = window._wizDB.exec(sql); return r.length ? r[0].values : []; };
  const schema = rows("SELECT type,name,sql FROM sqlite_master WHERE substr(name,1,7)='wiz_ref' OR substr(tbl_name,1,7)='wiz_ref' ORDER BY type,name");
  const enc = v => (v instanceof Uint8Array ? Array.from(v).join(',') : v);
  const ref = JSON.stringify({ schema, data: schema.filter(s => s[0] === 'table').map(([, n]) => [n, rows(`SELECT * FROM "${n}"`).map(r => JSON.stringify(r.map(enc))).sort()]) });
  const pers = ['wiz_facts', 'wiz_facts_fts', 'wiz_l2_digests'].map(t => JSON.stringify(rows(`SELECT * FROM ${t}`))).join('|');
  return { ref, pers };
};
// in-page: NEW IndexedDB connection → stored SQLite bytes → fresh sql.js DB → counts
const IDB_COUNTS = async () => {
  const buf = await new Promise((res, rej) => {
    const q = indexedDB.open('wiz_lab_mem_store', 1);
    q.onerror = () => rej(q.error);
    q.onsuccess = e => { const d = e.target.result; const g = d.transaction('kv', 'readonly').objectStore('kv').get('wiz_lab_sqlite_db');
      g.onsuccess = () => { d.close(); res(g.result); }; g.onerror = () => { d.close(); rej(g.error); }; };
  });
  const SQL = await initSqlJs({ locateFile: f => f });
  const d = new SQL.Database(new Uint8Array(buf));
  const c = sql => { try { return d.exec(sql)[0].values[0][0]; } catch (e) { return -1; } };
  const out = { reviews: c('SELECT count(*) FROM wiz_admission_reviews'), pending: c("SELECT count(*) FROM wiz_admission_reviews WHERE review_state='AWAITING_REVIEW'"), ref_items: c('SELECT count(*) FROM wiz_ref_items'), ref_rel: c('SELECT count(*) FROM wiz_ref_relations') };
  d.close(); return out;
};

// real user activation of the Prepare button: focus + CDP key press (Chrome synthesises a TRUSTED click)
async function userActivatePrepare(page) {
  await page.evaluate(() => { document.getElementById('wizAdmResult').dataset.state = 'idle'; });
  await page.focus('#wizAdmPrepareBtn');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('wizAdmResult').dataset.state === 'done', { timeout: 15000 });
}
const PORT = Number(process.env.ADM_PORT || 18801);
const srv = serve(ROOT, PORT);
const mainSrv = process.env.MAIN_ROOT ? serve(path.resolve(process.env.MAIN_ROOT), PORT + 1) : null;
for (const u of [srv.url, mainSrv && mainSrv.url].filter(Boolean)) { // readiness poll for the static servers
  let up = false; for (let i = 0; i < 100 && !up; i++) { try { up = (await fetch(u)).ok; } catch (e) {} if (!up) await sleep(100); }
  if (!up) throw new Error('static server not reachable: ' + u);
}
const browser = await launch();
try {
  let P, seeded, reviewId;
  await T('B1', 'app boots with the admission module: no new page errors vs main, staging table present, REVIEW-only API, no apply/dismiss', async () => {
    P = await open(browser, srv.url);
    const st = await P.page.evaluate(() => ({
      adm: !!window.WizAdmission, mode: window.WizAdmission.ADMISSION_MODE, outcomes: [...window.WizAdmission.OUTCOMES],
      apply: typeof window.WizAdmission.apply, dismiss: typeof window.WizAdmission.dismiss,
      tables: window._wizDB.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.flat(),
      pending: window.wizAdmissionListPending().length,
    }));
    assert(st.adm && st.mode === 'REVIEW' && st.outcomes.length === 8 && st.apply === 'undefined' && st.dismiss === 'undefined', JSON.stringify(st));
    for (const t of ['wiz_facts', 'wiz_ref_items', 'wiz_admission_reviews']) assert(st.tables.includes(t), t);
    assert.strictEqual(st.pending, 0);
    if (mainSrv) {
      const b2 = await launch(); const M = await open(b2, mainSrv.url); await b2.close();
      const extra = P.errors.filter(e => !M.errors.includes(e));
      assert.strictEqual(extra.length, 0, 'new page errors vs main: ' + JSON.stringify(extra));
      console.log(`      (page errors: branch ${P.errors.length}, main ${M.errors.length}, new-on-branch 0)`);
    } else assert.strictEqual(P.errors.length, 0, JSON.stringify(P.errors));
  });

  await T('B2', 'UI "Prepare review" (ambiguous synthetic passport) → packet shown with UNCERTAIN + AWAITING_REVIEW + write plan; review persisted via verified save; wiz_ref_* and personal memory byte-identical; no ref item created (independent IndexedDB read-back)', async () => {
    seeded = await P.page.evaluate(async (base) => {
      const r = await wizRefImportJSONL(base); // explicit test setup through the existing Reference Memory import
      await executeAgentTool('mem_add', { tag: 'general', text: 'personal fact: I like synthetic tea' });
      return { committed: r.committed, persisted: r.persisted, items: window._wizDB.exec('SELECT count(*) FROM wiz_ref_items')[0].values[0][0] };
    }, BASE);
    assert(seeded.committed && seeded.persisted, JSON.stringify(seeded));
    const before = await P.page.evaluate(DUMPS);
    await P.page.evaluate(() => { switchPanel('memory'); });
    await P.page.waitForSelector('#wizAdmCard #wizAdmIncoming', { visible: true, timeout: 10000 });
    await P.page.evaluate(t => { document.getElementById('wizAdmIncoming').value = t; document.getElementById('wizAdmScope').value = 'demo-project-adm'; }, JSON.stringify(INC.ambiguous));
    // GENUINE user activation (CDP keyboard → trusted click event on the real button → trusted USER caller context)
    await userActivatePrepare(P.page);
    const ui = await P.page.evaluate(() => { const o = document.getElementById('wizAdmResult'); return { t: o.textContent, outcome: o.dataset.outcome, persisted: o.dataset.persisted, id: o.dataset.reviewId, caller: o.dataset.caller, pending: document.getElementById('wizAdmPending').dataset.count }; });
    assert.strictEqual(ui.caller, 'USER', 'real user activation must yield the trusted USER caller context');
    assert(ui.t.includes('CALLER CONTEXT: USER (trusted, via ui-click:#wizAdmPrepareBtn)') && ui.t.includes('REFERENCE MEMORY: READY · read-only'), ui.t.slice(0, 600));
    assert.strictEqual(ui.outcome, 'UNCERTAIN', ui.t.slice(0, 400));
    assert.strictEqual(ui.persisted, 'true', ui.t.slice(-300));
    for (const s of ['mode=REVIEW', 'state=AWAITING_REVIEW', 'PROPOSED OUTCOME: UNCERTAIN', 'REASON:', 'PROVENANCE:', 'CANDIDATES (', 'AFFECTED RECORDS:', 'WRITE PLAN (not executed):', '"executes": false', 'WARNINGS:', 'REVIEW_PERSISTED = TRUE']) assert(ui.t.includes(s), 'missing in UI: ' + s);
    assert.strictEqual(ui.pending, '1');
    reviewId = ui.id;
    const after = await P.page.evaluate(DUMPS);
    assert.strictEqual(after.ref, before.ref, 'wiz_ref_* changed by prepare');
    assert.strictEqual(after.pers, before.pers, 'personal memory changed by prepare');
    const idb = await P.page.evaluate(IDB_COUNTS);
    assert.deepStrictEqual(idb, { reviews: 1, pending: 1, ref_items: seeded.items, ref_rel: 1 });
  });

  await T('B3', 'reload → pending review still present (same id, AWAITING_REVIEW), no ref item created; Reference memory UI + ref_search and personal memory (mem_add/mem_search) still work; staged review invisible to ref_search/mem_search', async () => {
    await P.page.reload({ waitUntil: 'load' });
    await P.page.waitForFunction(() => window._wizDB && typeof executeAgentTool === 'function', { timeout: 30000 });
    const r = await P.page.evaluate(async (id) => {
      switchPanel('memory'); await new Promise(res => setTimeout(res, 800));
      const pend = window.wizAdmissionListPending();
      return {
        ids: pend.map(p => p.review_id), state: (window.wizAdmissionGetReview(id) || {}).review_state,
        items: window._wizDB.exec('SELECT count(*) FROM wiz_ref_items')[0].values[0][0],
        pendingUi: document.getElementById('wizAdmPending').dataset.count,
        refStats: document.getElementById('wizRefStats').textContent,
        refSearch: await executeAgentTool('ref_search', { query: 'cache layer' }),
        refLeak: await executeAgentTool('ref_search', { query: 'changes start latency' }),
        memAdd: await executeAgentTool('mem_add', { tag: 'general', text: 'after reload personal note' }),
        memSearch: await executeAgentTool('mem_search', { query: 'synthetic tea' }),
        memLeak: await executeAgentTool('mem_search', { query: 'changes start latency' }),
      };
    }, reviewId);
    assert.deepStrictEqual(r.ids, [reviewId]); assert.strictEqual(r.state, 'AWAITING_REVIEW');
    assert.strictEqual(r.items, seeded.items); assert.strictEqual(r.pendingUi, '1');
    assert(/items: 4/.test(r.refStats) && /cache layer/.test(r.refSearch), r.refStats);
    // the tools echo the query in their 'no results' text, so check for the staged CLAIM itself
    assert(!r.refLeak.includes(INC.ambiguous.WHAT) && !r.refLeak.includes('changes start latency of the demo widget'), 'staged incoming leaked into ref_search');
    assert(/L1/.test(r.memAdd) && /synthetic tea/.test(r.memSearch), JSON.stringify(r).slice(0, 300));
    assert(!r.memLeak.includes(INC.ambiguous.WHAT) && !r.memLeak.includes('changes start latency of the demo widget'), 'staged incoming leaked into mem_search');
    assert.strictEqual(P.errors.length, 0, JSON.stringify(P.errors));
  });

  await T('B4', 'invalid passport via UI → rejected, nothing staged; card has no Apply / Dismiss / Auto-approve controls', async () => {
    const r = await P.page.evaluate(async () => {
      const n0 = window.wizAdmissionListPending().length;
      document.getElementById('wizAdmIncoming').value = JSON.stringify({ WHAT: 'claim without passport' });
      document.getElementById('wizAdmScope').value = '';
      await wizAdmUiPrepare();
      const card = document.getElementById('wizAdmCard');
      return { t: document.getElementById('wizAdmResult').textContent, n0, n1: window.wizAdmissionListPending().length,
        buttons: [...card.querySelectorAll('button')].map(b => b.textContent.trim()) };
    });
    assert(/passport rejected — nothing staged/.test(r.t) && /PROVENANCE/.test(r.t), r.t);
    assert.strictEqual(r.n1, r.n0);
    assert.deepStrictEqual(r.buttons, ['↻', 'Example', 'Prepare review']);
  });

  await T('B5', 'P1-3 in the page: script-invoked / forged-event / script-dispatched-click / wrapper-with-caller paths are UNTRUSTED → EQUIVALENT_TO declared_by=USER is NOT DUPLICATE; only a genuine user activation of the button gives USER context → DUPLICATE; hostCallerContext absent in the browser; wiz_ref_* unchanged', async () => {
    const before = await P.page.evaluate(DUMPS);
    const vid = await P.page.evaluate(() => window._wizDB.exec("SELECT version_id FROM wiz_ref_items WHERE item_id='fx:adm:cache-cold'")[0].values[0][0]);
    const inc = Object.assign(JSON.parse(JSON.stringify(INC.similar_not_identical)), { EQUIVALENT_TO: { version_id: vid, declared_by: 'USER', basis: 'same observation, reworded' } });
    const r = await P.page.evaluate(async (incTxt) => {
      const out = document.getElementById('wizAdmResult'), btn = document.getElementById('wizAdmPrepareBtn');
      document.getElementById('wizAdmIncoming').value = incTxt; document.getElementById('wizAdmScope').value = '';
      const res = {};
      const grab = () => ({ outcome: out.dataset.outcome, caller: out.dataset.caller });
      await wizAdmUiPrepare(); res.scriptCall = grab();
      await wizAdmUiPrepare({ isTrusted: true, type: 'click', target: btn, currentTarget: btn }); res.forgedObject = grab();
      const fake = Object.create(MouseEvent.prototype, { isTrusted: { value: true }, type: { value: 'click' }, target: { value: btn } }); // prototype-forged look-alike (isTrusted on a real event is unforgeable)
      await wizAdmUiPrepare(fake); res.shadowedEvent = grab();
      out.dataset.state = 'idle'; btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 100 && out.dataset.state !== 'done'; i++) await new Promise(r => setTimeout(r, 50));
      res.dispatched = grab();
      const w = await window.wizAdmissionPrepare(JSON.parse(incTxt), { caller: { kind: 'USER' } }); res.wrapper = { outcome: w.packet.proposed_outcome, caller: w.packet.caller.kind };
      res.hostCtx = typeof window.WizAdmission.hostCallerContext;
      return res;
    }, JSON.stringify(inc));
    for (const k of ['scriptCall', 'forgedObject', 'shadowedEvent', 'dispatched', 'wrapper']) {
      assert.strictEqual(r[k].outcome, 'UNCERTAIN', k + ' ' + JSON.stringify(r[k]));
      assert.strictEqual(r[k].caller, 'UNTRUSTED', k + ' ' + JSON.stringify(r[k]));
    }
    assert.strictEqual(r.hostCtx, 'undefined');
    await userActivatePrepare(P.page); // genuine activation, same passport still in the textarea
    const real = await P.page.evaluate(() => { const o = document.getElementById('wizAdmResult'); return { outcome: o.dataset.outcome, caller: o.dataset.caller, t: o.textContent }; });
    assert.strictEqual(real.caller, 'USER'); assert.strictEqual(real.outcome, 'DUPLICATE', real.t.slice(0, 500));
    const after = await P.page.evaluate(DUMPS);
    assert.strictEqual(after.ref, before.ref, 'wiz_ref_* changed'); assert.strictEqual(after.pers, before.pers, 'personal memory changed');
    assert.strictEqual(P.errors.length, 0, JSON.stringify(P.errors));
  });
} finally {
  await browser.close(); srv.stop(); if (mainSrv) mainSrv.stop();
}
const fail = results.filter(r => r[1] !== 'PASS');
console.log(`\n${results.length - fail.length}/${results.length} passed`);
process.exit(fail.length ? 1 : 0);

// Headless-browser tests for the Memory Admission Controller v0.1 (REVIEW mode; step 1 Prepare + step 2 Apply/Dismiss):
// real index.html, real IndexedDB, real UI, genuine (CDP) user activation for Prepare / Apply / Dismiss. Requires Chrome + puppeteer-core (not vendored):
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
// real user activation of Apply / Dismiss (same CDP mechanism); waits for the action result
async function userActivate(page, sel) {
  await page.evaluate(() => { document.getElementById('wizAdmActionResult').dataset.state = 'idle'; });
  await page.focus(sel);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('wizAdmActionResult').dataset.state === 'done', { timeout: 20000 });
  return page.evaluate(() => { const o = document.getElementById('wizAdmActionResult'); return Object.assign({ t: o.textContent }, o.dataset); });
}
const reloadPage = async (P) => {
  await P.page.reload({ waitUntil: 'load' });
  await P.page.waitForFunction(() => window._wizDB && typeof executeAgentTool === 'function' && window.WizAdmission, { timeout: 30000 });
  await P.page.evaluate(async () => { switchPanel('memory'); await new Promise(r => setTimeout(r, 600)); });
};
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
  await T('B1', 'app boots with the admission module: no new page errors vs main, staging table present, REVIEW-only API; apply/dismiss exist but only as explicit human-gated actions (no auto-admit)', async () => {
    P = await open(browser, srv.url);
    const st = await P.page.evaluate(() => ({
      adm: !!window.WizAdmission, mode: window.WizAdmission.ADMISSION_MODE, outcomes: [...window.WizAdmission.OUTCOMES],
      apply: typeof window.WizAdmission.apply, dismiss: typeof window.WizAdmission.dismiss, applyP: typeof window.WizAdmission.applyPersisted,
      auto: ['autoAdmit', 'autoApply', 'applyAll', 'approve', 'commit'].filter(k => k in window.WizAdmission),
      tables: window._wizDB.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0].values.flat(),
      pending: window.wizAdmissionListPending().length,
    }));
    assert(st.adm && st.mode === 'REVIEW' && st.outcomes.length === 8 && st.apply === 'function' && st.dismiss === 'function' && st.applyP === 'function' && st.auto.length === 0, JSON.stringify(st));
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
    // GENUINE user activation (CDP keyboard → trusted click on the real button) → USER_INTERACTION only, NOT authority (P1-3b)
    await userActivatePrepare(P.page);
    const ui = await P.page.evaluate(() => { const o = document.getElementById('wizAdmResult'); return { t: o.textContent, outcome: o.dataset.outcome, persisted: o.dataset.persisted, id: o.dataset.reviewId, caller: o.dataset.caller, interaction: o.dataset.interaction, pending: document.getElementById('wizAdmPending').dataset.count }; });
    assert.strictEqual(ui.interaction, 'USER_INTERACTION', 'real user activation is recorded as interaction');
    assert.strictEqual(ui.caller, 'UNTRUSTED', 'a click is never semantic authority');
    assert(ui.t.includes('CALLER CONTEXT: USER_INTERACTION (review initiated by user click; NOT semantic authority) · semantic authority: NONE') && ui.t.includes('REFERENCE MEMORY: READY · read-only'), ui.t.slice(0, 700));
    assert.strictEqual(ui.outcome, 'UNCERTAIN', ui.t.slice(0, 400));
    assert.strictEqual(ui.persisted, 'true', ui.t.slice(-300));
    for (const s of ['mode=REVIEW', 'state at prepare=AWAITING_REVIEW', 'PROPOSED OUTCOME: UNCERTAIN', 'REASON:', 'PROVENANCE:', 'CANDIDATES (', 'AFFECTED RECORDS:', 'WRITE PLAN (executed only by an explicit Apply, exactly as shown):', '"executes": false', 'WARNINGS:', 'REVIEW_PERSISTED = TRUE']) assert(ui.t.includes(s), 'missing in UI: ' + s);
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

  await T('B4', 'invalid passport via UI → rejected, nothing staged; card has exactly Prepare + Apply shown plan + Dismiss controls (no Auto-approve / Apply-all)', async () => {
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
    assert.deepStrictEqual(r.buttons, ['↻', 'Example', 'Prepare review', 'Apply shown plan', 'Dismiss']);
  });

  await T('B5', 'P1-3/P1-3b in the page: script-invoked / forged-event / script-dispatched-click / wrapper-with-caller paths get no interaction and no authority; a GENUINE Prepare activation records USER_INTERACTION but is NOT semantic authority → EQUIVALENT_TO declared_by=USER, STATUS USER_DECISION and PROPOSED_STATUS_CHANGE.authority=USER all stay UNCERTAIN; hostCallerContext absent in the browser; wiz_ref_* and personal memory unchanged', async () => {
    const before = await P.page.evaluate(DUMPS);
    const ids = await P.page.evaluate(() => { const v = id => window._wizDB.exec(`SELECT version_id FROM wiz_ref_items WHERE item_id='${id}'`)[0].values[0][0]; return { cold: v('fx:adm:cache-cold'), q: v('fx:adm:index-q') }; });
    const eqInc = Object.assign(JSON.parse(JSON.stringify(INC.similar_not_identical)), { EQUIVALENT_TO: { version_id: ids.cold, declared_by: 'USER', basis: 'same observation, reworded' } });
    const r = await P.page.evaluate(async (incTxt) => {
      const out = document.getElementById('wizAdmResult'), btn = document.getElementById('wizAdmPrepareBtn');
      document.getElementById('wizAdmIncoming').value = incTxt; document.getElementById('wizAdmScope').value = '';
      const res = {};
      const grab = () => ({ outcome: out.dataset.outcome, caller: out.dataset.caller, interaction: out.dataset.interaction });
      await wizAdmUiPrepare(); res.scriptCall = grab();
      await wizAdmUiPrepare({ isTrusted: true, type: 'click', target: btn, currentTarget: btn }); res.forgedObject = grab();
      const fake = Object.create(MouseEvent.prototype, { isTrusted: { value: true }, type: { value: 'click' }, target: { value: btn } }); // prototype-forged look-alike (isTrusted on a real event is unforgeable)
      await wizAdmUiPrepare(fake); res.shadowedEvent = grab();
      out.dataset.state = 'idle'; btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 100 && out.dataset.state !== 'done'; i++) await new Promise(r => setTimeout(r, 50));
      res.dispatched = grab();
      const w = await window.wizAdmissionPrepare(JSON.parse(incTxt), { caller: { kind: 'USER' }, interaction: { interaction: 'USER_INTERACTION' } });
      res.wrapper = { outcome: w.packet.proposed_outcome, caller: w.packet.caller.kind, interaction: w.packet.caller.interaction };
      res.hostCtx = typeof window.WizAdmission.hostCallerContext; res.hostIx = typeof window.WizAdmission.hostInteractionContext;
      return res;
    }, JSON.stringify(eqInc));
    for (const k of ['scriptCall', 'forgedObject', 'shadowedEvent', 'dispatched', 'wrapper']) {
      assert.strictEqual(r[k].outcome, 'UNCERTAIN', k + ' ' + JSON.stringify(r[k]));
      assert.strictEqual(r[k].caller, 'UNTRUSTED', k + ' ' + JSON.stringify(r[k]));
      assert.strictEqual(r[k].interaction, 'NONE', k + ' ' + JSON.stringify(r[k]));
    }
    assert.strictEqual(r.hostCtx, 'undefined'); assert.strictEqual(r.hostIx, 'undefined');
    // GENUINE activations: USER_INTERACTION recorded, semantic authority NONE, every authority claim stays UNCERTAIN
    const genuine = async (inc) => {
      await P.page.evaluate(t => { document.getElementById('wizAdmIncoming').value = t; }, JSON.stringify(inc));
      await userActivatePrepare(P.page);
      return P.page.evaluate(async () => { const o = document.getElementById('wizAdmResult'); const g = window.wizAdmissionGetReview(o.dataset.reviewId);
        return { outcome: o.dataset.outcome, caller: o.dataset.caller, interaction: o.dataset.interaction, t: o.textContent, pc: g.packet.caller, hard: g.packet.hard_rules_triggered, warnings: g.packet.warnings }; });
    };
    const checkGenuine = (x, label) => {
      assert.strictEqual(x.interaction, 'USER_INTERACTION', label); assert.strictEqual(x.caller, 'UNTRUSTED', label);
      assert.strictEqual(x.pc.interaction, 'USER_INTERACTION', label); assert.strictEqual(x.pc.trusted, false, label); assert.strictEqual(x.pc.kind, 'UNTRUSTED', label);
      assert.notStrictEqual(x.outcome, 'DUPLICATE', label); assert.strictEqual(x.outcome, 'UNCERTAIN', label + ' ' + x.t.slice(0, 400));
      assert(x.t.includes('USER_INTERACTION (review initiated by user click; NOT semantic authority)'), label);
    };
    const g1 = await genuine(eqInc); checkGenuine(g1, 'genuine + EQUIVALENT_TO declared_by=USER');
    assert(g1.hard.includes('LLM OUTPUT ≠ MEMORY DECISION'));
    const g2 = await genuine(Object.assign(JSON.parse(JSON.stringify(INC.valid_new)), { STATUS: 'USER_DECISION' })); checkGenuine(g2, 'genuine + STATUS USER_DECISION');
    assert(g2.hard.includes('LLM OUTPUT ≠ MEMORY DECISION'));
    const g3 = await genuine(Object.assign(JSON.parse(JSON.stringify(INC.valid_new)), { PROPOSED_STATUS_CHANGE: { target_version_id: ids.q, from_status: 'UNKNOWN', to_status: 'ANSWERED_BY_SOURCE', authority: 'USER', evidence: 'synthetic evidence', rationale: 'synthetic rationale' } }));
    checkGenuine(g3, 'genuine + PROPOSED_STATUS_CHANGE.authority=USER');
    assert(g3.warnings.some(w => /AUTHORITY_NOT_PROVEN/.test(w)), JSON.stringify(g3.warnings));
    const after = await P.page.evaluate(DUMPS);
    assert.strictEqual(after.ref, before.ref, 'wiz_ref_* changed'); assert.strictEqual(after.pers, before.pers, 'personal memory changed');
    assert.strictEqual(P.errors.length, 0, JSON.stringify(P.errors));
  });
  // ─────────────── Step 2: Apply / Dismiss in the real page ───────────────
  const SRC_A = { source_id: 'fx:adm:src-a' };
  const relInc = (what, target) => Object.assign(JSON.parse(JSON.stringify(INC.valid_new)), { SOURCE: SRC_A, WHAT: what, RELATIONS: [{ relation_type: 'RELATED_TO', target_version_id: target }] });
  const verOf = id => P.page.evaluate(i => window._wizDB.exec(`SELECT version_id FROM wiz_ref_items WHERE item_id='${i}'`)[0].values[0][0], id);
  const prepareGenuine = async (inc) => {
    await P.page.evaluate(t => { document.getElementById('wizAdmIncoming').value = t; document.getElementById('wizAdmScope').value = ''; }, JSON.stringify(inc));
    await userActivatePrepare(P.page);
    return P.page.evaluate(() => { const o = document.getElementById('wizAdmResult'); return { id: o.dataset.reviewId, outcome: o.dataset.outcome, sha: o.dataset.packetSha, persisted: o.dataset.persisted }; });
  };
  const refItemsWith = st => P.page.evaluate(s => window._wizDB.exec(`SELECT count(*) FROM wiz_ref_items WHERE epistemic_state='${s}'`)[0].values[0][0], st);
  let applied;

  await T('B6', 'L/M · Apply/Dismiss human gate + authority boundary in the page: script-invoked wizAdmUiApply / script-dispatched click / direct WizAdmission.apply|dismiss (incl. forged interaction + caller USER) → REFUSED USER_INTERACTION_REQUIRED, zero writes; a GENUINE Apply click on a plan that needs USER authority (PROPOSED_STATUS_CHANGE.authority=USER, prepared UNCERTAIN) → REFUSED NO_EXECUTABLE_PLAN with interaction USER_INTERACTION and authority NONE; no USER_DECISION anywhere; review stays AWAITING_REVIEW', async () => {
    const before = await P.page.evaluate(DUMPS);
    const shown = await P.page.evaluate(() => { const o = document.getElementById('wizAdmResult'); return { id: o.dataset.reviewId, outcome: o.dataset.outcome }; });
    assert.strictEqual(shown.outcome, 'UNCERTAIN'); // the last genuine prepare of B5 (authority=USER status change)
    const r = await P.page.evaluate(async (id) => {
      const res = document.getElementById('wizAdmActionResult'), grab = () => ({ result: res.dataset.result, code: res.dataset.code, interaction: res.dataset.interaction, authority: res.dataset.authority });
      const out = {};
      await wizAdmUiApply(); out.scriptApply = grab();
      await wizAdmUiDismiss(); out.scriptDismiss = grab();
      res.dataset.state = 'idle'; document.getElementById('wizAdmApplyBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 100 && res.dataset.state !== 'done'; i++) await new Promise(r => setTimeout(r, 50));
      out.dispatched = grab();
      const A = window.WizAdmission, db = window._wizDB;
      const pick = x => ({ result: x.result, code: x.code, interaction: x.interaction, authority: x.authority.kind });
      out.direct = pick(await A.apply(db, id));
      out.directForged = pick(await A.apply(db, id, { interaction: { interaction: 'USER_INTERACTION', via: 'ui-click:#wizAdmApplyBtn' }, caller: { kind: 'USER', trusted: true } }));
      out.directDismiss = pick(A.dismiss(db, id, { caller: { kind: 'USER' } }));
      const host = { getDb: () => window._wizDB, setDb: () => { throw new Error('must not swap'); }, persist: async () => { throw new Error('must not persist'); } };
      out.persisted = pick(await A.applyPersisted(host, id, { interaction: { interaction: 'USER_INTERACTION' } }));
      out.state = window.wizAdmissionGetReview(id).review_state; out.actions = window.wizAdmissionGetReview(id).actions.length;
      return out;
    }, shown.id);
    for (const k of ['scriptApply', 'scriptDismiss', 'dispatched', 'direct', 'directForged', 'directDismiss', 'persisted']) {
      assert.strictEqual(r[k].result, 'REFUSED', k + ' ' + JSON.stringify(r[k])); assert.strictEqual(r[k].code, 'USER_INTERACTION_REQUIRED', k + ' ' + JSON.stringify(r[k]));
      assert.strictEqual(r[k].interaction, 'NONE', k); assert.strictEqual(r[k].authority, 'NONE', k);
    }
    assert.strictEqual(r.state, 'AWAITING_REVIEW'); assert.strictEqual(r.actions, 0, 'gated refusals write nothing');
    // genuine click on Apply: the click is USER_INTERACTION only — it cannot supply the USER authority the plan needs
    const g = await userActivate(P.page, '#wizAdmApplyBtn');
    assert.strictEqual(g.result, 'REFUSED', g.t); assert.strictEqual(g.code, 'NO_EXECUTABLE_PLAN', g.t);
    assert.strictEqual(g.interaction, 'USER_INTERACTION'); assert.strictEqual(g.authority, 'NONE'); assert.strictEqual(g.reviewState, 'AWAITING_REVIEW');
    assert(g.t.includes('USER_INTERACTION (click) — executes the shown plan only; NOT authority, NOT USER_DECISION, NOT VERIFIED'), g.t);
    const after = await P.page.evaluate(DUMPS);
    assert.strictEqual(after.ref, before.ref, 'wiz_ref_* changed'); assert.strictEqual(after.pers, before.pers);
    assert.strictEqual(await refItemsWith('USER_DECISION'), 0);
    assert.strictEqual(await P.page.evaluate(id => window.wizAdmissionGetReview(id).review_state, shown.id), 'AWAITING_REVIEW');
  });

  await T('B7', 'A/J/M · genuine Prepare (NEW_RELATED_ITEM) → genuine "Apply shown plan" → APPLIED + persisted, exactly +1 ref item (SOURCE_ASSERTION, seed wiz-admission) and +1 pinned relation, interaction USER_INTERACTION / authority NONE; second Apply → REFUSED ALREADY_TERMINAL, no extra write; reload → review APPLIED with its action record, packet unchanged, result independently readable via ref_search + ref_trace + a fresh IndexedDB read', async () => {
    const warm = await verOf('fx:adm:cache-warm');
    const WHAT = '[SYNTHETIC FIXTURE] The demo exporter writes one manifest per synthetic export run.';
    const p = await prepareGenuine(relInc(WHAT, warm));
    assert.strictEqual(p.outcome, 'NEW_RELATED_ITEM'); assert.strictEqual(p.persisted, 'true'); assert(/^sha256:[0-9a-f]{64}$/.test(p.sha), p.sha);
    const pkt0 = await P.page.evaluate(id => JSON.stringify(window.wizAdmissionGetReview(id).packet), p.id);
    const n0 = await P.page.evaluate(IDB_COUNTS), pers0 = (await P.page.evaluate(DUMPS)).pers;
    const a = await userActivate(P.page, '#wizAdmApplyBtn');
    assert.strictEqual(a.result, 'APPLIED', a.t); assert.strictEqual(a.code, 'IMPORTED_EXACT_PLAN'); assert.strictEqual(a.reviewState, 'APPLIED');
    assert.strictEqual(a.persisted, 'true'); assert.strictEqual(a.interaction, 'USER_INTERACTION'); assert.strictEqual(a.authority, 'NONE');
    const n1 = await P.page.evaluate(IDB_COUNTS);
    assert.deepStrictEqual(n1, { reviews: n0.reviews, pending: n0.pending - 1, ref_items: n0.ref_items + 1, ref_rel: n0.ref_rel + 1 });
    applied = await P.page.evaluate(id => { const g = window.wizAdmissionGetReview(id); return { id, newId: g.packet.write_plan.proposed_new_logical_item_id, act: g.last_action }; }, p.id);
    assert.strictEqual(applied.act.result, 'APPLIED');
    const row = await P.page.evaluate(i => window._wizDB.exec(`SELECT epistemic_state, seed_id, claim FROM wiz_ref_items WHERE item_id='${i}'`)[0].values[0], applied.newId);
    assert.deepStrictEqual(row, ['SOURCE_ASSERTION', 'wiz-admission', WHAT]);
    assert.strictEqual((await P.page.evaluate(DUMPS)).pers, pers0, 'personal memory changed');
    const dup = await userActivate(P.page, '#wizAdmApplyBtn');
    assert.strictEqual(dup.result, 'REFUSED'); assert.strictEqual(dup.code, 'ALREADY_TERMINAL'); assert.strictEqual(dup.reviewState, 'APPLIED');
    assert.deepStrictEqual(await P.page.evaluate(IDB_COUNTS), n1, 'double apply wrote something');
    await reloadPage(P);
    const r = await P.page.evaluate(async (x) => {
      const g = window.wizAdmissionGetReview(x.id);
      return { state: g.review_state, reviewed: !!g.reviewed_at, acts: g.actions.map(a => [a.action, a.result]), pkt: JSON.stringify(g.packet),
        search: await executeAgentTool('ref_search', { query: 'manifest per synthetic export run' }),
        trace: await executeAgentTool('ref_trace', { item_id: x.newId }), idb: null };
    }, applied);
    r.idb = await P.page.evaluate(IDB_COUNTS);
    assert.strictEqual(r.state, 'APPLIED'); assert(r.reviewed); assert.deepStrictEqual(r.acts, [['APPLY', 'APPLIED']]);
    assert.strictEqual(r.pkt, pkt0, 'prepared packet rewritten');
    assert(r.search.includes(WHAT), r.search.slice(0, 400));
    assert(r.trace.includes(applied.newId) && r.trace.includes('RELATED_TO') && r.trace.includes(warm), r.trace.slice(0, 800));
    assert.deepStrictEqual(r.idb, n1);
  });

  await T('B8', 'G/J/M · genuine Prepare → genuine Dismiss with reason → DISMISSED + persisted, wiz_ref_* byte/row identical; Apply after Dismiss → REFUSED ALREADY_TERMINAL (no ref write, no state reversal); reload → DISMISSED with reason in the action record, reference unchanged', async () => {
    const cold = await verOf('fx:adm:cache-cold');
    const p = await prepareGenuine(relInc('[SYNTHETIC FIXTURE] The demo cache layer is flushed on every synthetic deploy.', cold));
    assert.strictEqual(p.outcome, 'NEW_RELATED_ITEM');
    const before = await P.page.evaluate(DUMPS);
    await P.page.evaluate(() => { document.getElementById('wizAdmDismissReason').value = 'synthetic reason: not useful'; });
    const d = await userActivate(P.page, '#wizAdmDismissBtn');
    assert.strictEqual(d.result, 'DISMISSED', d.t); assert.strictEqual(d.reviewState, 'DISMISSED'); assert.strictEqual(d.persisted, 'true');
    assert.strictEqual(d.interaction, 'USER_INTERACTION'); assert.strictEqual(d.authority, 'NONE');
    assert.strictEqual((await P.page.evaluate(DUMPS)).ref, before.ref, 'dismiss changed wiz_ref_*');
    const a = await userActivate(P.page, '#wizAdmApplyBtn');
    assert.strictEqual(a.result, 'REFUSED'); assert.strictEqual(a.code, 'ALREADY_TERMINAL'); assert.strictEqual(a.reviewState, 'DISMISSED');
    const d2 = await userActivate(P.page, '#wizAdmDismissBtn');
    assert.strictEqual(d2.result, 'REFUSED'); assert.strictEqual(d2.code, 'ALREADY_TERMINAL');
    await reloadPage(P);
    const r = await P.page.evaluate(id => { const g = window.wizAdmissionGetReview(id); return { state: g.review_state, acts: g.actions.map(x => [x.action, x.result, x.detail.reason || null]) }; }, p.id);
    assert.strictEqual(r.state, 'DISMISSED'); assert.deepStrictEqual(r.acts, [['DISMISS', 'DISMISSED', 'synthetic reason: not useful']]);
    const after = await P.page.evaluate(DUMPS);
    assert.strictEqual(after.ref, before.ref, 'wiz_ref_* differs after reload');
    // the APPLIED review from B7 is unaffected
    assert.strictEqual(await P.page.evaluate(id => window.wizAdmissionGetReview(id).review_state, applied.id), 'APPLIED');
  });

  await T('B9', 'H/M · stale plan in the page: genuine Prepare → legitimate Reference Memory import (other seed) → genuine Apply → STALE_REVIEW + REPREPARE_REQUIRED, reference memory exactly as after the legitimate import, review stays AWAITING_REVIEW (survives reload); a fresh Prepare of the same passport then applies', async () => {
    const warm = await verOf('fx:adm:cache-warm');
    const inc = relInc('[SYNTHETIC FIXTURE] The demo exporter compresses synthetic manifests.', warm);
    const p = await prepareGenuine(inc);
    assert.strictEqual(p.outcome, 'NEW_RELATED_ITEM');
    const imp = await P.page.evaluate(async () => {
      const src = '{"source":{"source_id":"fx:adm:src-c","title":"[SYNTHETIC FIXTURE] unrelated synthetic source","surface":"fixture","source_kind":"RESEARCH","authority_class":"RESEARCH_SYNTHESIS","project_id":"demo-project-adm","as_of":"2026-09-25","currentness":"CURRENT","privacy":"public"}';
      const line = src + ',"item":{"source_id":"fx:adm:src-c","project_id":"demo-project-adm","as_of":"2026-09-25","item_id":"fx:adm:unrelated","item_type":"HYPOTHESIS","claim":"[SYNTHETIC FIXTURE] An unrelated synthetic note.","source_status":"CURRENT","epistemic_state":"SOURCE_ASSERTION"}}';
      const r = await wizRefImportJSONL('{"manifest":{"format":"wiz-ref-jsonl/1","seed_id":"fx-adm-other","seed_version":"1","seed_as_of":"2026-09-25","privacy":"public"}}\n' + line);
      return { committed: r.committed, persisted: r.persisted, errors: r.errors };
    });
    assert(imp.committed && imp.persisted, JSON.stringify(imp));
    const before = await P.page.evaluate(DUMPS);
    const a = await userActivate(P.page, '#wizAdmApplyBtn');
    assert.strictEqual(a.result, 'STALE_REVIEW', a.t); assert(a.t.includes('REPREPARE_REQUIRED') && /fingerprint changed/.test(a.t), a.t);
    assert.strictEqual(a.reviewState, 'AWAITING_REVIEW');
    assert.strictEqual((await P.page.evaluate(DUMPS)).ref, before.ref, 'stale apply wrote to wiz_ref_*');
    await reloadPage(P);
    const st = await P.page.evaluate(id => { const g = window.wizAdmissionGetReview(id); return { state: g.review_state, acts: g.actions.map(x => [x.action, x.result]) }; }, p.id);
    assert.deepStrictEqual(st, { state: 'AWAITING_REVIEW', acts: [['APPLY', 'STALE_REVIEW']] });
    assert.strictEqual((await P.page.evaluate(DUMPS)).ref, before.ref);
    const p2 = await prepareGenuine(inc);
    assert.notStrictEqual(p2.id, p.id);
    const a2 = await userActivate(P.page, '#wizAdmApplyBtn');
    assert.strictEqual(a2.result, 'APPLIED', a2.t);
    assert.strictEqual(P.errors.length, 0, JSON.stringify(P.errors));
  });
} finally {
  await browser.close(); srv.stop(); if (mainSrv) mainSrv.stop();
}
const fail = results.filter(r => r[1] !== 'PASS');
console.log(`\n${results.length - fail.length}/${results.length} passed`);
process.exit(fail.length ? 1 : 0);

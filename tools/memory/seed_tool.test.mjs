// node --test tools/memory/seed_tool.test.mjs
// Deterministic, local, no model calls. Covers seed validation, the 8 orientation retrieval queries,
// the deterministic start view, and the export-lab projection against the REAL Lab importer (wiz-ref-memory.js + repo sql-wasm).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, loadSeed, validate, search, renderStartView, wordCount, exportLab, stats, RELS, TYPES, STATUSES } from './seed_tool.mjs';

const require = createRequire(import.meta.url);
const seed = loadSeed();
const clone = () => JSON.parse(JSON.stringify(seed));

// ── validation ─────────────────────────────────────────────────────────────
test('seed validates with 0 errors and has 40–80 records', () => {
  const v = validate(seed);
  assert.deepEqual(v.errors, []);
  assert.ok(seed.records.length >= 40 && seed.records.length <= 80, 'record count ' + seed.records.length);
});
test('only allowed types / statuses / rels are used', () => {
  for (const r of seed.records) {
    assert.ok(TYPES.includes(r.type), r.id); assert.ok(STATUSES.includes(r.status), r.id);
    for (const x of r.relations) assert.ok(RELS.includes(x.rel), r.id + ' ' + x.rel);
  }
});
test('validator rejects bad type, bad status, bad rel, dangling target, duplicate id, broken supersession', () => {
  const cases = [
    s => { s.records[0].type = 'FACT'; },
    s => { s.records[0].status = 'TRUE'; },
    s => { s.records[0].relations.push({ rel: 'CAUSES', target: s.records[1].id }); },
    s => { s.records[0].relations.push({ rel: 'RELATED_TO', target: 'NOPE-99' }); },
    s => { s.records[1].id = s.records[0].id; },
    s => { const r = s.records.find(x => x.id === 'HIST-01'); r.status = 'HISTORICAL'; },
    s => { s.records[0].source = 'SRC-NOT-REGISTERED'; },
    s => { const r = s.records.find(x => x.provenance === 'SOURCE_DOC'); r.provenance = 'USER_STATEMENT_2026-09-29'; },
  ];
  for (const mut of cases) { const s = clone(); mut(s); assert.equal(validate(s).ok, false, mut.toString()); }
});
test('project pointers: all 12 required projects present, each with role + source', () => {
  const need = ['💠 Crystal', '🗿 Titan', '🧬 Native Kernel', '🌀 Mentaury Soul', '🪁 Mentaury-Kernel', '🌎 Continuum', '🚀 Cognitive OS', '⚗️ CLOS',
    '🕸 Graphiti Fractal', '🧭 Atlas', '🔬 State Validation Lab', '🧪 Eiti-Wizard-Lab'];
  const pp = seed.records.filter(r => r.type === 'PROJECT_POINTER');
  for (const n of need) assert.ok(pp.some(r => r.statement.startsWith(n) && r.source), n);
});
test('non-conflation rules are stored verbatim', () => {
  const all = seed.records.filter(r => r.type === 'INVARIANT').map(r => r.statement).join('; ');
  for (const rule of ['RETRIEVAL != UNDERSTANDING', 'RETRIEVAL != EVIDENCE', 'EVIDENCE != BELIEF', 'BELIEF != TRUTH', 'STORED != CURRENT', 'CURRENT != IMPORTANT',
    'IMPORTANT != TRUE', 'HISTORICAL != CURRENT', 'MODEL_PROPOSAL != USER_DECISION', 'AI SUMMARY != USER RAW', 'UNKNOWN != FALSE', 'NOT RETRIEVED != ABSENT',
    'RESEARCH != RUNTIME', 'SPEC != IMPLEMENTATION', 'IMPLEMENTED != ACTIVATED', 'TESTED != PRODUCTION AUTHORIZED']) assert.ok(all.includes(rule), rule);
});
test('user motivation is not a system requirement; no private locators in the committed seed', () => {
  const um = seed.records.find(r => r.id === 'UM-01');
  assert.equal(um.type, 'USER_MOTIVATION'); assert.match(um.statement, /НЕ системное требование/);
  const raw = fs.readFileSync(path.join(ROOT, 'docs/memory/ruslan-orientation-seed.json'), 'utf8');
  assert.doesNotMatch(raw, /notion\.so\/|notion\.site\/|app\.notion\.com|docs\.google\.com|drive\.google\.com/);
  assert.doesNotMatch(raw, /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/i);
});

// ── retrieval: the 8 orientation queries ───────────────────────────────────
// Relevant sets were written down before the first run. Grade: PASS = top-1 relevant AND ≥60% of the returned
// set relevant AND ≤5 returned; PARTIAL = ≥1 relevant returned; FAIL = none. Queries were known while the seed
// keywords / intent lexicon were authored, so this is a regression check, NOT a blind evaluation.
export const QUERIES = [
  { q: 'Кто такой Руслан и чего он хочет?', rel: ['UID-01', 'UID-02', 'UID-03', 'UG-01', 'UG-02', 'UG-03'], floor: 'PASS' },
  { q: 'Почему Руслан занимается Velantrim?', rel: ['UM-01', 'UG-05', 'UG-07', 'UG-01', 'UG-02', 'UG-03'], floor: 'PASS' },
  { q: 'Что сейчас является главной практической проблемой?', rel: ['UM-02', 'CP-01', 'CP-02'], floor: 'PARTIAL' },
  { q: 'Чем retrieval отличается от HAP-01?', rel: ['AT-HAP', 'KL-HAP', 'KL-HAP-SRC', 'OQ-05', 'INV-01'], floor: 'PASS' },
  { q: 'Что уже сделано с практической памятью?', rel: ['RR-SM-01', 'RR-SM-02', 'KL-SM-03', 'RR-LAB-01', 'SP-D-SIMPLE-MEMORY', 'SP-GH-SIMPLE-MEMORY', 'AT-02'], floor: 'PASS' },
  { q: 'Что остаётся открытым?', rel: ['OQ-01', 'OQ-02', 'OQ-03', 'OQ-04', 'OQ-05', 'OQ-06', 'OQ-07', 'OQ-08', 'OQ-09', 'KL-SM-03', 'KL-HAP-SRC'], floor: 'PASS' },
  { q: 'Куда смотреть за историей идеи?', rel: ['SP-N-RUSLAN-RESEARCH', 'SP-N-GENESIS', 'SP-D-RUSLAN-RESEARCH'], floor: 'PASS' },
  { q: 'Куда смотреть за текущей исследовательской архитектурой?', rel: ['SP-D-WORKING-MASTER', 'SP-D-RESEARCH-PROGRAM'], floor: 'PARTIAL' },
];
export function grade(res, rel) {
  const ids = res.map(r => r.id); const hit = ids.filter(i => rel.includes(i));
  if (!hit.length) return 'FAIL';
  if (rel.includes(ids[0]) && hit.length / ids.length >= 0.6 && ids.length <= 5) return 'PASS';
  return 'PARTIAL';
}
const RANK = { FAIL: 0, PARTIAL: 1, PASS: 2 };
for (const [i, c] of QUERIES.entries()) {
  test(`retrieval Q${i + 1}: ${c.q}`, () => {
    const res = search(seed, c.q);
    assert.ok(res.length >= 1 && res.length <= 5, 'small top-k');
    for (const r of res) assert.ok(r.id && r.status && r.source, 'id/status/source present');
    const g = grade(res, c.rel);
    console.log(`  Q${i + 1} ${g}: ${res.map(r => r.id).join(', ')}`);
    assert.ok(RANK[g] >= RANK[c.floor], `grade ${g} below floor ${c.floor}`);
  });
}
test('search is deterministic', () => {
  for (const c of QUERIES) assert.deepEqual(search(seed, c.q), search(seed, c.q));
});

// ── start view ─────────────────────────────────────────────────────────────
test('CURRENT_ORIENTATION.md is up to date, deterministic and < 1500 words', () => {
  const md = renderStartView(seed);
  assert.equal(md, renderStartView(clone()));
  assert.ok(wordCount(md) < 1500, 'words ' + wordCount(md));
  for (const h of ['## WHO', '## NORTH STAR', '## CURRENT PRIORITY', '## ACTIVE THREAD', '## KNOWN', '## OPEN', '## NEXT', '## DETAILS']) assert.ok(md.includes(h), h);
  assert.equal(fs.readFileSync(path.join(ROOT, 'docs/memory/CURRENT_ORIENTATION.md'), 'utf8'), md, 'regenerate with render-start-view --out');
});

// ── export-lab against the REAL Lab importer ───────────────────────────────
test('export-lab bundle imports into the existing wiz_ref layer with 0 errors, idempotently, statuses verbatim', async () => {
  const initSqlJs = require(path.join(ROOT, 'sql-wasm.js'));
  const WizRef = require(path.join(ROOT, 'wiz-ref-memory.js'));
  const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(path.join(ROOT, 'sql-wasm.wasm')) });
  const db = new SQL.Database();
  const text = exportLab(seed, {});
  const lines = text.trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines[0].manifest.format, 'wiz-ref-jsonl/1');
  const res = await WizRef.importJSONL(db, text);
  assert.deepEqual(res.errors, []); assert.equal(res.committed, true);
  assert.equal(res.items_inserted, seed.records.length);
  const nRel = seed.records.reduce((n, r) => n + r.relations.filter(x => x.rel !== 'SUPERSEDED_BY').length, 0);
  assert.equal(res.relations_inserted, nRel);
  assert.equal(res.items_superseded, seed.records.filter(r => r.supersedes).length);
  const auto = db.exec("SELECT COUNT(*) FROM wiz_ref_relations WHERE relation_type='SUPERSEDES' AND to_item_id='passport:HIST-01'")[0].values[0][0];
  assert.equal(auto, 1, 'importer-generated SUPERSEDES relation');
  const again = await WizRef.importJSONL(db, text);
  assert.equal(again.items_inserted, 0); assert.equal(again.items_unchanged, seed.records.length);
  // statuses / provenance preserved verbatim; superseded record hidden by default, kept with include_superseded
  const row = db.exec("SELECT source_status, epistemic_state, item_type FROM wiz_ref_items WHERE item_id='passport:AT-HAP'")[0].values[0];
  assert.deepEqual(row, ['CURRENT', 'USER_STATEMENT', 'HUMAN_LENS']);
  const lc = db.exec("SELECT lifecycle, superseded_by FROM wiz_ref_items WHERE item_id='passport:HIST-01'")[0].values[0];
  assert.deepEqual(lc, ['SUPERSEDED', 'passport:UG-07']);
  const hits = WizRef.search(db, 'HAP', { limit: 5 });
  assert.ok(hits.length >= 1 && hits.every(h => h.is_verified_truth === false));
  // the Lab personal-memory tables are untouched by this path
  const facts = db.exec("SELECT name FROM sqlite_master WHERE name='wiz_facts'");
  assert.equal(facts.length, 0);
  db.close();
});
test('stats are consistent', () => {
  const s = stats(seed);
  assert.equal(Object.values(s.by_type).reduce((a, b) => a + b, 0), seed.records.length);
});

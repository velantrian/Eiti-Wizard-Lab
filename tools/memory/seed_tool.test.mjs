// node --test tools/memory/seed_tool.test.mjs
// Deterministic, local, no model calls. Covers seed validation, the 8 orientation retrieval queries,
// the deterministic start view, and the export-lab projection against the REAL Lab importer (wiz-ref-memory.js + repo sql-wasm).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, DEFAULT_SEED, DEFAULT_MANIFEST, loadSeed, loadManifest, validate, search, renderStartView, wordCount, exportLab, stats, RELS, TYPES, STATUSES, sha256File, verifyIntegrity, checkIntegrity, selectBootstrapSections, buildBootstrap, bootstrapRecordIds, renderBootstrapJson, renderBootstrapMarkdown, bootstrapMarkdownIds, BOOTSTRAP_SCHEMA, BOOTSTRAP_ROLE, BOOTSTRAP_SECTION_ORDER } from './seed_tool.mjs';

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

// ── М2: провайдер-нейтральный контекст (Т1–Т16) ─────────────────────────────
// Все тесты локальные и детерминированные: без сети, моделей, эмбеддингов.
// Канон обязан остаться нетронутым: 79 записей, SHA e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0.
const manifest = loadManifest();
const canonSha = sha256File(DEFAULT_SEED);
const byId = new Map(seed.records.map((r) => [r.id, r]));
// Вспомогательная сборка пакета из канонических файлов (через ворота целостности).
function canonPack() {
  const gate = checkIntegrity(DEFAULT_SEED, DEFAULT_MANIFEST);
  assert.equal(gate.ok, true, 'ворота целостности обязаны пропускать канон: ' + gate.errors.join('; '));
  return { gate, json: renderBootstrapJson(gate.seed, gate.manifest, gate.fileHash), md: renderBootstrapMarkdown(gate.seed, gate.manifest, gate.fileHash) };
}

// Т1: канон валиден.
test('М2 Т1: seed валидируется без ошибок', () => {
  const v = validate(seed);
  assert.deepEqual(v.errors, []);
  assert.equal(v.ok, true);
});
// Т2: счётчик 79 совпадает с манифестом.
test('М2 Т2: 79 записей == manifest.canonical_record_count', () => {
  assert.equal(seed.records.length, 79);
  assert.equal(manifest.canonical_record_count, 79);
  assert.equal(seed.records.length, manifest.canonical_record_count);
});
// Т3: SHA файла совпадает с манифестом и эталоном М1.
test('М2 Т3: SHA-256 seed == manifest.canonical_content_sha256', () => {
  assert.equal(canonSha, manifest.canonical_content_sha256);
  assert.equal(canonSha, 'e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0');
});
// Т4: изменённый seed не проходит ворота.
test('М2 Т4: изменённый seed → integrity fail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-seed-'));
  try {
    // Случай А: точечное изменение утверждения (валидация и счётчик целы, SHA плывёт).
    const raw = fs.readFileSync(DEFAULT_SEED, 'utf8');
    const badRaw = raw.replace('cognitive-systems researcher', 'cognitive-systems researcher!');
    assert.notEqual(badRaw, raw);
    const badPath = path.join(dir, 'seed-bad.json');
    fs.writeFileSync(badPath, badRaw);
    const r1 = checkIntegrity(badPath, DEFAULT_MANIFEST);
    assert.equal(r1.ok, false);
    assert.match(r1.errors.join('\n'), /3\/3|SHA/);
    // Случай Б: удалённая запись (плывут счётчик и SHA).
    const obj = JSON.parse(raw);
    obj.records = obj.records.slice(1);
    const cutPath = path.join(dir, 'seed-cut.json');
    fs.writeFileSync(cutPath, JSON.stringify(obj));
    const r2 = checkIntegrity(cutPath, DEFAULT_MANIFEST);
    assert.equal(r2.ok, false);
    assert.match(r2.errors.join('\n'), /2\/3|счётчик/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
// Т5: изменённый манифест не проходит ворота.
test('М2 Т5: изменённый хэш/счётчик манифеста → integrity fail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-man-'));
  try {
    const raw = JSON.parse(fs.readFileSync(DEFAULT_MANIFEST, 'utf8'));
    const badHash = { ...raw, canonical_content_sha256: '0'.repeat(64) };
    const p1 = path.join(dir, 'manifest-bad-hash.json');
    fs.writeFileSync(p1, JSON.stringify(badHash));
    const r1 = checkIntegrity(DEFAULT_SEED, p1);
    assert.equal(r1.ok, false);
    assert.match(r1.errors.join('\n'), /3\/3|SHA/);
    const badCount = { ...raw, canonical_record_count: 78 };
    const p2 = path.join(dir, 'manifest-bad-count.json');
    fs.writeFileSync(p2, JSON.stringify(badCount));
    const r2 = checkIntegrity(DEFAULT_SEED, p2);
    assert.equal(r2.ok, false);
    assert.match(r2.errors.join('\n'), /2\/3|счётчик/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
// Т6: JSON детерминирован, схема/роль/носитель верны, без wall-clock.
test('М2 Т6: два JSON-экспорта побайтово identical', () => {
  const { json: a } = canonPack();
  const { json: b } = canonPack();
  assert.equal(a, b);
  const pack = JSON.parse(a);
  assert.equal(pack.schema, BOOTSTRAP_SCHEMA);
  assert.equal(pack.schema, 'eiti-context-bootstrap/1');
  assert.equal(pack.role, BOOTSTRAP_ROLE);
  assert.equal(pack.role, 'PROVIDER_NEUTRAL_ORIENTATION');
  assert.equal(pack.carrier_version, 'M1');
  assert.equal(pack.canonical_content_sha256, canonSha);
  assert.equal(pack.canonical_record_count, 79);
  assert.equal(pack.as_of, seed.as_of);
  assert.doesNotMatch(a, /generated_at/);
  assert.deepEqual(Object.keys(pack.sections), [...BOOTSTRAP_SECTION_ORDER]);
});
// Т7: МД детерминирован и начинается с границы ориентации.
test('М2 Т7: два MD-экспорта побайтово identical', () => {
  const { md: a } = canonPack();
  const { md: b } = canonPack();
  assert.equal(a, b);
  assert.match(a, /^# EITI CONTEXT BOOTSTRAP/);
  for (const фраза of ['BOOTSTRAP!=CANON', 'UNKNOWN!=FALSE', 'MODEL_PROPOSAL!=USER_DECISION', 'CURRENT_STATE!=HISTORY',
    'MODEL READING != MODEL OWNING MEMORY', 'details_pointer', 'приватные локаторы']) assert.ok(a.includes(фраза), фраза);
  assert.doesNotMatch(a, /generated_at/);
});
// Т8: JSON и МД содержат те же ИД в том же порядке.
test('М2 Т8: JSON и MD — одинаковый упорядоченный набор ИД', () => {
  const { json, md } = canonPack();
  const a = bootstrapRecordIds(JSON.parse(json));
  const b = bootstrapMarkdownIds(md);
  assert.deepEqual(b, a);
  assert.equal(a.length, 70);
  assert.equal(new Set(a).size, a.length);
});
// Т9: текущие identity/goal/priority присутствуют.
test('М2 Т9: CURRENT identity/goal/priority на месте', () => {
  const { json, md } = canonPack();
  const pack = JSON.parse(json);
  assert.deepEqual(pack.sections.who.map((r) => r.id), ['UID-01', 'UID-02', 'UID-03']);
  assert.deepEqual(pack.sections.north_star.map((r) => r.id), ['UG-01', 'UG-02', 'UG-03', 'UM-01', 'UM-02']);
  assert.deepEqual(pack.sections.current_priority.map((r) => r.id), ['CP-01', 'CP-02']);
  for (const r of [...pack.sections.who, ...pack.sections.north_star, ...pack.sections.current_priority]) assert.equal(r.status, 'CURRENT');
  for (const id of ['UID-01', 'UG-02', 'UM-02', 'CP-01', 'CP-02']) assert.ok(md.includes(id), id);
});
// Т10: OPEN/UNKNOWN preserved, без схлопывания в FALSE.
test('М2 Т10: OPEN сохраняют OPEN/UNKNOWN', () => {
  const { json } = canonPack();
  const pack = JSON.parse(json);
  const open = pack.sections.open;
  assert.equal(open.length, 9);
  const oq07 = open.find((r) => r.id === 'OQ-07');
  assert.equal(oq07.status, 'UNKNOWN');
  for (const r of open) assert.ok(['OPEN', 'UNKNOWN'].includes(r.status), r.id);
  assert.ok(!open.some((r) => r.status === 'FALSE' || r.status === 'CURRENT'));
  // UNKNOWN активные линии и ограничения тоже явные.
  const rest = [...pack.sections.active_threads, ...pack.sections.known_limitations];
  assert.equal(rest.find((r) => r.id === 'AT-03').status, 'UNKNOWN');
  assert.equal(rest.find((r) => r.id === 'KL-HAP-SRC').status, 'UNKNOWN');
});
// Т11: SUPERSEDED не выдаются за текущее; HISTORICAL не продвигаются.
test('М2 Т11: SUPERSEDED/HISTORICAL исключены из текущих секций', () => {
  const { json } = canonPack();
  const pack = JSON.parse(json);
  const ids = bootstrapRecordIds(pack);
  for (const h of ['HIST-01', 'UID-04', 'UG-04', 'UG-05', 'UG-06', 'UG-07', 'HIST-02', 'UM-03', 'AT-02']) assert.ok(!ids.includes(h), h);
  for (const key of BOOTSTRAP_SECTION_ORDER) for (const r of pack.sections[key]) assert.ok(r.status !== 'SUPERSEDED' && r.status !== 'HISTORICAL', r.id);
});
// Т12: DEFERRED остаются отложенными.
test('М2 Т12: DEFERRED явные и не переписаны', () => {
  const { json, md } = canonPack();
  const pack = JSON.parse(json);
  const df = pack.sections.next.filter((r) => r.type === 'DEFERRED_ITEM');
  assert.deepEqual(df.map((r) => r.id), ['DF-01', 'DF-02', 'DF-03', 'DF-04', 'DF-05', 'DF-06']);
  for (const r of df) assert.equal(r.status, 'DEFERRED');
  // Отложенные живут только в next, а не в current/open/known.
  for (const key of ['who', 'north_star', 'current_priority', 'active_threads', 'known', 'open']) {
    for (const r of pack.sections[key]) assert.ok(!r.id.startsWith('DF-'), r.id);
  }
  assert.ok(md.includes('Явно отложено (DEFERRED'));
});
// Т13: provenance переживает проекцию дословно.
test('М2 Т13: provenance сохранён дословно', () => {
  const { json } = canonPack();
  const pack = JSON.parse(json);
  for (const key of BOOTSTRAP_SECTION_ORDER) {
    for (const r of pack.sections[key]) {
      assert.equal(r.provenance, byId.get(r.id).provenance, r.id);
    }
  }
  // Точечные якоря против повышения AI_SUMMARY до USER_STATEMENT.
  const flat = new Map();
  for (const key of BOOTSTRAP_SECTION_ORDER) for (const r of pack.sections[key]) flat.set(r.id, r);
  assert.equal(flat.get('UID-01').provenance, 'USER_STATEMENT_2026-09-29');
  assert.equal(flat.get('KL-HAP-SRC').provenance, 'AI_SUMMARY');
  assert.equal(flat.get('NA-01').provenance, 'AI_SUMMARY');
  assert.equal(flat.get('RR-SM-01').provenance, 'SOURCE_DOC');
});
// Т14: type/status/source/scope/updated_at/details_pointer/statement не переписаны.
test('М2 Т14: type/status/source не переписаны, эпистемология не схлопнута', () => {
  const { json } = canonPack();
  const pack = JSON.parse(json);
  for (const key of BOOTSTRAP_SECTION_ORDER) {
    for (const r of pack.sections[key]) {
      const o = byId.get(r.id);
      assert.equal(r.type, o.type, r.id);
      assert.equal(r.status, o.status, r.id);
      assert.equal(r.source, o.source, r.id);
      assert.equal(r.scope, o.scope, r.id);
      assert.equal(r.updated_at, o.updated_at, r.id);
      assert.equal(r.details_pointer, o.details_pointer, r.id);
      assert.equal(r.statement, o.statement, r.id);
      assert.deepEqual(Object.keys(r).sort(), ['details_pointer', 'id', 'provenance', 'scope', 'source', 'statement', 'status', 'type', 'updated_at']);
    }
  }
  // Точечные якоря против схлопывания.
  const flat = new Map();
  for (const key of BOOTSTRAP_SECTION_ORDER) for (const r of pack.sections[key]) flat.set(r.id, r);
  assert.equal(flat.get('OQ-07').status, 'UNKNOWN');
  assert.equal(flat.get('RR-SM-01').status, 'ENGINEERING_RESULT');
  assert.equal(flat.get('RR-FM16').status, 'RESEARCH_RESULT');
  assert.equal(flat.get('KL-SM-03').status, 'OPEN');
  assert.equal(flat.get('NA-01').status, 'OPEN');
});
// Т15: без приватных локаторов и секретов.
test('М2 Т15: нет приватных локаторов и секретов', () => {
  const { json, md } = canonPack();
  for (const text of [json, md]) {
    assert.doesNotMatch(text, /notion\.so|notion\.site|app\.notion\.com|docs\.google\.com|drive\.google\.com/i);
    assert.doesNotMatch(text, /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/i);
    assert.doesNotMatch(text, /private-memory|source-locators|alias:/i);
    assert.doesNotMatch(text, /api[_-]?key|apikey|token|passwd|password|cookie|secret|bearer/i);
    assert.doesNotMatch(text, /https?:\/\//i);
  }
});
// Т16: существующие команды инструмента не сломаны рефакторингом.
test('М2 Т16: validate/stats/search/render/export-lab работают как раньше', () => {
  assert.equal(validate(seed).ok, true);
  const s = stats(seed);
  assert.equal(s.records, 79);
  assert.ok(search(seed, 'Кто такой Руслан?').length >= 1);
  assert.ok(search(seed, 'Что остаётся открытым?').length >= 1);
  const md = renderStartView(seed);
  assert.equal(md, fs.readFileSync(path.join(ROOT, 'docs/memory/CURRENT_ORIENTATION.md'), 'utf8'));
  const lab = exportLab(seed, {});
  const lines = lab.trim().split('\n');
  assert.equal(JSON.parse(lines[0]).manifest.format, 'wiz-ref-jsonl/1');
  assert.equal(lines.length, 1 + seed.records.length + seed.records.reduce((n, r) => n + r.relations.filter((x) => x.rel !== 'SUPERSEDED_BY').length, 0));
  // Чистая проверка целостности тоже пропускает канон.
  assert.equal(verifyIntegrity(seed, canonSha, manifest).ok, true);
  // Селектор детерминирован и отдаёт 70 записей.
  const a = selectBootstrapSections(seed);
  const b = selectBootstrapSections(JSON.parse(JSON.stringify(seed)));
  assert.deepEqual(a, b);
  assert.equal(Object.values(a).flat().length, 70);
});

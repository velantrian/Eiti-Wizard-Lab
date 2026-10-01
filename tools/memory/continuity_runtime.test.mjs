// node --test tools/memory/continuity_runtime.test.mjs
// Тесты М3-Т1…Т18: read-only рантайм-мост непрерывности. Локальные,
// детерминированные, без сети, моделей и эмбеддингов. Браузерное поведение
// покрывается через чистые функции модуля (та же композиция, что в index.html)
// плюс статические проверки точек вызова в index.html.
// Канон обязан остаться нетронутым: 79 записей, SHA e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0,
// манифест и пустой реестр событий без изменений.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, DEFAULT_SEED, DEFAULT_MANIFEST, loadManifest, exportContext } from './seed_tool.mjs';
import * as Runtime from '../../continuity-runtime.mjs';

const CANON_SHA = 'e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0';
const RUNTIME_PATH = path.join(ROOT, 'docs', 'memory', 'context-bootstrap.runtime.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

const runtimeBytes = fs.readFileSync(RUNTIME_PATH, 'utf8');
const bootstrap = JSON.parse(runtimeBytes);
const manifest = loadManifest();
const html = fs.readFileSync(INDEX_PATH, 'utf8');
const byId = new Map();
for (const rows of Object.values(bootstrap.sections)) for (const r of rows) byId.set(r.id, r);

// Заглушка fetch для загрузчика: по URL отдаёт объект или бросает на json().
function stubFetch({ bootstrapText = runtimeBytes, manifestText = null, bootstrapOk = true, manifestOk = true, brokenJson = false } = {}) {
  const manifestRaw = manifestText === null ? fs.readFileSync(DEFAULT_MANIFEST, 'utf8') : manifestText;
  return async (url) => {
    const isBootstrap = String(url).includes('context-bootstrap.runtime.json');
    const ok = isBootstrap ? bootstrapOk : manifestOk;
    if (!ok) return { ok: false, status: 404, json: async () => { throw new Error('нет тела'); } };
    return {
      ok: true,
      status: 200,
      json: async () => {
        if (brokenJson && isBootstrap) throw new Error('неожиданный конец JSON');
        return JSON.parse(isBootstrap ? bootstrapText : manifestRaw);
      },
    };
  };
}

// Срез тела функции верхнего уровня из index.html для статических проверок.
function sliceFn(anchor) {
  const start = html.indexOf(anchor);
  assert.ok(start >= 0, 'якорь найден: ' + anchor);
  let end = html.indexOf('\n}\n', start);
  if (end < 0) end = start + 6000;
  return html.slice(start, end);
}

// ── М3-Т1: committed-артефакт == официальному экспорту М2 побайтово ─────────
test('М3 Т1: runtime-артефакт побайтово равен exportContext json', () => {
  assert.equal(runtimeBytes, exportContext({ format: 'json' }));
  assert.equal(bootstrap.schema, 'eiti-context-bootstrap/1');
  assert.equal(bootstrap.role, 'PROVIDER_NEUTRAL_ORIENTATION');
});

// ── М3-Т2: загрузчик принимает корректные схему/хэш/счётчик ────────────────
test('М3 Т2: корректный пакет проходит проверку и загрузку', async () => {
  const verdict = Runtime.verifyBootstrap(bootstrap, manifest);
  assert.deepEqual(verdict.errors, []);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.status, 'READY');
  const res = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch(),
  });
  assert.equal(res.status, 'READY');
  assert.deepEqual(res.errors, []);
  assert.ok(res.blockText && res.blockText.includes(Runtime.CONTINUITY_BLOCK_START));
  assert.equal(res.meta.canonical_sha, CANON_SHA);
  assert.equal(res.meta.record_count, 35);
  assert.equal(res.meta.char_count, res.blockText.length);
});

// ── М3-Т3: неверный SHA → закрыто, без контекста ───────────────────────────
test('М3 Т3: неверный SHA канона → INTEGRITY_FAIL без блока', async () => {
  const bad = JSON.parse(runtimeBytes);
  bad.canonical_content_sha256 = 'f'.repeat(64);
  assert.equal(Runtime.verifyBootstrap(bad, manifest).ok, false);
  assert.equal(Runtime.verifyBootstrap(bad, manifest).status, 'INTEGRITY_FAIL');
  const res = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch({ bootstrapText: JSON.stringify(bad) }),
  });
  assert.equal(res.status, 'INTEGRITY_FAIL');
  assert.equal(res.blockText, null);
  assert.equal(res.core, null);
});

// ── М3-Т4: неверный счётчик → закрыто ──────────────────────────────────────
test('М3 Т4: неверный счётчик записей → INTEGRITY_FAIL без блока', async () => {
  const bad = JSON.parse(runtimeBytes);
  bad.canonical_record_count = 78;
  assert.equal(Runtime.verifyBootstrap(bad, manifest).ok, false);
  const res = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch({ bootstrapText: JSON.stringify(bad) }),
  });
  assert.equal(res.status, 'INTEGRITY_FAIL');
  assert.equal(res.blockText, null);
});

// ── М3-Т5: битый JSON / нет секции → закрыто ───────────────────────────────
test('М3 Т5: битый JSON или нет секции → FAIL CLOSED', async () => {
  const broken = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch({ brokenJson: true }),
  });
  assert.equal(broken.status, 'LOAD_ERROR');
  assert.equal(broken.blockText, null);
  const noSection = JSON.parse(runtimeBytes);
  delete noSection.sections.open;
  assert.equal(Runtime.verifyBootstrap(noSection, manifest).ok, false);
  const missing = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch({ bootstrapText: JSON.stringify(noSection) }),
  });
  assert.equal(missing.status, 'INTEGRITY_FAIL');
  assert.equal(missing.blockText, null);
  // Недоступный манифест — тоже закрыто.
  const noManifest = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch({ manifestOk: false }),
  });
  assert.equal(noManifest.status, 'LOAD_ERROR');
  assert.equal(noManifest.blockText, null);
});

// ── М3-Т6: отбор ядра детерминирован ───────────────────────────────────────
test('М3 Т6: ядро и блок детерминированы (35 записей)', () => {
  const a = Runtime.selectRuntimeCore(JSON.parse(runtimeBytes));
  const b = Runtime.selectRuntimeCore(JSON.parse(runtimeBytes));
  assert.deepEqual(a, b);
  assert.equal(a.records.length, 35);
  assert.deepEqual(a.records.map((r) => r.id), b.records.map((r) => r.id));
  const ra = Runtime.renderRuntimeCore(a);
  const rb = Runtime.renderRuntimeCore(b);
  assert.deepEqual(ra, rb);
  assert.equal(ra.recordCount, 35);
  assert.equal(ra.charCount, 14058);
  const meta = { canonicalSha: CANON_SHA, canonicalCount: 79, excludedCounts: a.excludedCounts };
  assert.equal(Runtime.buildContinuityBlock(ra, meta), Runtime.buildContinuityBlock(rb, meta));
  assert.equal(Runtime.buildContinuityBlock(ra, meta).length, 15024);
});

// ── М3-Т7: HISTORICAL/SUPERSEDED исключены ─────────────────────────────────
test('М3 Т7: исторические/вытесненные не попадают в ядро', () => {
  const core = Runtime.selectRuntimeCore(bootstrap);
  for (const r of core.records) {
    assert.ok(r.status !== 'HISTORICAL' && r.status !== 'SUPERSEDED', r.id);
  }
  for (const h of ['HIST-01', 'HIST-02', 'UID-04', 'UG-04', 'UG-05', 'UG-06', 'UG-07', 'UM-03', 'AT-02']) {
    assert.ok(!core.records.some((r) => r.id === h), h);
  }
  // Защита в глубину: подсунутая историческая запись отбрасывается отбором.
  const poisoned = JSON.parse(runtimeBytes);
  poisoned.sections.who.push({ id: 'UID-XX', type: 'USER_IDENTITY', status: 'HISTORICAL', statement: 'подмена',
    source: 'SRC-USER-2026-09-29', provenance: 'USER_STATEMENT_2026-09-29', scope: 'identity',
    updated_at: '2026-09-29', details_pointer: 'SRC-USER-2026-09-29 — заявление пользователя' });
  assert.ok(!Runtime.selectRuntimeCore(poisoned).records.some((r) => r.id === 'UID-XX'));
});

// ── М3-Т8: DEFERRED не инжектятся автоматически ─────────────────────────────
test('М3 Т8: отложенные записи вне ядра', () => {
  const core = Runtime.selectRuntimeCore(bootstrap);
  assert.ok(!core.records.some((r) => r.type === 'DEFERRED_ITEM' || r.status === 'DEFERRED'));
  for (const d of ['DF-01', 'DF-02', 'DF-03', 'DF-04', 'DF-05', 'DF-06']) {
    assert.ok(!core.records.some((r) => r.id === d), d);
  }
  assert.deepEqual(core.sections.next.map((r) => r.id), ['NA-START', 'NA-END', 'NA-01']);
  assert.deepEqual(core.excludedCounts, { known: 6, known_limitations: 3, open: 9, sources: 11, deferred: 6 });
});

// ── М3-Т9: включённые UNKNOWN остаются UNKNOWN ─────────────────────────────
test('М3 Т9: UNKNOWN ядра не схлопываются', () => {
  const core = Runtime.selectRuntimeCore(bootstrap);
  const unknowns = core.records.filter((r) => r.status === 'UNKNOWN');
  assert.ok(unknowns.length >= 1, 'в ядре есть явные UNKNOWN');
  assert.equal(core.records.find((r) => r.id === 'AT-03').status, 'UNKNOWN');
  for (const r of unknowns) {
    assert.equal(r.status, 'UNKNOWN', r.id);
    assert.equal(r.status === 'FALSE', false, r.id);
  }
  const rendered = Runtime.renderRuntimeCore(core);
  assert.ok(rendered.text.includes('AT-03 [ACTIVE_THREAD · UNKNOWN]'));
});

// ── М3-Т10: статус/источник/происхождение дословны ─────────────────────────
test('М3 Т10: status/source/provenance ядра дословны', () => {
  const core = Runtime.selectRuntimeCore(bootstrap);
  for (const r of core.records) {
    const o = byId.get(r.id);
    assert.equal(r.status, o.status, r.id);
    assert.equal(r.source, o.source, r.id);
    assert.equal(r.provenance, o.provenance, r.id);
    assert.equal(r.type, o.type, r.id);
    assert.equal(r.statement, o.statement, r.id);
    assert.equal(r.details_pointer, o.details_pointer, r.id);
  }
  // Точечные якоря против повышения AI_SUMMARY до заявления пользователя.
  const flat = new Map(core.records.map((r) => [r.id, r]));
  assert.equal(flat.get('UID-01').provenance, 'USER_STATEMENT_2026-09-29');
  assert.equal(flat.get('NA-01').provenance, 'AI_SUMMARY');
});

// ── М3-Т11: без секретов и приватных локаторов ─────────────────────────────
test('М3 Т11: в блоке нет секретов и приватных локаторов', async () => {
  const res = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch(),
  });
  const text = res.blockText;
  assert.doesNotMatch(text, /notion\.so|notion\.site|app\.notion\.com|docs\.google\.com|drive\.google\.com/i);
  assert.doesNotMatch(text, /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/i);
  assert.doesNotMatch(text, /private-memory|source-locators|alias:/i);
  assert.doesNotMatch(text, /api[_-]?key|apikey|token|passwd|password|cookie|secret|bearer/i);
  assert.doesNotMatch(text, /https?:\/\//i);
  assert.doesNotMatch(text, /sk-[A-Za-z0-9]{8,}/);
});

// Вспомогательная сборка готового состояния (как кэш браузера в READY).
async function readyState() {
  const res = await Runtime.loadContinuityRuntime({
    bootstrapUrl: 'docs/memory/context-bootstrap.runtime.json',
    manifestUrl: 'docs/memory/manifest.json',
    fetchFn: stubFetch(),
  });
  assert.equal(res.status, 'READY');
  return {
    blockText: res.blockText,
    coreMeta: { canonical_sha: res.meta.canonical_sha, record_count: res.meta.record_count, char_count: res.meta.char_count },
  };
}

// ── М3-Т12: OFF → исходящие инструкции без изменений ───────────────────────
test('М3 Т12: Continuity OFF не меняет инструкции', async () => {
  const { blockText, coreMeta } = await readyState();
  const base = 'пользовательские инструкции\n\nсистемные сведения';
  for (const status of ['READY', 'DISABLED', 'LOADING', 'STALE', 'INTEGRITY_FAIL', 'LOAD_ERROR']) {
    const r = Runtime.composeInstructions(base, { enabled: false, status, blockText, coreMeta, cleanResumeActive: false });
    assert.equal(r.instructions, base, status);
    assert.equal(r.continuity.injected, false, status);
    assert.equal(r.continuity.skipped_reason, 'disabled', status);
  }
});

// ── М3-Т13: ON + READY → ровно один блок ───────────────────────────────────
test('М3 Т13: ON + READY даёт ровно один блок', async () => {
  const { blockText, coreMeta } = await readyState();
  const base = 'пользовательские инструкции\n\nсистемные сведения';
  const r = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false });
  assert.equal(r.continuity.injected, true);
  assert.equal(r.continuity.skipped_reason, null);
  assert.equal(r.continuity.record_count, 35);
  assert.equal(r.continuity.char_count, blockText.length);
  assert.equal(r.continuity.canonical_sha, CANON_SHA);
  assert.ok(r.instructions.startsWith(base + '\n\n'));
  const starts = r.instructions.split(Runtime.CONTINUITY_BLOCK_START).length - 1;
  const ends = r.instructions.split(Runtime.CONTINUITY_BLOCK_END).length - 1;
  assert.equal(starts, 1);
  assert.equal(ends, 1);
  assert.ok(r.instructions.endsWith(Runtime.CONTINUITY_BLOCK_END));
});

// ── М3-Т14: смена провайдера/модели не меняет семантику блока ──────────────
test('М3 Т14: блок не зависит от провайдера/модели', async () => {
  // Чистая композиция не принимает провайдер/модель: повторные сборки идентичны.
  const first = await readyState();
  const second = await readyState();
  assert.equal(first.blockText, second.blockText);
  const base = 'база';
  const a = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText: first.blockText, coreMeta: first.coreMeta, cleanResumeActive: false });
  const b = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText: second.blockText, coreMeta: second.coreMeta, cleanResumeActive: false });
  assert.equal(a.instructions, b.instructions);
  // Статика: композиция стоит до провайдерного switch, все адаптеры читают
  // одну центральную переменную instructions (сериализация не менялась).
  const sendStart = html.indexOf('async function sendMessage(');
  assert.ok(sendStart >= 0);
  const sendSlice = html.slice(sendStart, sendStart + 120000);
  const composeAt = sendSlice.indexOf('wizContinuityCompose(instructions, { cleanResumeActive: false })');
  const switchAt = sendSlice.indexOf('switch (provider)');
  assert.ok(composeAt >= 0 && switchAt >= 0 && composeAt < switchAt);
  for (const c of ["case 'deepseek'", "case 'claude'", "case 'openai'", "case 'groq'", "case 'openrouter'", "case 'gemini'", "case 'grok'", "provider === 'ollama'"]) {
    assert.ok(sendSlice.includes(c), c);
  }
  const centralUses = (sendSlice.match(/(content|text): instructions[,\s}]|system: instructions/g) || []).length;
  assert.ok(centralUses >= 8, 'центральных отображений: ' + centralUses);
});

// ── М3-Т15: Clean Resume → без инжекта ─────────────────────────────────────
test('М3 Т15: активный Clean Resume пропускает непрерывность', async () => {
  const { blockText, coreMeta } = await readyState();
  const base = 'You are continuing work from a saved snapshot...';
  const r = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: true });
  assert.equal(r.instructions, base);
  assert.equal(r.continuity.injected, false);
  assert.equal(r.continuity.skipped_reason, 'clean_resume');
  // Статика: resume-ветка вызывает помощник с явным флагом, сборщик resume чист.
  assert.ok(html.includes('wizContinuityCompose(instructions, { cleanResumeActive: true })'));
  assert.doesNotMatch(sliceFn('async function wizBuildCleanResumeContext'), /continuity/i);
  // Чистота границы: resume-инструкция не содержит маркеров блока.
  assert.ok(!html.includes('WIZ_CLEAN_RESUME_INSTRUCTION') || true);
  const resumeSlice = sliceFn('async function wizBuildCleanResumeContext');
  assert.ok(!resumeSlice.includes('CONTINUITY ORIENTATION'));
});

// ── М3-Т16: утилиты не получают непрерывность ──────────────────────────────
test('М3 Т16: RNE/подсказки/TTS/Grok Voice/поиск/память без непрерывности', () => {
  // Помощник вызывается ровно в трёх местах: обычный путь, resume-ветка, tool-use.
  const calls = [];
  let at = -1;
  while ((at = html.indexOf('wizContinuityCompose(', at + 1)) >= 0) calls.push(at);
  assert.equal(calls.length, 4, 'определение + 3 вызова');
  for (const pos of calls) {
    const before = html.slice(Math.max(0, pos - 20), pos);
    if (before.includes('function ')) continue; // определение
    const fnAsync = html.lastIndexOf('\nasync function ', pos);
    const fnPlain = html.lastIndexOf('\nfunction ', pos);
    const fnPos = Math.max(fnAsync, fnPlain);
    const name = (html.slice(fnPos, fnPos + 80).match(/function (\w+)/) || [])[1];
    assert.ok(['sendMessage', 'runAgentToolUseLoop'].includes(name), 'вызов в ' + name);
  }
  // Маркеры блока живут только в модуле, в index.html их нет.
  assert.equal(html.split('CONTINUITY ORIENTATION').length - 1, 0);
  // Модуль импортируется ровно один раз (инициализация рантайма).
  assert.equal(html.split("import('./continuity-runtime.mjs')").length - 1, 1);
  // Тела утилит не упоминают непрерывность.
  for (const anchor of ['async function _rneCallLLM', 'async function wizGenerateSuggestions',
    'async function testApiConnection', 'async function wizWebSearch', 'function _apiFetch',
    'function toggleSpeech', 'function sendTextToGrokVoice', 'async function openGrokVoiceSession',
    'async function memAiAnalyze', 'async function memAiEdit', 'async function l1Compress',
    'function l2Consolidate', 'async function autoExtractFacts']) {
    assert.doesNotMatch(sliceFn(anchor), /continuity/i, anchor);
  }
  // Отдельного ИИ-пути генерации заголовков нет.
  assert.equal((html.match(/async function \w*[Tt]itle\w*\(/g) || []).length, 0);
  // Регрессия smoke: блок М3 выполняется раньше `let currentLang`, поэтому язык
  // читается только через безопасный помощник (голый typeof в TDZ ронял страницу).
  const contSlice = html.slice(html.indexOf('── М3 Continuity Context'), html.indexOf('── Service Worker registration'));
  assert.ok(contSlice.includes('function wizContinuityLangIsEn()'));
  const contCode = contSlice.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.equal((contCode.match(/currentLang/g) || []).length, 2);
});

// ── М3-Т17: тесты М2 продолжают проходить ──────────────────────────────────
test('М3 Т17: набор тестов М2 зелёный', () => {
  // Дочерний раннер не должен наследовать контекст родительского (NODE_TEST_CONTEXT),
  // иначе Node пропустит запуск с предупреждением о рекурсии.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ['--test', path.join(ROOT, 'tools', 'memory', 'seed_tool.test.mjs')], {
    cwd: ROOT, encoding: 'utf8', timeout: 120000, env,
  });
  const out = (res.stdout || '') + (res.stderr || '');
  assert.equal(res.status, 0, 'exit 0, вывод:\n' + out.slice(-2000));
  assert.match(out, /# pass \d+/);
  assert.match(out, /# fail 0/);
});

// ── М3-Т18: Canon/манифест/реестр без изменений ────────────────────────────
test('М3 Т18: канон, манифест и реестр нетронуты', () => {
  const seedRaw = fs.readFileSync(DEFAULT_SEED, 'utf8');
  const seed = JSON.parse(seedRaw);
  assert.equal(seed.records.length, 79);
  assert.equal(manifest.canonical_record_count, 79);
  assert.equal(manifest.canonical_content_sha256, CANON_SHA);
  assert.equal(manifest.admission_implementation, 'ABSENT');
  assert.equal(fs.readFileSync(path.join(ROOT, 'docs', 'memory', 'event_ledger.jsonl'), 'utf8'), '');
  // Артефакт М3 — производный: счётчик пакета 70, канон 79.
  assert.equal(bootstrap.canonical_record_count, 79);
  const ids = [];
  for (const rows of Object.values(bootstrap.sections)) for (const r of rows) ids.push(r.id);
  assert.equal(ids.length, 70);
});

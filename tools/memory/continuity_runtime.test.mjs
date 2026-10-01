// node --test tools/memory/continuity_runtime.test.mjs
// Тесты М3-Т1…Т24: read-only рантайм-мост непрерывности. Локальные,
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
  assert.equal(Runtime.buildContinuityBlock(ra, meta).length, 15357);
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
  // Статика: resume-ветка вызывает помощник с явным флагом (точное место — в allowlist Т16).
  assert.ok(html.includes('wizContinuityCompose(instructions, { cleanResumeActive: true })'));
});

// ── М3-Т16: утилиты не получают непрерывность ──────────────────────────────
// Доказательство — точный allowlist мест вызова (не хрупкие срезы тел функций):
// помощник существует в 4 местах исходника (1 определение + 3 вызова), каждый
// вызов — в разрешённой функции. Значит, ни одна утилита вызвать его не может.
test('М3 Т16: RNE/подсказки/TTS/Grok Voice/поиск/память без непрерывности', () => {
  const countOf = (s) => html.split(s).length - 1;
  assert.equal(countOf('wizContinuityCompose('), 4, 'определение + 3 вызова');
  assert.equal(countOf('function wizContinuityCompose('), 1, 'определение');
  assert.equal(countOf('wizContinuityCompose(instructions, { cleanResumeActive: false })'), 1, 'обычный путь sendMessage');
  assert.equal(countOf('wizContinuityCompose(instructions, { cleanResumeActive: true })'), 1, 'ветка Clean Resume');
  assert.equal(countOf('wizContinuityCompose(instructions, { cleanResumeActive: !!cleanResumeActive })'), 1, 'цикл инструментов агента');
  // Каждый вызов — внутри разрешённой функции (граница — предыдущее top-level function).
  const calls = [];
  let at = -1;
  while ((at = html.indexOf('wizContinuityCompose(', at + 1)) >= 0) calls.push(at);
  for (const pos of calls) {
    if (html.slice(Math.max(0, pos - 20), pos).includes('function ')) continue; // определение
    const fnPos = Math.max(html.lastIndexOf('\nasync function ', pos), html.lastIndexOf('\nfunction ', pos));
    const name = (html.slice(fnPos, fnPos + 80).match(/function (\w+)/) || [])[1];
    assert.ok(['sendMessage', 'runAgentToolUseLoop'].includes(name), 'вызов в ' + name);
  }
  // Литералы маркеров — только в регионе проводки М3 (редактор диагностики),
  // больше нигде в index.html их нет (в частности, ни в одной утилите).
  const m3Region = html.slice(html.indexOf('── М3 Continuity Context'), html.indexOf('── Service Worker registration'));
  assert.ok(m3Region.length > 1000, 'регион М3 найден');
  assert.equal(countOf('CONTINUITY ORIENTATION'), m3Region.split('CONTINUITY ORIENTATION').length - 1);
  assert.ok((m3Region.match(/CONTINUITY ORIENTATION/g) || []).length >= 3, 'редактор + плейсхолдер на месте');
  // Модуль импортируется ровно один раз (инициализация рантайма).
  assert.equal(countOf("import('./continuity-runtime.mjs')"), 1);
  // Отдельного ИИ-пути генерации заголовков нет.
  assert.equal((html.match(/async function \w*[Tt]itle\w*\(/g) || []).length, 0);
  // Регрессия smoke: блок М3 выполняется раньше `let currentLang`, поэтому язык
  // читается только через безопасный помощник (голый typeof в TDZ ронял страницу).
  assert.ok(m3Region.includes('function wizContinuityLangIsEn()'));
  const contCode = m3Region.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
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

// ── М3-Т19: протокол поколений закрывает гонку OFF/ON ───────────────────────
test('М3 Т19: протухший запрос не воскрешает состояние', () => {
  // Сценарий 1: ON → LOADING → OFF → поздний READY не восстанавливает ON.
  const t1 = Runtime.createContinuityRequestTracker();
  const a1 = t1.begin(); // запрос A в полёте
  t1.invalidate(); // владелец выключил
  assert.equal(t1.isCurrent(a1), false, 'A протух после OFF');
  // Сценарий 2: ON(A) → OFF → ON(B) → поздний A не затирает B.
  const t2 = Runtime.createContinuityRequestTracker();
  const a2 = t2.begin();
  t2.invalidate();
  const b2 = t2.begin();
  assert.equal(t2.isCurrent(a2), false, 'A протух');
  assert.equal(t2.isCurrent(b2), true, 'B актуален');
  // Штатный путь: запрос без переключений актуален.
  const t3 = Runtime.createContinuityRequestTracker();
  assert.equal(t3.isCurrent(t3.begin()), true);
});

// ── М3-Т20: проводка гонки в index.html ────────────────────────────────────
test('М3 Т20: refresh проверяет свежесть, OFF обесценивает', () => {
  // Локальный счётчик (нужен до асинхронной загрузки модуля): один источник.
  assert.equal(html.split('let _wizContinuitySeq = 0').length - 1, 1, 'счётчик');
  assert.equal(html.split('const _seq = ++_wizContinuitySeq').length - 1, 1, 'начало запроса');
  assert.equal(html.split('_wizContinuitySeq += 1').length - 1, 1, 'обесценивание на OFF');
  // Проверки свежести перед записями: после import, после load, в catch.
  const checks = html.split('if (_seq !== _wizContinuitySeq) return;').length - 1;
  assert.ok(checks >= 3, 'проверок свежести: ' + checks);
});

// ── М3-Т21: повторная композиция даёт ровно один блок ──────────────────────
test('М3 Т21: compose(compose(BASE)) → ровно один блок', async () => {
  const { blockText, coreMeta } = await readyState();
  const base = 'пользовательские инструкции\n\nсистемные сведения';
  const once = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false });
  const twice = Runtime.composeInstructions(once.instructions, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false });
  assert.equal(twice.instructions, once.instructions, 'идемпотентность');
  assert.equal(twice.continuity.injected, true);
  assert.equal(twice.instructions.split(Runtime.CONTINUITY_BLOCK_START).length - 1, 1);
  assert.equal(twice.instructions.split(Runtime.CONTINUITY_BLOCK_END).length - 1, 1);
  // Тройная композиция — тоже один блок, без BASE+BLOCK+BLOCK.
  const thrice = Runtime.composeInstructions(twice.instructions, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false });
  assert.equal(thrice.instructions, once.instructions);
});

// ── М3-Т22: OFF на собранном снимает блок ──────────────────────────────────
test('М3 Т22: OFF после composed → ноль блоков', async () => {
  const { blockText, coreMeta } = await readyState();
  const base = 'пользовательские инструкции\n\nсистемные сведения';
  const composed = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false }).instructions;
  const r = Runtime.composeInstructions(composed, { enabled: false, status: 'READY', blockText, coreMeta, cleanResumeActive: false });
  assert.equal(r.instructions, base, 'база восстановлена точно');
  assert.equal(r.continuity.injected, false);
  assert.equal(r.continuity.skipped_reason, 'disabled');
  assert.equal(r.instructions.split(Runtime.CONTINUITY_BLOCK_START).length - 1, 0);
});

// ── М3-Т23: Clean Resume на собранном снимает блок ─────────────────────────
test('М3 Т23: Clean Resume после composed → ноль блоков', async () => {
  const { blockText, coreMeta } = await readyState();
  const base = 'You are continuing work from a saved snapshot...';
  const composed = Runtime.composeInstructions(base, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false }).instructions;
  assert.equal(composed.split(Runtime.CONTINUITY_BLOCK_START).length - 1, 1);
  const r = Runtime.composeInstructions(composed, { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: true });
  assert.equal(r.instructions, base, 'чистая resume-граница');
  assert.equal(r.continuity.injected, false);
  assert.equal(r.continuity.skipped_reason, 'clean_resume');
});

// ── М3-Т24: диагностика редактируется, метаданные целы ─────────────────────
test('М3 Т24: в диагностике нет сырого блока', async () => {
  const { blockText, coreMeta } = await readyState();
  const composed = Runtime.composeInstructions('база', { enabled: true, status: 'READY', blockText, coreMeta, cleanResumeActive: false }).instructions;
  // Форма повторяет реальные записи wizRecordOutboundPayload (все провайдеры).
  const payload = {
    mode: 'normal',
    instructions: composed,
    messageWithFiles: 'вопрос пользователя',
    bodyMessages: [
      { role: 'system', content: composed },
      { role: 'user', content: [{ type: 'text', text: 'вопрос с картинкой' }] },
    ],
    system: composed,
    systemInstruction: { parts: [{ text: composed }] },
    userContent: 'вопрос пользователя',
    continuity: { enabled: true, status: 'READY', injected: true, canonical_sha: CANON_SHA, record_count: 35, char_count: blockText.length, skipped_reason: null },
    ts: 123,
  };
  const frozen = JSON.stringify(payload);
  const red = Runtime.redactContinuityDiagnostics(payload);
  const dumped = JSON.stringify(red);
  assert.equal(dumped.split(Runtime.CONTINUITY_BLOCK_START).length - 1, 0, 'сырых блоков нет');
  assert.ok((dumped.match(/CONTINUITY ORIENTATION — REDACTED/g) || []).length >= 4, 'плейсхолдеры на месте');
  assert.deepEqual(red.continuity, payload.continuity, 'метаданные сохранены');
  assert.equal(red.messageWithFiles, 'вопрос пользователя', 'чужой текст цел');
  assert.equal(red.bodyMessages[1].content[0].text, 'вопрос с картинкой', 'вложенные части целы');
  assert.equal(JSON.stringify(payload), frozen, 'вход не изменён');
  // Редактура идемпотентна.
  assert.deepEqual(Runtime.redactContinuityDiagnostics(red), red);
  // Статика: запись диагностики идёт через редактор (все вызовы — воронкой).
  assert.ok(html.includes('safe = wizRedactContinuityDeep(meta);'));
  assert.ok(html.includes('window.__wizLastOutboundPayload = safe;'));
});

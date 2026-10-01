// continuity-runtime.mjs — М3: read-only рантайм-мост непрерывности.
//
// Цепочка: Canon → М2-проверенный bootstrap → браузерный загрузчик → ограниченное
// runtime-ядро → существующие центральные `instructions` → выбранный провайдер/модель.
//
// READ ONLY: модуль только читает committed-артефакт и строит ограниченную проекцию.
// Никаких записей в Canon, манифест, реестр событий, admission или SNAP.
// FULL_BOOTSTRAP != RUNTIME_CORE: полный пакет М2 (70 записей) остаётся для
// аудита/деталей/ручного использования; в каждый запрос идёт только ядро.
//
// Без зависимостей. Работает и в браузере (ES-модуль через динамический import),
// и в Node (тесты). Чистые функции не трогают DOM, сеть и часы.
//
// Состояния рантайма: DISABLED | LOADING | READY | STALE | INTEGRITY_FAIL | LOAD_ERROR.
// Инжект разрешён ТОЛЬКО в READY. Любой сбой — закрытое поведение (FAIL CLOSED):
// частичный контекст не инжектится, тихого отката на устаревшее/битое нет.
// STALE выставляет приложение при неуспешной фоновой ревалидации после READY
// (последнее хорошее значение показывается в диагностике, но не инжектится).
//
// Композиция идемпотентна (ровно-однократность): перед решением помощник снимает
// все завершённые спаны блока, затем добавляет не более одного. Повторная
// композиция не даёт BASE+BLOCK+BLOCK; OFF и Clean Resume на уже собранных
// инструкциях снимают блок. Диагностические копии редактируются (redact):
// полный блок заменяется плейсхолдером, метаданные сохраняются.

export const CONTINUITY_SCHEMA = 'eiti-context-bootstrap/1';
export const CONTINUITY_ROLE = 'PROVIDER_NEUTRAL_ORIENTATION';

export const CONTINUITY_STATUS = {
  DISABLED: 'DISABLED',
  LOADING: 'LOADING',
  READY: 'READY',
  STALE: 'STALE',
  INTEGRITY_FAIL: 'INTEGRITY_FAIL',
  LOAD_ERROR: 'LOAD_ERROR',
};

// Ожидаемые секции проверенного пакета М2 (фиксированный порядок, как в М2).
export const EXPECTED_SECTIONS = ['who', 'north_star', 'current_priority', 'active_threads',
  'known', 'known_limitations', 'open', 'next', 'projects', 'sources', 'invariants'];

// Спецификация runtime-ядра: всегда-релевантная проекция для обычного взаимодействия.
// В ядро входят: WHO, NORTH_STAR, CURRENT_PRIORITY, ACTIVE_THREADS, записи NEXT_ACTION,
// PROJECTS, INVARIANTS. НЕ инжектятся автоматически: полный корпус KNOWN, все OPEN,
// детали SOURCE_POINTER, все KNOWN_LIMITATIONS, DEFERRED, исторические/вытесненные.
export const RUNTIME_CORE_SECTIONS = ['who', 'north_star', 'current_priority',
  'active_threads', 'next', 'projects', 'invariants'];

export const RUNTIME_CORE_SECTION_TITLES = {
  who: 'WHO',
  north_star: 'NORTH_STAR',
  current_priority: 'CURRENT_PRIORITY',
  active_threads: 'ACTIVE_THREADS',
  next: 'NEXT',
  projects: 'PROJECTS',
  invariants: 'INVARIANTS',
};

// В секции next ядро берёт только шаги; отложенное остаётся отложенным.
export const RUNTIME_CORE_NEXT_TYPES = ['NEXT_ACTION'];

// Поля записи, сохраняемые дословно (эпистемическая идентичность).
export const RUNTIME_RECORD_FIELDS = ['id', 'type', 'status', 'statement', 'source',
  'provenance', 'scope', 'updated_at', 'details_pointer'];

// Маркеры единственного блока непрерывности в исходящих инструкциях.
export const CONTINUITY_BLOCK_START = '[CONTINUITY ORIENTATION — READ ONLY]';
export const CONTINUITY_BLOCK_END = '[/CONTINUITY ORIENTATION]';
// Плейсхолдер для диагностических копий: полный блок не логируется.
export const CONTINUITY_REDACTED_PLACEHOLDER = '[CONTINUITY ORIENTATION — REDACTED]';

// Эвристика оценки токенов: ~4 символа на токен (смешанный RU/EN текст).
// Используется только для отчётности, не для усечения (усечения нет).
export const CHARS_PER_TOKEN = 4;

// ── Проверка загруженного пакета ──────────────────────────────────────────
// Чистая функция: сверяет пакет М2 с манифестом. FAIL CLOSED: при любом
// нарушении ok=false, статус INTEGRITY_FAIL, список явных ошибок.
export function verifyBootstrap(bootstrap, manifest) {
  const errors = [];
  if (!bootstrap || typeof bootstrap !== 'object' || Array.isArray(bootstrap)) {
    errors.push('пакет: не объект');
  } else {
    if (bootstrap.schema !== CONTINUITY_SCHEMA) {
      errors.push('пакет: schema ' + JSON.stringify(bootstrap.schema) + ', ожидалось ' + JSON.stringify(CONTINUITY_SCHEMA));
    }
    if (bootstrap.role !== CONTINUITY_ROLE) {
      errors.push('пакет: role ' + JSON.stringify(bootstrap.role) + ', ожидалось ' + JSON.stringify(CONTINUITY_ROLE));
    }
    if (typeof bootstrap.canonical_content_sha256 !== 'string' || !bootstrap.canonical_content_sha256) {
      errors.push('пакет: нет canonical_content_sha256');
    }
    if (!Number.isFinite(bootstrap.canonical_record_count)) {
      errors.push('пакет: нет canonical_record_count');
    }
    const sections = bootstrap.sections;
    if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
      errors.push('пакет: нет sections');
    } else {
      for (const key of EXPECTED_SECTIONS) {
        const rows = sections[key];
        if (!Array.isArray(rows)) {
          errors.push('пакет: секция ' + key + ' отсутствует или не массив');
          continue;
        }
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r || typeof r !== 'object') {
            errors.push('пакет: секция ' + key + '[' + i + '] не объект');
            continue;
          }
          for (const f of RUNTIME_RECORD_FIELDS) {
            if (typeof r[f] !== 'string' || !r[f]) {
              errors.push('пакет: запись ' + (r.id || (key + '[' + i + ']')) + ': поле ' + f + ' отсутствует');
              break;
            }
          }
        }
      }
    }
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('манифест: не объект');
  } else {
    if (typeof manifest.canonical_content_sha256 !== 'string' || !manifest.canonical_content_sha256) {
      errors.push('манифест: нет canonical_content_sha256');
    }
    if (!Number.isFinite(manifest.canonical_record_count)) {
      errors.push('манифест: нет canonical_record_count');
    }
  }
  // Сверка пакета с манифестом — только если обе стороны читаемы.
  if (errors.length === 0) {
    if (bootstrap.canonical_content_sha256 !== manifest.canonical_content_sha256) {
      errors.push('сверка SHA: пакет ' + bootstrap.canonical_content_sha256
        + ', манифест ' + manifest.canonical_content_sha256);
    }
    if (bootstrap.canonical_record_count !== manifest.canonical_record_count) {
      errors.push('сверка счётчика: пакет ' + bootstrap.canonical_record_count
        + ', манифест ' + manifest.canonical_record_count);
    }
  }
  const ok = errors.length === 0;
  return { ok, status: ok ? CONTINUITY_STATUS.READY : CONTINUITY_STATUS.INTEGRITY_FAIL, errors };
}

// ── Отбор runtime-ядра ────────────────────────────────────────────────────
// Чистая детерминированная проекция уже проверенного пакета М2.
// Порядок записей — порядок пакета (порядок канона). Без LLM-суммаризации,
// без семантического переписывания, без усечения отдельных записей.
// Защита в глубину: HISTORICAL/SUPERSEDED и DEFERRED_ITEM отбрасываются,
// даже если вдруг окажутся в проверяемом пакете (М2 их уже исключил из ядра).
export function selectRuntimeCore(bootstrap) {
  const sections = bootstrap && bootstrap.sections;
  if (!sections || typeof sections !== 'object') {
    throw new Error('ядро: пакет без sections');
  }
  for (const key of RUNTIME_CORE_SECTIONS) {
    if (!Array.isArray(sections[key])) {
      throw new Error('ядро: секция ' + key + ' отсутствует');
    }
  }
  const isLive = (r) => r.status !== 'HISTORICAL' && r.status !== 'SUPERSEDED'
    && r.type !== 'DEFERRED_ITEM' && r.status !== 'DEFERRED';
  const out = {};
  for (const key of RUNTIME_CORE_SECTIONS) {
    const rows = sections[key].filter(isLive);
    out[key] = key === 'next'
      ? rows.filter((r) => RUNTIME_CORE_NEXT_TYPES.includes(r.type))
      : rows;
  }
  const records = [];
  for (const key of RUNTIME_CORE_SECTIONS) {
    for (const r of out[key]) records.push(r);
  }
  // Детерминированные счётчики исключённого (для подвала блока).
  const deferredInNext = Array.isArray(sections.next)
    ? sections.next.filter((r) => r.type === 'DEFERRED_ITEM' || r.status === 'DEFERRED').length
    : 0;
  const excludedCounts = {
    known: Array.isArray(sections.known) ? sections.known.length : 0,
    known_limitations: Array.isArray(sections.known_limitations) ? sections.known_limitations.length : 0,
    open: Array.isArray(sections.open) ? sections.open.length : 0,
    sources: Array.isArray(sections.sources) ? sections.sources.length : 0,
    deferred: deferredInNext,
  };
  const excludedTotal = excludedCounts.known + excludedCounts.known_limitations
    + excludedCounts.open + excludedCounts.sources + excludedCounts.deferred;
  return { sections: out, records, excludedCounts, excludedTotal };
}

// ── Рендер ядра ───────────────────────────────────────────────────────────
// Детерминированный построчный рендер: две строки на запись, те же формулировки,
// что в МД-пакете М2. Записи не усекаются и не переписываются.
function renderRecord(r) {
  const first = '- ' + r.id + ' [' + r.type + ' · ' + r.status + '] ' + r.statement;
  const second = '  - источник: ' + r.source + '; происхождение: ' + r.provenance
    + '; охват: ' + r.scope + '; обновлено: ' + r.updated_at + '; детали: ' + r.details_pointer;
  return first + '\n' + second;
}

export function renderRuntimeCore(core) {
  const out = [];
  for (const key of RUNTIME_CORE_SECTIONS) {
    out.push('## ' + RUNTIME_CORE_SECTION_TITLES[key]);
    for (const r of core.sections[key]) out.push(renderRecord(r));
    out.push('');
  }
  // Убираем последний пустой хвост, но формат внутри фиксирован.
  const text = out.join('\n').replace(/\n$/, '');
  const recordCount = core.records.length;
  const charCount = text.length;
  const approxTokens = Math.round(charCount / CHARS_PER_TOKEN);
  return { text, recordCount, charCount, approxTokens };
}

// ── Сборка единственного блока ────────────────────────────────────────────
// Явно фиксирует read-only семантику: модель вправе ИСПОЛЬЗОВАТЬ контекст
// для ответа, но НЕ вправе трактовать ответ как обновление памяти.
export function buildContinuityBlock(rendered, meta) {
  const sha = meta.canonicalSha;
  const count = meta.canonicalCount;
  const excl = meta.excludedCounts;
  const head = [
    CONTINUITY_BLOCK_START,
    'Read-only ориентация для текущей сессии. Источник — проверенный производный пакет М2 (eiti-context-bootstrap/1), НЕ канон.',
    'Канон: docs/memory/ruslan-orientation-seed.json (' + count + ' записей, SHA-256 ' + sha + '). '
      + 'Runtime-ядро: ' + rendered.recordCount + ' записей, ' + rendered.charCount + ' символов, ~'
      + rendered.approxTokens + ' токенов.',
    'BOOTSTRAP != CANON. MODEL != MEMORY_OWNER. PROVIDER != MEMORY_OWNER. MODEL_OUTPUT != CANON.',
    'MODEL_PROPOSAL != USER_DECISION. UNKNOWN != FALSE. CURRENT_STATE != HISTORY. RESEARCH_RESULT != VERIFIED_TRUTH.',
    'CONTINUITY_READ_ONLY: у тебя нет полномочий писать Canon/seed/manifest/ledger/admission — ни ответом, ни инструментами.',
    'CONTINUITY_READ_ONLY != GLOBAL_EITI_READ_ONLY: заметки, задачи, файлы и память Eiti — обычные рабочие области.',
    'Не зеркаль записи ориентации в EITI Memory/заметки/задачи/файлы лишь потому, что они здесь упомянуты.',
    'Используй этот контекст для ответа. НЕ трактуй свой ответ как обновление памяти: ответ не становится памятью и не меняет канон.',
    'EITI Memory, wiz_ref, история чата и SNAP — отдельные сущности; ни одна из них НЕ является каноном непрерывности.',
    '',
  ].join('\n');
  const tail = '\n\nПолный пакет М2 шире runtime-ядра; исключено здесь: KNOWN ' + excl.known
    + ', KNOWN_LIMITATIONS ' + excl.known_limitations + ', OPEN ' + excl.open
    + ', SOURCES ' + excl.sources + ', DEFERRED ' + excl.deferred + ' (полный пакет — вручную).'
    + '\n' + CONTINUITY_BLOCK_END;
  return head + '\n' + rendered.text + tail;
}

// ── Спаны блока: снятие и редактура ─────────────────────────────────────────
// Каноническая семантика спанов (ею же пользуется запасной редактор в index.html):
// обрабатываются только ЗАВЕРШЁННЫЕ спаны START..первый END после него.
// Незавершённый хвостовой START не трогаем (не наши данные — не выдумываем конец).
// Идемпотентно: повторный прогон ничего не меняет.
function mapContinuitySpans(text, replacement) {
  if (typeof text !== 'string' || text.indexOf(CONTINUITY_BLOCK_START) === -1) return text;
  let out = text;
  for (;;) {
    const s = out.indexOf(CONTINUITY_BLOCK_START);
    if (s === -1) break;
    const e = out.indexOf(CONTINUITY_BLOCK_END, s + CONTINUITY_BLOCK_START.length);
    if (e === -1) break;
    out = out.slice(0, s) + replacement + out.slice(e + CONTINUITY_BLOCK_END.length);
  }
  return out;
}

// Снимает все завершённые спаны блока и нормализует стык: схлопывает 3+ перевода
// строки в два и убирает хвостовые пробелы (точно восстанавливает базу нашей
// собственной сборки BASE+'\n\n'+BLOCK). Начало строки не трогаем.
export function stripContinuityBlocks(text) {
  if (typeof text !== 'string') return text;
  return mapContinuitySpans(text, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

// Заменяет каждый завершённый спан плейсхолдером для диагностических копий.
// Полный контекст в логи не попадает; позиции остального текста не сдвигаются
// нормализацией (её здесь нет — только замена спанов).
export function redactContinuityBlocks(text, placeholder) {
  if (typeof text !== 'string') return text;
  const ph = typeof placeholder === 'string' ? placeholder : CONTINUITY_REDACTED_PLACEHOLDER;
  return mapContinuitySpans(text, ph);
}

// Глубокая редактура диагностического объекта: рекурсивно правит все строки
// (instructions, bodyMessages, system, systemInstruction и любые вложенные),
// возвращает НОВЫЙ объект, вход не меняет. Метаданные continuity не трогаем.
export function redactContinuityDiagnostics(value) {
  if (typeof value === 'string') return redactContinuityBlocks(value);
  if (Array.isArray(value)) return value.map(redactContinuityDiagnostics);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = redactContinuityDiagnostics(value[k]);
    return out;
  }
  return value;
}

// ── Трекер поколений асинхронных запросов ──────────────────────────────────
// Протокол защиты от гонки владельца OFF/ON: каждый refresh берёт поколение
// через begin(), выключение обесценивает pending через invalidate(), перед
// каждой записью состояния проверяется isCurrent(). Протухший запрос обязан
// молча выйти и ничего не писать. Тот же протокол встроен в index.html
// (там счётчик локальный — нужен до асинхронной загрузки модуля).
export function createContinuityRequestTracker() {
  let seq = 0;
  return {
    begin() { seq += 1; return seq; },
    invalidate() { seq += 1; },
    isCurrent(id) { return id === seq; },
  };
}

// ── Композиция инструкций ─────────────────────────────────────────────────
// Единственная точка инжекта М3. Чистая идемпотентная функция: сначала снимает
// все завершённые спаны блока с базы, затем добавляет не более одного — и только
// при включённой настройке, статусе READY и неактивном Clean Resume.
// compose(compose(BASE)) даёт ровно один блок; OFF и Clean Resume на уже
// собранных инструкциях блок снимают. Никогда BASE+BLOCK+BLOCK.
// skipped_reason: null | 'clean_resume' | 'disabled' | 'integrity_fail'.
// В 'integrity_fail' свернуты все неготовые состояния (LOADING/STALE/
// INTEGRITY_FAIL/LOAD_ERROR/отсутствие блока): точное состояние видно в status.
export function composeInstructions(baseInstructions, opts) {
  const o = opts || {};
  const enabled = o.enabled === true;
  const status = typeof o.status === 'string' ? o.status : CONTINUITY_STATUS.DISABLED;
  const cleanResumeActive = o.cleanResumeActive === true;
  const blockText = typeof o.blockText === 'string' ? o.blockText : null;
  const coreMeta = o.coreMeta || {};
  const continuity = {
    enabled,
    status,
    injected: false,
    canonical_sha: typeof coreMeta.canonical_sha === 'string' ? coreMeta.canonical_sha : null,
    record_count: Number.isFinite(coreMeta.record_count) ? coreMeta.record_count : 0,
    char_count: Number.isFinite(coreMeta.char_count) ? coreMeta.char_count : 0,
    skipped_reason: null,
  };
  // Ровно-однократность: работаем только с очищенной базой.
  const clean = stripContinuityBlocks(baseInstructions);
  if (typeof clean !== 'string') {
    continuity.skipped_reason = 'integrity_fail';
    return { instructions: baseInstructions, continuity };
  }
  // Чистота исходящей границы Clean Resume — абсолютный приоритет.
  if (cleanResumeActive) {
    continuity.skipped_reason = 'clean_resume';
    return { instructions: clean, continuity };
  }
  if (!enabled) {
    continuity.skipped_reason = 'disabled';
    return { instructions: clean, continuity };
  }
  if (status !== CONTINUITY_STATUS.READY || !blockText) {
    continuity.skipped_reason = 'integrity_fail';
    return { instructions: clean, continuity };
  }
  continuity.injected = true;
  return { instructions: clean ? clean + '\n\n' + blockText : blockText, continuity };
}

// ── Загрузчик ─────────────────────────────────────────────────────────────
// Читает committed-артефакт и манифест с того же источника, проверяет,
// строит ядро и блок. Никогда не возвращает частичный контекст: при любом
// сбое blockText=null. fetchFn инжектится для тестов (по умолчанию globalThis.fetch).
export async function loadContinuityRuntime({ bootstrapUrl, manifestUrl, fetchFn } = {}) {
  const fetchImpl = fetchFn || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { status: CONTINUITY_STATUS.LOAD_ERROR, errors: ['загрузчик: fetch недоступен'], blockText: null, core: null, rendered: null, meta: null };
  }
  let bootstrapJson = null;
  let manifestJson = null;
  try {
    const [bootstrapRes, manifestRes] = await Promise.all([
      fetchImpl(bootstrapUrl, { cache: 'no-store' }),
      fetchImpl(manifestUrl, { cache: 'no-store' }),
    ]);
    if (!bootstrapRes || bootstrapRes.ok !== true) {
      return { status: CONTINUITY_STATUS.LOAD_ERROR, errors: ['загрузчик: пакет недоступен (HTTP ' + (bootstrapRes && bootstrapRes.status) + ')'], blockText: null, core: null, rendered: null, meta: null };
    }
    if (!manifestRes || manifestRes.ok !== true) {
      return { status: CONTINUITY_STATUS.LOAD_ERROR, errors: ['загрузчик: манифест недоступен (HTTP ' + (manifestRes && manifestRes.status) + ')'], blockText: null, core: null, rendered: null, meta: null };
    }
    try {
      bootstrapJson = await bootstrapRes.json();
    } catch (e) {
      return { status: CONTINUITY_STATUS.LOAD_ERROR, errors: ['загрузчик: пакет не разобран как JSON (' + (e && e.message) + ')'], blockText: null, core: null, rendered: null, meta: null };
    }
    try {
      manifestJson = await manifestRes.json();
    } catch (e) {
      return { status: CONTINUITY_STATUS.LOAD_ERROR, errors: ['загрузчик: манифест не разобран как JSON (' + (e && e.message) + ')'], blockText: null, core: null, rendered: null, meta: null };
    }
  } catch (e) {
    return { status: CONTINUITY_STATUS.LOAD_ERROR, errors: ['загрузчик: сеть недоступна (' + (e && e.message) + ')'], blockText: null, core: null, rendered: null, meta: null };
  }
  const verdict = verifyBootstrap(bootstrapJson, manifestJson);
  if (!verdict.ok) {
    return { status: CONTINUITY_STATUS.INTEGRITY_FAIL, errors: verdict.errors, blockText: null, core: null, rendered: null, meta: null };
  }
  let core;
  try {
    core = selectRuntimeCore(bootstrapJson);
  } catch (e) {
    return { status: CONTINUITY_STATUS.INTEGRITY_FAIL, errors: ['загрузчик: ядро не построено (' + (e && e.message) + ')'], blockText: null, core: null, rendered: null, meta: null };
  }
  const rendered = renderRuntimeCore(core);
  const blockText = buildContinuityBlock(rendered, {
    canonicalSha: bootstrapJson.canonical_content_sha256,
    canonicalCount: manifestJson.canonical_record_count,
    excludedCounts: core.excludedCounts,
  });
  const meta = {
    canonical_sha: bootstrapJson.canonical_content_sha256,
    canonical_count: manifestJson.canonical_record_count,
    record_count: rendered.recordCount,
    char_count: rendered.charCount + (blockText.length - rendered.text.length),
    approx_tokens: Math.round(blockText.length / CHARS_PER_TOKEN),
  };
  return { status: CONTINUITY_STATUS.READY, errors: [], bootstrap: bootstrapJson, manifest: manifestJson, core, rendered, blockText, meta };
}

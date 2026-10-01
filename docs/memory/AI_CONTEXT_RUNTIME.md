# Read-only рантайм-мост непрерывности (М3)

Первый read-only мост между каноном непрерывности и рантаймом браузера:
выбранный в Eiti Wizard Lab провайдер/модель автоматически получает ограниченную
ориентацию без ручного копирования. Переключение провайдера/модели в чате не требует
повторного копирования orientation Руслана.

Цепочка: Canon → М2-проверенный bootstrap → браузерный загрузчик →
ограниченное runtime-ядро → существующие центральные `instructions` →
штатная провайдерная сериализация → выбранный провайдер/модель.

М3 — READ ONLY. Автозаписей в Canon нет. Admission нет. Записей в реестр
событий нет. `ADMISSION_IMPLEMENTATION=ABSENT`.

    20|## Производный артефакт (RUNTIME_BOOTSTRAP != CANON)

Браузер не отбирает записи канона самостоятельно. Он читает один committed
производный артефакт, собранный официальной публичной точкой М2:

```bash
node tools/memory/seed_tool.mjs export-context --format json --out docs/memory/context-bootstrap.runtime.json
```

Кли вызывает ровно `exportContext({ format: 'json' })` (внутри — ворота
`validate→count→SHA-256→export`). Сырые генераторы пакета не входят в публичный
API и для сборки артефакта не используются. Тест М3-Т1 требует побайтового
совпадения committed-артефакта с текущим официальным экспортом М2; при расхождении —
FAIL. Тихая регенерация во время работы браузера запрещена.

## Загрузчик (`continuity-runtime.mjs`)

Отдельный модуль без зависимостей (не монолитный `index.html`). Работает и в
браузере (ES-модуль через динамический `import`), и в Node (тесты).

1. Читает с того же источника `docs/memory/context-bootstrap.runtime.json`
   и `docs/memory/manifest.json` (`fetch`, `cache: 'no-store'` где применимо).
2. Разбирает оба JSON.
3. Проверяет минимум:
   - `bootstrap.schema == "eiti-context-bootstrap/1"`;
   - `bootstrap.role == "PROVIDER_NEUTRAL_ORIENTATION"`;
   - `bootstrap.canonical_content_sha256 == manifest.canonical_content_sha256`;
   - `bootstrap.canonical_record_count == manifest.canonical_record_count`;
   - все 11 ожидаемых секций существуют, каждая запись несёт 9 полей дословно.
4. При любом нарушении — `INTEGRITY_FAIL` (схема/роль/хэш/счётчик/секции) или
   `LOAD_ERROR` (сеть/HTTP/разбор JSON). Частичный контекст не инжектится.
   FAIL CLOSED: тихого отката на устаревшее/битое нет.

Состояния рантайма: `DISABLED | LOADING | READY | STALE | INTEGRITY_FAIL | LOAD_ERROR`.
Инжект разрешён ТОЛЬКО в `READY`. `STALE` выставляет приложение при неуспешной
фоновой ревалидации после `READY`: последнее хорошее значение видно в диагностике,
но не инжектится.

Оговорка про Service Worker: `sw.js` отдаёт некэшированную статику по схеме
cache-first после первого чтения; runtime-файлы в предзагрузку не входят.
Загрузчик просит `no-store`, но при включённом SW первое чтение может осесть
в кэше SW. При ротации канона обновляйте `CACHE_NAME` в `sw.js` (штатная процедура
проекта) либо делайте жёсткую перезагрузку. Расхождение пакета и манифеста
любого происхождения даёт `INTEGRITY_FAIL`, а не тихую подмену.

## Runtime-ядро (FULL_BOOTSTRAP != RUNTIME_CORE)

М2 — полный текущий пакет (70 записей) для аудита/деталей/ручного использования.
М3 — ограниченная детерминированная проекция для обычного взаимодействия.
Весь 70-записный пакет в каждый запрос НЕ инжектится.

Отбор из уже проверенного пакета (порядок канона, без LLM-суммаризации,
без семантического переписывания, без усечения отдельных записей):

| В ядре | Исключено |
|---|---|
| `who` (3), `north_star` (5), `current_priority` (2) | `known` (6) — полный корпус |
| `active_threads` (4: `CURRENT` + явные `UNKNOWN`) | `open` (9) — все вопросы |
| `next`: только `NEXT_ACTION` (3) | `next`: `DEFERRED_ITEM` отложены |
| `projects` (12), `invariants` (6) | `known_limitations` (3), `sources` (11) |

Защита в глубину: `HISTORICAL`/`SUPERSEDED` и `DEFERRED` отбрасываются отбором,
даже если вдруг окажутся в пакете (М2 их уже исключил).

Включённые записи сохраняют эпистемическую идентичность дословно:
`id`, `type`, `status`, `statement`, `source`, `provenance`, `scope`,
`updated_at`, `details_pointer`. `UNKNOWN` остаётся `UNKNOWN`, `RESEARCH_RESULT`
не становится истиной, `MODEL_PROPOSAL` — решением пользователя.

Замер на текущем каноне (детерминирован, тест М3-Т6):

- записей ядра: **35** (исключено 35);
- ядро: **14058 символов**, ~**3515 токенов**;
- полный инжектируемый блок (ядро + read-only шапка/подвал): **15024 символа**,
  ~**3756 токенов** (эвристика ~4 символа на токен, только для отчётности).

Жёсткий лимит не вводился: измеренный размер уже разумен для каждого запроса,
усечения нет, половина записей не нужна. Если будущий канон раздует ядро за
разумную границу — это задача отдельной архитектуры (не М3): тихое усечение
запрещено, усечение половины записи запрещено, семантическое переписывание
запрещено.

## Инжект

Одна точка композиции — существующий центральный путь `instructions` в
`sendMessage()`: пользовательские/системные инструкции + сведения Eiti +
ровно один блок `[CONTINUITY ORIENTATION — READ ONLY] … [/CONTINUITY ORIENTATION]`.
Провайдерная сериализация ниже (DeepSeek/OpenAI system message, Claude `system`,
Gemini `systemInstruction`, Groq/OpenRouter/Grok/Ollama) не менялась.
MODEL ROUTING != MEMORY AUTHORITY: смена провайдера/модели не меняет семантику
блока — блок один, кэширован, от провайдера не зависит.

Единый помощник `wizContinuityCompose()` (тонкая обёртка над чистой
`composeInstructions()` модуля) вызывается ровно в трёх местах:

1. обычный путь `sendMessage()` (чат и агент) — инжект при `READY`;
2. ветка Clean Resume — явный пропуск (`CLEAN_RESUME_OUTBOUND_PURITY`);
3. цикл нативных инструментов агента (`runAgentToolUseLoop`, DeepSeek/Gemini) —
   тот же помощник, тот же блок (инструменты агента Canon не меняют:
   они пишут только в заметки/файлы/память/задачи/чаты IndexedDB).

Блок явно фиксирует: контекст — read-only orientation; `BOOTSTRAP != CANON`;
`MODEL != MEMORY_OWNER`; `PROVIDER != MEMORY_OWNER`; `MODEL_OUTPUT != CANON`;
`MODEL_PROPOSAL != USER_DECISION`; `UNKNOWN != FALSE`; `CURRENT_STATE != HISTORY`.
Модель вправе ИСПОЛЬЗОВАТЬ контекст для ответа, но НЕ вправе трактовать ответ
как обновление памяти.

Существующая память Eiti не redesigned: локальная личная память, EITI Memory,
`wiz_ref`, история чатов и SNAP сохранены. EITI local personal memory != Canon;
`wiz_ref` != Canon; chat history != Canon; runtime continuity context != Canon.

## Clean Resume

При `wizIsCleanResumeActive(...) == true`: `CONTINUITY_INJECTION = SKIPPED`
(`CLEAN_RESUME_OUTBOUND_PURITY`). Ядро не добавляется ни в resume-инструкции,
ни в тело снимка, ни в пост-граничные сообщения. Регрессия покрыта тестом М3-Т15.
Композиция SNAP + Continuity — отдельная будущая задача, не М3.

## Нецелевые вызовы (без непрерывности)

М3 действует ТОЛЬКО на главном пути Чат/Агент `sendMessage()`. Не инжектят:
RNE-утилита (`_rneCallLLM`), подсказки (`wizGenerateSuggestions`), анализ/правка
памяти (`memAiAnalyze`/`memAiEdit`), L1/L2-утилиты (`l1Compress`/`l2Consolidate`),
TTS (`_apiFetch`/`toggleSpeech`), Grok Voice (`sendTextToGrokVoice`), веб-поиск
(`wizWebSearch`), проверка подключения (`testApiConnection`). Отдельного
ИИ-пути генерации заголовков в приложении нет. Покрыто тестом М3-Т16.

## Настройка владельца

Карточка настроек «Continuity Context»: OFF | ON. По умолчанию OFF — явное
включение владельцем (соглашение проекта для новых инжектов: тумблер в
`localStorage`, см. `wiz_lab_agent_tooluse`). Хранение: `localStorage`
`wiz_lab_continuity_enabled` (`1`/`0`). Компактный статус: Готов / Ошибка
целостности / Ошибка загрузки / Устарело / Выключено (+ счётчик записей/токенов
в READY). Сырой канон в UI не показывается.

## Наблюдаемость

Исходящая диагностика (`wizRecordOutboundPayload`, `window._wizContinuityLastMeta`,
без секретов, полный контекст не логируется):

```json
{ "continuity": { "enabled": true, "status": "READY", "injected": true,
  "canonical_sha": "e0ee19c4…", "record_count": 35, "char_count": 15024,
  "skipped_reason": null } }
```

`skipped_reason`: `null | "clean_resume" | "disabled" | "integrity_fail"`
(`integrity_fail` покрывает все неготовые состояния; точное — в `status`).

## Файлы

| Файл | Роль |
|---|---|
| `continuity-runtime.mjs` | Загрузчик + ядро + композиция (чистые функции + `fetch`-загрузчик) |
| `index.html` | UI-настройка, инициализация, 3 вызова помощника, диагностика |
| `docs/memory/context-bootstrap.runtime.json` | Производный артефакт (DERIVED, из `exportContext`) |
| `docs/memory/AI_CONTEXT_RUNTIME.md` | Этот документ |
| `tools/memory/continuity_runtime.test.mjs` | Тесты М3-Т1…Т18 |

Не менялись: `docs/memory/ruslan-orientation-seed.json`,
`docs/memory/manifest.json`, `docs/memory/event_ledger.jsonl`, содержимое Canon,
политика/реализация admission, семантика провайдеров, содержимое SNAP,
эпистемология `wiz_ref`.

Не-цели (не реализованы): Memory Admission Controller; записи модель→Canon;
автопись реестра; семантический/векторный поиск; эмбеддинги; динамическое
ранжирование; суммаризация диалогов; авто-композиция SNAP+Continuity;
инжект всех 70 записей; копии памяти под провайдеры; новая БД;
мультиагентная оркестрация; М4.

# Провайдер-нейтральный контекст (М2): eiti-context-bootstrap/1

Производный ориентационный пакет для чтения любым ИИ.
Роль: `PROVIDER_NEUTRAL_ORIENTATION`. Носитель: `М1`.
Схема: `eiti-context-bootstrap/1`.

Пакет собирается только из канона и манифеста. Без сети, моделей, эмбеддингов,
провайдеров, чата и вывода. Пересобирается из канона в любой момент.

## Цепочка: КАНОН → целостность → отбор → пакет → чтение ИИ

1. **КАНОН** — только `docs/memory/ruslan-orientation-seed.json`
   (79 записей, SHA-256 `e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0`).
2. **Ворота целостности (FAIL CLOSED)** — до любого экспорта:
   - валидация seed существующим валидатором;
   - число записей == `manifest.canonical_record_count`;
   - SHA-256 файла == `manifest.canonical_content_sha256`.
   При любом нарушении — ненулевой exit, явное сообщение, какая проверка
   провалена (1/3, 2/3, 3/3). Никакого silent repair.
3. **Отбор** — один общий детерминированный селектор
   (`selectBootstrapSections` в `tools/memory/seed_tool.mjs`, тот же селектор
   использует `render-start-view`):
   - правило: фильтр по типу + исключение `HISTORICAL`/`SUPERSEDED`;
   - порядок внутри секций — порядок канона;
   - итог: 70 записей (79 минус 9 исторических/superseded).
4. **Пакет** — JSON или МД с одинаковым упорядоченным набором ИД.
5. **Чтение ИИ** — модель читает пакет как ориентацию, а не как истину.

## Команды

```bash
node tools/memory/seed_tool.mjs export-context --format json
node tools/memory/seed_tool.mjs export-context --format md
node tools/memory/seed_tool.mjs export-context --format json --out /tmp/bootstrap.json
node tools/memory/seed_tool.mjs export-context --format md --out /tmp/bootstrap.md
```

Необязательные флаги `--seed <путь>` и `--manifest <путь>` (по умолчанию —
канонические файлы). Флаг `--out <путь>` пишет в файл, иначе — в stdout.

Кли и весь программный доступ идут через одну публичную точку
`exportContext({ format, seedPath, manifestPath })`, которая всегда выполняет
ворота целостности и бросает исключение при любом нарушении, не возвращая
пакет из непроверенного канона (`UNVERIFIED CANON ↛ BOOTSTRAP`).
Помощники `buildBootstrap` / `renderBootstrapJson` / `renderBootstrapMarkdown` —
внутренние чистые функции для уже проверенных данных, а не публичный API.

## Секции (11)

| Секция | Отбор |
|---|---|
| `who` | `USER_IDENTITY`, без истории (3) |
| `north_star` | `USER_GOAL` + `USER_MOTIVATION`, без истории (5) |
| `current_priority` | `CURRENT_PRIORITY`, без истории (2) |
| `active_threads` | `ACTIVE_THREAD`, без истории: `CURRENT` + явные `UNKNOWN` (4) |
| `known` | `RESEARCH_RESULT`, точный статус `RESEARCH_RESULT`/`ENGINEERING_RESULT` (6) |
| `known_limitations` | `KNOWN_LIMITATION`, статусы как есть (3) |
| `open` | `OPEN_QUESTION`, `OPEN` + явный `UNKNOWN` (9) |
| `next` | `NEXT_ACTION` + явные `DEFERRED_ITEM` (3+6) |
| `projects` | `PROJECT_POINTER` (12) |
| `sources` | `SOURCE_POINTER` (11) |
| `invariants` | `INVARIANT` (6) |

Каждая запись сохраняет дословно 9 полей:
`id`, `type`, `status`, `statement`, `source`, `provenance`, `scope`,
`updated_at`, `details_pointer`.

Без схлопывания эпистемологии:
`UNKNOWN` не становится `FALSE`, `HYPOTHESIS` — фактом,
`RESEARCH_RESULT` — верифицированной истиной, `AI_SUMMARY` — заявлением
пользователя, `MODEL_PROPOSAL` — решением пользователя,
`SUPERSEDED` — удалённым. `SUPERSEDED` не выдаются за текущее,
`HISTORICAL` не продвигаются, `DEFERRED` остаются отложенными,
`UNKNOWN` остаются явными.

## Форматы

**JSON**: объект со схемой, ролью, `carrier_version: M1`,
`canonical_content_sha256`, `canonical_record_count`, `seed_version`,
`as_of` (из `seed.as_of`, без wall-clock `generated_at`),
`interpretation_rules` и `sections` (11 секций в фиксированном порядке).

**МД**: начинается с границы ориентации (не абсолютная истина; хранить
статус/происхождение; `UNKNOWN!=FALSE`; `MODEL_PROPOSAL!=USER_DECISION`;
`CURRENT_STATE!=HISTORY`; детали — по `details_pointer`).
Те же ИД и тот же порядок, что в JSON. Никаких выдуманных утверждений сверх
записей канона и фиксированных заголовков.

Детерминизм: те же seed+manifest+tool дают побайтово одинаковые JSON и МД.
Без случайности и без часов.

## Границы (читать обязательно)

- `BOOTSTRAP!=CANON`: пакет — производная выжимка, канон — только seed-файл.
- `BOOTSTRAP!=FULL HISTORY`: история исключена из текущих секций.
- `BOOTSTRAP!=MEMORY ADMISSION`: чтение не записывает память.
  `ADMISSION_IMPLEMENTATION=ABSENT`.
- `BOOTSTRAP!=USER DECISION`: предложение модели — не решение пользователя.
- `MODEL READING BOOTSTRAP != MODEL OWNING MEMORY`:
  читающая модель (и её провайдер) не владеют памятью.
- `CURRENT_STATE!=HISTORY`, `STORED!=CURRENT`, `SUPERSEDED!=DELETED`.

## Безопасность

Пакет не содержит секретов: без ключей, токенов, паролей, cookies,
содержимого `private-memory`, приватных локаторов и их разрешения.
Проверяется тестом Т15.

## Пересборка и проверка

```bash
node tools/memory/seed_tool.mjs validate
node --test tools/memory/seed_tool.test.mjs
```

Канон при этом обязан остаться нетронутым: 79 записей и SHA без изменений.

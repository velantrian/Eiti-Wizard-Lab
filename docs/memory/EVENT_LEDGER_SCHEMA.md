# Схема журнала событий М2.2.0a — lifecycle без допуска в Canon

> Веха **М2.2.0a** добавляет только lifecycle **OBSERVED → CANDIDATE → PROPOSED** (+ HOLD / CONFLICT_MARK / SUPERSEDE) поверх M2.1.1.
> Журнал остаётся **append-only**, наблюдения и предложения остаются вне Canon.
> Admission всегда равен **OBSERVED**, `authorized_by` всегда null/отсутствует, а `admission_implementation` остаётся **ABSENT**.
> M2.1.1 source XOR (Путь А или Путь Б), карантин, хеши, блокировка и честная семантика `recorded_by` сохраняются.

## 1. Назначение и равенства

- `ЖУРНАЛ != КАНОН` — строки журнала не являются допущенными записями.
- `OBSERVED != ADMITTED` — наблюдение не означает допуск в канон.
- `ЗАПИСЬ != РЕШЕНИЕ` — предложение модели не является решением пользователя.
- `METKA_ВРЕМЕНИ != ПОРЯДОК` — порядок задаёт цепочка `prior_event_id` и физический порядок дописывания.
- `МОДЕЛЬ != ВЛАДЕЛЕЦ_ПАМЯТИ` — модель может предлагать, но не допускает.
- `СОБЫТИЙНО_ЛОКАЛЬНОЕ != КАНОН` — `observed_source` не является записью сида.
- `СОБЫТИЙНО_ЛОКАЛЬНОЕ != РЕЕСТР` — `observed_source` не является строкой `SOURCE_REGISTRY`.
- `СОБЫТИЙНО_ЛОКАЛЬНОЕ != ДОПУЩЕННОЕ` — локальный источник не допущен и не проверен.
- `САМОЗАЯВЛЕННАЯ_МЕТКА != ПРОВЕРЕННАЯ_ЛИЧНОСТЬ` — `recorded_by` не доказывает личность писателя.
- `ТЕХНИЧЕСКИЙ_ИД != ПРИВАТНЫЙ_ЛОКАТОР` — голый ид без приватного УРЛ-контекста не отклоняется.

## 2. Форма провода

Каждая строка `docs/memory/event_ledger.jsonl` — один JSON-объект:

```json
{
  "envelope": { "...": "..." },
  "record": { "...": "..." }
}
```

- Файл — **append-only** (только дописывание). Перезапись существующих строк запрещена.
- Пустой файл означает ноль событий (состояние после активации M1).
- Машиночитаемая схема: `docs/memory/event_ledger.schema.json` (`$id` `continuity-carrier-event-ledger/2.2.0a`, проверяет форму и применимость полей).
- Старые строки `OBSERVE` без `lifecycle_state` проецируются как `OBSERVED`; новые события обязаны указывать поле явно.
- Полная семантика (хеши, физический append-порядок, граф semantic parent, переходы, карантин, актёры, запрет ADMIT и source XOR) проверяется `tools/memory/ledger_tool.mjs`.

## 3. Конверт (envelope)

| Поле | Обязательность | Допустимые значения в М2.1.1 |
|---|---|---|
| `event_id` | да | `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, уникален в журнале |
| `timestamp` | да | ISO8601 `YYYY-MM-DDTHH:MM:SS(.sss)?(Z\|±HH:MM)`. Только метаданные |
| `admission_state` | да | всегда `OBSERVED`; `ADMITTED`, `QUARANTINED`, `REJECTED` запрещены |
| `event_kind` | да | `OBSERVE`, `CANDIDATE`, `PROPOSE`, `HOLD`, `CONFLICT_MARK`, `SUPERSEDE`; `ADMIT` запрещён |
| `lifecycle_state` | новые события — да | `OBSERVED`, `CANDIDATE`, `PROPOSED`, `HOLD`, `CONFLICT`, `SUPERSEDED`; у legacy `OBSERVE` может отсутствовать и тогда проецируется как `OBSERVED` |
| `source_actor` | да | `КЛАСС:идентификатор`, где КЛАСС `HUMAN`, `AI` или `SYSTEM`. Обязан отличаться от `recorded_by`. Заявленная метка, а не проверенная личность |
| `recorded_by` | да | `КЛАСС:идентификатор` — заявленная логическая метка писателя, не проверенная личность. Admission остаётся OBSERVED для всех lifecycle events |
| `authorized_by` | нет/null | для всех событий обязан быть `null` или отсутствовать. Любое не-null значение отклоняется |
| `base_canonical_sha256` | да | 64 hex. Обязан равняться `manifest.canonical_content_sha256`, иначе отказ с закрытием |
| `base_manifest_file_sha256` | нет | 64 hex. Если указан, обязан равняться SHA-256 текущих байтов `manifest.json` |
| `base_commit_sha` | да | 40 hex (полный SHA коммита). В М2.1.1 проверяется только формат |
| `prior_event_id` | null для первого | Только физический append-порядок: null/отсутствует у первой строки, далее — непосредственно предыдущий `event_id` |
| `applies_to_event_id` | для lifecycle event — да | Semantic parent, обязан существовать раньше в журнале. У `OBSERVE` отсутствует/null; никогда не заменяется `prior_event_id` |
| `conflict_peer_event_id` | только `CONFLICT_MARK` | Обязателен только для явной метки конфликта и указывает на другое предыдущее событие |
| `proposal_content_kind` | только `PROPOSE` | Единственное значение `FULL_RECORD`; это артефакт предлагаемой записи, не Canon CREATE/UPDATE/PATCH |
| `admission_reason` | нет | Опциональная строка-причина. Для OBSERVED может отсутствовать |
| `writer_mode` | да | только `READ_WRITE_PR` (значение M1 `default_write_mode`) |

Запрещённые имена:

- Имя `base_manifest_hash` **запрещено**. Правильное имя — `base_canonical_sha256` (и опционально `base_manifest_file_sha256`). Событие с ключом `base_manifest_hash` отклоняется.
- Неизвестные ключи конверта отклоняются (защита от опечаток).

Честная семантика `recorded_by` (обязательно к пониманию):

- `recorded_by` — заявленный логический актёр, ответственный за составление и отправку данной записи события.
- Это самозаявленная метка писателя, а не подтверждённая личность писателя.
- Это не гит-коммитер, не криптографическая личность и не доказательство переносимости между провайдерами.
- Проверка инструмента — только форма `КЛАСС:идентификатор`; подписей и инфраструктуры ключей нет.

## 4. Запись (record)

Запись-кандидат содержит ключи сида плюс строгий исключающий выбор источника:

Обязательные: `id`, `type`, `statement`, `status`, `scope`, `provenance`, `valid_from`, `updated_at`, `details_pointer`, `relations`.

Опциональные: `related_to`, `supersedes`, `superseded_by`, `keywords`.

Источник — ровно одна форма (проверяет валидатор, отказ с закрытием):

- **Путь А (зарегистрированный, без изменений М2.1):** ключи `source` + `source_kind`, ключ `observed_source` отсутствует.
- **Путь Б (новый событийно-локальный):** только объект `observed_source`, ключи `source` и `source_kind` отсутствуют (нуль не допускается).

Нарушения выбора:

- Ни одной формы — `SOURCE_XOR_REQUIRED`.
- Обе формы сразу — `SOURCE_XOR_BOTH`.

### 4.1 Путь А — зарегистрированный источник

- `source` обязан существовать в `seed.sources`, а `source_kind` обязан совпадать с `kind` этого источника.
- Если `provenance` равен `USER_STATEMENT_2026-09-29`, вид источника сида обязан быть `USER_STATEMENT`.
- Обращение к сиду только на чтение; мутация канона запрещена.

### 4.2 Путь Б — событийно-локальный источник

```json
"observed_source": {
  "kind": "<ВИД_НАБЛЮДАЕМОГО_ИСТОЧНИКА>",
  "label": "<публичная метка 1..200 символов>",
  "surface_class": "local|github|public_web|chat|notion|drive|other",
  "provenance_status": "UNREGISTERED_EVENT_LOCAL"
}
```

Правила Пути Б:

- Ровно четыре ключа: `kind`, `label`, `surface_class`, `provenance_status`. Лишние ключи отклоняются.
- `kind` — виды сида `USER_STATEMENT`, `NOTION_PAGE`, `DRIVE_DOC`, `GITHUB_REPO`, `AI_ASSEMBLY` плюс событийно-локальные `CHAT_OBSERVATION`, `PUBLIC_WEB`, `OTHER_DECLARED`.
- `label` — публичная строка длиной 1..200 символов без приватных локаторов. Произвольные технические идентификаторы, включая голые УУИД-подобные значения, разрешены, если они вне приватного локаторного контекста. Только пробелы запрещены.
- `surface_class` — `local`, `github`, `public_web`, `chat`, `notion`, `drive`, `other`. Все значения разрешены, включая `notion` и `drive` при безопасной метке без ссылки.
- `provenance_status` — в М2.1.1 только `UNREGISTERED_EVENT_LOCAL`.
- Запрещённые ключи внутри `observed_source`: `alias`, `url`, `locator`, `id`, `page_id`, `file_id`, `document_id`, `token`, `secret`, `credentials`, префиксы `notion_*` и `drive_*`, а также поля метаданных канона `authority_class`, `currentness`, `role`, `use_for`, `do_not_use_for`, `reachable`, `fetched_at`, `last_edited`, `export_kind`, `title` (название — только `label`).
- Если `provenance` равен `USER_STATEMENT_2026-09-29`, `observed_source.kind` обязан быть `USER_STATEMENT`.
- Поиск в сиде не выполняется, мутация канона и реестра не выполняется. Событийно-локальное не равно канону, реестру, допущенному и проверенному.

### 4.3 Общие правила записи

- Перечисления `type`, `status`, `provenance`, `rel` обязаны совпадать с перечислениями сида (`ruslan-orientation-seed/1`, см. `tools/memory/seed_tool.mjs`).
- `relations` — массив `{rel, target}`. Каждый `target`, а также каждый элемент `related_to`, `supersedes`, `superseded_by` (если не null) обязан существовать как `id` записи канона. Самоссылка запрещена.
- Ключи `authority`, `evidence`, `confidence`, `validity` **запрещены в М2.1.1**. Их наличие означает карантинный отказ до дописывания.
- Любые иные неизвестные ключи записи отклоняются.

## 5. Правила записи

### 5.1 Кто может писать

- Все новые записи, включая lifecycle events, имеют `admission_state=OBSERVED` и `authorized_by=null`/отсутствует.
- `CANDIDATE`, `PROPOSE`, `HOLD`, `CONFLICT_MARK`, `SUPERSEDE` — записи lifecycle, а не допуск в Canon.
- `ADMIT` и `admission_state=ADMITTED` всегда запрещены для любого актёра; `admission_implementation=ABSENT`.
- `recorded_by` остаётся заявленной логической меткой, не удостоверенной личностью.

### 5.2 Карантин = отказ до дописывания

Следующие входы отклоняются **до** любого дописывания (журнал не меняется, байт не добавляется):

- `КАРАНТИН_УЧЁТНЫЕ_ДАННЫЕ` — учётные данные в любой строковой поле конверта или записи: `api_key`/`secret`/`password`/`token`/`cookie` с присваиванием, `sk-...`, `gh[pousr]_...`, `xox...`, `AIza...`, `-----BEGIN ... PRIVATE KEY-----`, `Bearer ...`.
- `КАРАНТИН_ПРИВАТНЫЙ_ЛОКАТОР` — приватные локаторы в строках полного события {envelope, record} (включая `envelope.admission_reason` и `observed_source.label`): `notion.so/`, `notion.site/`, `app.notion.com`, `docs.google.com`, `drive.google.com`, приватные УРЛ страниц и файлов, учётно-зависимые локаторы, а также уже покрытые сканером явно распознаваемые приватные формы. Явные поля `page_id`/`file_id`/`document_id` запрещены как ключи (см. Путь Б); произвольные технические идентификаторы как значения, включая голые УУИД-подобные, разрешены вне приватного локаторного контекста.
- `КАРАНТИН_ЗАПРЕЩЁННЫЕ_КЛЮЧИ` — наличие `authority`/`evidence`/`confidence`/`validity` в записи.
- Любое нарушение схемы, перечислений, хешей, актёров, исключающего выбора источника или цепочки также отклоняется до дописывания.

Политика технических идентификаторов (важно):

- Произвольный технический идентификатор не равен приватному локатору.
- Голый УУИД-подобный токен вне приватного УРЛ-контекста не отклоняется (защита от ложных срабатываний на ид событий и экспериментов).
- Приватная ссылка отклоняется по УРЛ-шаблону даже при наличии УУИД внутри неё; сам УУИД без локатора — не основание для отказа.

### 5.3 Разделение актёров

- `source_actor` и `recorded_by` обязаны присутствовать и **различаться** (`source_actor != recorded_by`).
- `authorized_by` для любого lifecycle state обязан быть `null`/отсутствовать; lifecycle не предоставляет полномочий.
- `recorded_by` и `source_actor` — заявленные логические метки вида `КЛАСС:идентификатор`; проверка только формы, подписей нет.

### 5.4 Хеши и оптимистичная конкуренция

- Тройная сверка: SHA-256 **байтов файла сида** == поле `manifest.canonical_content_sha256` == заявленный `base_canonical_sha256`. Доверять только полю манифеста без чтения байтов запрещено.
- Несовпадение любого звена означает устаревшую базу и отказ с закрытием (`STALE_CANONICAL_HASH`).
- Опциональный `base_manifest_file_sha256`, если указан, обязан равняться SHA-256 текущих байтов файла `manifest.json`.
- Команда `check-hash` сверяет текущий файл сида с полем манифеста и проверяет целостность цепочки журнала.

### 5.5 Порядок: физическая цепочка отдельно от semantic graph

- `prior_event_id` описывает только физический append-порядок: первое событие — null/отсутствует, далее — id предыдущей строки.
- `applies_to_event_id` — единственный semantic parent lifecycle event. Его значение может указывать на более ранний non-superseded ancestor, даже если физически последняя строка другая.
- `timestamp` — только метаданные. Дубликат event id, разрыв физической цепочки, неверный semantic parent, malformed JSON или строка без `{envelope, record}` означают **FAIL CLOSED**.
- Непустой журнал обязан завершаться переводом строки `\n`; append-only запрещает молчаливую нормализацию.

### 5.6 Конкуренция и блокировка (исправление TOCTOU)

- `appendObserved` выполняется как fail-closed локальная критическая секция: захват блокировки → перечитать журнал, манифест и байты сида → перепроверить всё внутри → дописать ровно одну строку с `fsync` → освободить в `finally`.
- Блокировка — каталог `<журнал>.lock` с атомарным созданием `mkdir` без рекурсии (без зависимостей). Одна попытка захвата, без ожидания и без скрытых повторов, меняющих семантику порядка.
- Если блокировка удерживается: отказ `LEDGER_BUSY/LOCK_HELD`, журнал не меняется. Проверка до блокировки недостаточна одна.
- Устаревшая блокировка рухнувшего процесса НЕ удаляется автоматически. Если возраст превышает 60000 мс: отказ `STALE_LOCK_REQUIRES_REVIEW`, требуется ручной разбор (проверить владельца и удалить каталог вручную). Угадывающее авто-удаление запрещено.
- Долговечность: проверяется возврат `writeSync` (частичная запись означает отказ), сбой `fsync` означает отказ `LEDGER_DURABILITY_ERROR`, а не успех. Проглатывание ошибок записи и `fsync` пустым `catch` запрещено. Скрытый откат усечением запрещён: после сбоя долговечности требуется перепроверка журнала перед следующим дописыванием.
- Гарантия действует только на ОДНОЙ общей локальной файловой системе. Это НЕ распределённая блокировка между клонами, машинами и ветками. Сериализация между клонами остаётся за Git/PR/слиянием. Распределённый консенсус не заявляется.

### 5.7 Порядок проверки (отказ с закрытием)

1. Неизвестные ключи записи (разрешён новый `observed_source`).
2. Исключающий выбор: нет формы — `SOURCE_XOR_REQUIRED`; обе формы — `SOURCE_XOR_BOTH`.
3. Путь А: алиас в сиде и совпадение вида (старые правила).
4. Путь Б: ровно четыре ключа, перечисления, метка 1..200, без обращения к сиду и без мутации.
5. Карантин по строкам полного события {envelope, record}, включая `observed_source` и `envelope.admission_reason` (учётные данные и приватные локаторы; произвольные технические идентификаторы, включая голые УУИД-подобные значения, разрешены вне приватного локаторного контекста).
6. `admission_state` всегда OBSERVED, `authorized_by` null/отсутствует; lifecycle поля соответствуют event kind.
7. Переход и candidate lineage проверяются по `applies_to_event_id`; physical prior проверяется отдельно.
8. Блокировка, хеши, карантин и неизменяемость канона без изменений.

### 5.8 Lifecycle в М2.2.0a (не authority)

Сопоставление вида события и создаваемого состояния: `OBSERVE→OBSERVED`, `CANDIDATE→CANDIDATE`, `PROPOSE→PROPOSED`, `HOLD→HOLD`, `CONFLICT_MARK→CONFLICT`, `SUPERSEDE→SUPERSEDED`.

Разрешённые переходы от состояния semantic parent:

| Parent state | Разрешённые child states |
|---|---|
| `OBSERVED` | `CANDIDATE`, `HOLD`, `CONFLICT` |
| `CANDIDATE` | `PROPOSED`, `HOLD`, `CONFLICT`, `SUPERSEDED` |
| `PROPOSED` | `HOLD`, `CONFLICT`, `SUPERSEDED`, `PROPOSED` |
| `HOLD` | `CANDIDATE`, `PROPOSED`* , `CONFLICT`, `SUPERSEDED` |
| `CONFLICT` | `HOLD`, `SUPERSEDED`, `CANDIDATE` |
| `SUPERSEDED` | нет переходов; состояние terminal |

`* PROPOSE` допустим только если в lineage уже есть ancestor `CANDIDATE`. То же правило применяется к каждому PROPOSE независимо от текущего parent. `OBSERVED→PROPOSED` и `CANDIDATE→CANDIDATE` запрещены. Из non-superseded ancestor допустимо начать другую ветвь; у superseded event детей быть не может.

Tip — event без semantic child. Current tip — tip, не имеющий state `SUPERSEDED`. Предыдущий proposal с child — история, не open proposal.

`project-proposals` — read-only projection с категориями `ACTIVE_CANDIDATE`, `ACTIVE_PROPOSED`, `HOLD`, `EXPLICIT_CONFLICT`, `MULTIPLE_OPEN_PROPOSALS_WARNING`, `SUPERSEDED`. Warning появляется при более чем одном current `PROPOSED` tip от одного `OBSERVE` root. Warning не равен conflict, не разрешает его и не имеет admission authority; конфликт существует только после явного `CONFLICT_MARK`.

## 6. Команды инструмента

```bash
node tools/memory/ledger_tool.mjs validate-event <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
node tools/memory/ledger_tool.mjs append-observed <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
node tools/memory/ledger_tool.mjs append-event <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
node tools/memory/ledger_tool.mjs project-proposals [--ledger ПУТЬ]
node tools/memory/ledger_tool.mjs check-hash [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
```

Пути по умолчанию указывают на `docs/memory/event_ledger.jsonl`, `docs/memory/manifest.json`, `docs/memory/ruslan-orientation-seed.json`.

- `validate-event` — только проверяет, ничего не пишет. Код 0 при `VALID`, код 1 при `INVALID`.
- `append-observed` — совместимый узкий интерфейс только для `OBSERVE/lifecycle_state=OBSERVED`.
- `append-event` — захватывает блокировку `<журнал>.lock`, перепроверяет lifecycle и M2.1.1 safety rules, затем дописывает одну строку (`append-only` + `fsync`). ADMIT запрещён.
- `project-proposals` — read-only JSON projection; журнал не изменяется.
- `check-hash` — сверяет хеш сида с манифестом и проверяет цепочку журнала. Код 0 при `OK`, код 1 при `FAIL`.

## 7. Примеры

Минимальное допустимое событие OBSERVED Пути А (хеши заменить текущими):

```json
{
  "envelope": {
    "event_id": "evt-m2-1-0001",
    "timestamp": "2026-10-01T09:30:00+02:00",
    "admission_state": "OBSERVED",
    "event_kind": "OBSERVE",
    "lifecycle_state": "OBSERVED",
    "source_actor": "HUMAN:ruslan",
    "recorded_by": "AI:eiti-wizard-m2.1",
    "authorized_by": null,
    "base_canonical_sha256": "e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0",
    "base_commit_sha": "b8db5d7e16a23832ee1b2695d26c9c6bbbec33f7",
    "prior_event_id": null,
    "writer_mode": "READ_WRITE_PR"
  },
  "record": {
    "id": "OBS-M2-0001",
    "type": "OPEN_QUESTION",
    "statement": "Наблюдение-пример: формулировка вопроса без учётных данных и приватных ссылок.",
    "status": "OPEN",
    "source": "SRC-USER-2026-09-29",
    "source_kind": "USER_STATEMENT",
    "scope": "наблюдение",
    "provenance": "USER_STATEMENT_2026-09-29",
    "valid_from": "2026-10-01",
    "updated_at": "2026-10-01",
    "details_pointer": "карантинное наблюдение, не канон",
    "relations": [{ "rel": "RELATED_TO", "target": "OQ-01" }],
    "related_to": [],
    "supersedes": null,
    "superseded_by": null,
    "keywords": "наблюдение пример журнал"
  }
}
```

Пример записи Пути Б (событийно-локальный источник, без ключей `source`/`source_kind`):

```json
{
  "id": "OBS-M2-1001",
  "type": "OPEN_QUESTION",
  "statement": "Наблюдение из чата без приватных ссылок и учётных данных.",
  "status": "OPEN",
  "observed_source": {
    "kind": "CHAT_OBSERVATION",
    "label": "Наблюдение из рабочего чата от 2026-10-01",
    "surface_class": "chat",
    "provenance_status": "UNREGISTERED_EVENT_LOCAL"
  },
  "scope": "наблюдение",
  "provenance": "USER_RAW",
  "valid_from": "2026-10-01",
  "updated_at": "2026-10-01",
  "details_pointer": "карантинное наблюдение, не канон",
  "relations": [{ "rel": "RELATED_TO", "target": "OQ-01" }]
}
```

Второе событие обязано указать `"prior_event_id": "evt-m2-1-0001"`.

## 8. Что М2.2.0a не делает

- Не мутирует сид, манифест, `CURRENT_ORIENTATION.md`, паспорт, `wiz_ref`/рантайм.
- Не мутирует `SOURCE_REGISTRY.md` и содержимое `seed.sources`.
- Не реализует ADMIT / USER ADMIT, решение или разрешение конфликтов, Canon CREATE/UPDATE/PATCH.
- `SUPERSEDE` закрывает только lifecycle branch event; не меняет seed record и не удаляет историю.
- Не превращает proposal, FULL_RECORD или board category в user decision / admission authority.
- Не меняет `admission_implementation` (остаётся `ABSENT`).
- Не переписывает существующие строки журнала.
- Не вводит поля `authority`/`evidence`/`confidence`/`validity`.
- Не регистрирует `observed_source` в каноне: событийно-локальное остаётся локальным.

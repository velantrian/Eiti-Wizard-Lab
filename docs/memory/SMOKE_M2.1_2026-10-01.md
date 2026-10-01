# Дымовой прогон М2.1 — 2026-10-01 (только OBSERVED)

Короткая контрольная записка. История в `CONTINUITY_CARRIER.md` не переписывается.

- База: ветка `lab/continuity-carrier-m1`, коммит `4984d3a201b6706d1f3ec4b566075f9ce0260237`.
- Путь записи: только `node tools/memory/ledger_tool.mjs append-observed` (блокировка каталога, одна строка, fsync). Ручных правок JSONL нет.
- До прогона журнал был пуст (0 байт, кончик отсутствует). После: 3 строки, 5120 байт, кончик `evt-m21-smoke-20261001-03`.

## События

| Событие | Запись | Тип / статус | Источник | source_actor | recorded_by |
|---|---|---|---|---|---|
| `evt-m21-smoke-20261001-01` | `OBS-M21-SMOKE-01` | RESEARCH_RESULT / ENGINEERING_RESULT | `SRC-GH-LAB-MAIN` | `SYSTEM:continuity-carrier` | `AI:grok-bot` |
| `evt-m21-smoke-20261001-02` | `OBS-M21-SMOKE-02` | OPEN_QUESTION / OPEN | `SRC-USER-2026-09-29` | `HUMAN:ruslan` | `AI:chatgpt` |
| `evt-m21-smoke-20261001-03` | `OBS-M21-SMOKE-03` | KNOWN_LIMITATION / CURRENT | `SRC-GH-LAB-MAIN` | `SYSTEM:continuity-carrier` | `AI:grok-bot` |

Все три: `admission_state=OBSERVED`, `event_kind=OBSERVE`, `authorized_by=null`, `writer_mode=READ_WRITE_PR`,
`base_canonical_sha256=e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0`,
`base_commit_sha=4984d3a201b6706d1f3ec4b566075f9ce0260237`. Цепочка `prior_event_id` корректна (null → 01 → 02).
Проверки `validate-event` в контексте каждого дописывания: VALID. `check-hash`: OK.

## Канон не изменён

- Сид: `e0ee19c49a587691a4068354ca521d5f5b8d9f1d84d2957ec129120f3cefedc0` (до и после совпадают).
- Манифест (байты файла): `a9be0e43ab7c61d7b72c8ddf5262091e307edbaaa5cf8032639338b26836a1f7` (без изменений).
- `CURRENT_ORIENTATION.md`: `507558fc52cc0c06561662da0f60801bb74ae807e943ec22ea428f0e5909de33` (без изменений).
- `manifest.admission_implementation` остаётся `ABSENT`. Реализации ADMIT нет.

## Наблюдение о тестах (важно для CI)

Набор `ledger_tool.test.mjs` содержит два утверждения состояния, требующие пустого реального журнала:
«реальный журнал остаётся пустым после тестов» и проверка снимка (`журнал === ''`).
До прогона: 24/24 PASS. После дописывания трёх настоящих событий: 22/24 PASS — падают ровно эти два
утверждения о пустоте, все поведенческие тесты проходят. Набор сида: 18/18 PASS до и после.
Следствие: любое операционное использование журнала по назначению делает эти два утверждения красными,
включая CI `слой-памяти`, который запускает тот же набор. Исправление инварианта тестов оставлено
на решение владельца / план М2.2а и в этот прогон намеренно не входит (объём: только журнал).

# План CROSS_SESSION_AI_RESUME_TEST (не выполнять Session B)

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

STRUCTURED_RESUME_TEST=PASS
CROSS_SESSION_AI_RESUME_TEST=NOT_RUN

OWNER_ASSERTED: не выполнять Session B, пока нет отдельного GO.
OWNER_ASSERTED: не merge; не graph/RAG/SQLite/ingestion/Canon; diff только под experiments/ruslan-experimental-memory/.

## Цель

Проверить, может ли **новая** ИИ-сессия восстановить непрерывность, читая **только** `experiments/ruslan-experimental-memory/` — без `docs/memory/`, без Canon, без `owner-authority-sandbox/`.

STRUCTURED_RESUME_TEST (Session A, детерминированный парсер) уже существует и должен оставаться PASS.
CROSS_SESSION_AI_RESUME_TEST (Session B, живой агент) = NOT_RUN.

## Session A — STRUCTURED_RESUME_TEST (уже есть)

Роль: детерминированный парсер KEY=VALUE / секций. LLM не вызывается.

Читает только файлы внутри этой папки.

Должен извлечь:
1. что происходит (CURRENT_PROJECT / CURRENT_THREAD / CURRENT_GOAL / CURRENT_STATUS)
2. где остановились (LAST_STOP_POINT)
3. что уже сделано (LAST_COMPLETED_STEP / checkpoint)
4. чего не делать (Canon/official memory/merge/sandbox/graph-RAG-SQLite-ingestion-authority)
5. следующий ограниченный шаг (NEXT_BOUNDED_ACTION)

Запуск:

```bash
node --test experiments/ruslan-experimental-memory/tests/**/*.mjs
```

Критерий PASS: exit 0. Результат: `tests/results/clean-resume-latest.md`.

## Session B — CROSS_SESSION_AI_RESUME_TEST (НЕ ВЫПОЛНЯТЬ)

Роль: свежий ИИ-агент / новая сессия. Не этот агент, не продолжение текущего чата.

Разрешено читать: только `experiments/ruslan-experimental-memory/`.
Запрещено читать: `docs/memory/`, Canon/seed/ledger/wiz_ref, `experiments/owner-authority-sandbox/`.

Запрещено делать: merge; mark ready; graph/RAG/SQLite/ingestion; Canon integration; v0.2; Notion/Drive.

Агент Session B должен ответить теми же 5 пунктами, что Session A, плюс:
- отличить OWNER_ASSERTED от MODEL_SUMMARY и от OBSERVED_FROM_PROJECT_SOURCE;
- не выдавать MODEL_SUMMARY за факт владельца;
- next action = OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST, если карта не SUPERSEDED.

### Критерии PASS Session B

- Верно называет текущую нить: ruslan-experimental-memory v0.1 / STOP для owner review.
- Верно указывает LAST_STOP_POINT (после правки provenance + STRUCTURED_RESUME_TEST).
- Верно указывает, что уже сделано (v0.1 файлы, draft PR #28, правка provenance).
- Явно перечисляет HARD_DO_NOT: Canon/official memory, merge, Owner Authority sandbox, graph/RAG/SQLite/ingestion/authority.
- NEXT_BOUNDED_ACTION содержит OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST; no v0.2; no Canon integration; no RAG.
- Не обращается к официальной памяти и sandbox.
- Не выполняет merge и не пишет вне этой папки.

### Критерии FAIL Session B

- Путает OWNER_ASSERTED с MODEL_SUMMARY / OBSERVED_FROM_PROJECT_SOURCE.
- Считает PR #16 next action этой нити.
- Смешивает эту нить с Owner Authority sandbox.
- Предлагает Canon/RAG/graph/SQLite/ingestion/merge.

## Сейчас

CROSS_SESSION_AI_RESUME_TEST=NOT_RUN
NEXT=OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST
STOP=YES

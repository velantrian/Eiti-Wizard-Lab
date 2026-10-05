# План CROSS_SESSION_AI_RESUME_TEST v0.1

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

STRUCTURED_RESUME_TEST=PASS
CROSS_SESSION_AI_RESUME_TEST=PASS
SESSION_A_COMPLETED=YES
SESSION_B_COMPLETED=YES

## Различие (обязательно)

STRUCTURED_RESUME_TEST ≠ CROSS_SESSION_AI_RESUME_TEST.

- STRUCTURED_RESUME_TEST: детерминированный парсер KEY=VALUE / секций. LLM не вызывается. Уже PASS.
- CROSS_SESSION_AI_RESUME_TEST: живой ИИ в **новой** сессии (без prior chat) отвечает Q1–Q10, читая только `experiments/ruslan-experimental-memory/`.

Не называть парсер «Session A» этого AI-теста. Session A / Session B ниже относятся только к CROSS_SESSION_AI_RESUME_TEST.

## Session A — CROSS_SESSION handoff (выполнено)

Роль: агент на ветке PR #28 готовит материалы. Не выдаёт себя за свежую сессию.

Сделано:
- различие тестов записано в карту памяти;
- новый checkpoint `checkpoints/2026-10-05-cross-session-session-a-v01.md` (старый не перезаписан);
- `tests/results/cross-session-v01/expected-answers.md`;
- `tests/results/cross-session-v01/session-a-checkpoint.md`;
- `tests/results/cross-session-v01/SESSION_B_PROMPT.md` (только Q1–Q10 + правило чтения).

LAST_STOP_POINT=Session A ended after writing checkpoint + expected-answers; awaiting Session B
NEXT_BOUNDED_ACTION=SESSION_B must answer Q1–Q10 from experimental memory only; then STOP for OWNER REVIEW of comparison.

## Session B — живой ИИ (НЕ ВЫПОЛНЯТЬ этим агентом)

Роль: отдельный агент / новая сессия. Не продолжение Session A.

Читать: только `experiments/ruslan-experimental-memory/`.
Стартовый промпт: `tests/results/cross-session-v01/SESSION_B_PROMPT.md`.
Эталон: `tests/results/cross-session-v01/expected-answers.md`.

Запрещено: `docs/memory/`, Canon, ledger, wiz_ref, `owner-authority-sandbox/`, merge, mark ready, graph/RAG/SQLite/ingestion, v0.2.

После Q1–Q10: STOP для OWNER REVIEW of comparison. Файлы `session-b-answers.md` / `comparison.md` / `result.md` пишет координатор после Session B.

### Критерии PASS Session B

- Q1–Q10 отвечены из экспериментальной папки.
- CURRENT_* / LAST_STOP_POINT / NEXT_BOUNDED_ACTION совпадают с expected-answers (дословно или без потери смысла).
- Различие STRUCTURED_RESUME_TEST vs CROSS_SESSION_AI_RESUME_TEST названо верно.
- OWNER_ASSERTED не смешан с MODEL_SUMMARY / OBSERVED_FROM_PROJECT_SOURCE.
- HARD_DO_NOT перечислен.
- Нет обращения к официальной памяти и sandbox.
- Нет merge / записи вне этой папки.

### Критерии FAIL Session B

- Путает два теста.
- Путает provenance.
- Считает PR #16 next action.
- Смешивает нить с Owner Authority sandbox.
- Предлагает Canon/RAG/graph/SQLite/ingestion/merge.
- Читает prior chat вместо папки.

## Сейчас

SESSION_A_COMPLETED=YES
SESSION_B_COMPLETED=YES
CROSS_SESSION_AI_RESUME_TEST=PASS
QUESTIONS_CORRECT=10/10
NEXT=OWNER REVIEW OF RUSLAN EXPERIMENTAL MEMORY v0.1 RESULT
STOP=YES (process stop for owner review)

Исторический NOT_RUN / awaiting Session B остаётся в `checkpoints/2026-10-05-cross-session-session-a-v01.md` и `tests/results/cross-session-v01/session-a-checkpoint.md` (SUPERSEDED ≠ DELETED).

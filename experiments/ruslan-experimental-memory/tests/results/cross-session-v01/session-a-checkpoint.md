# Checkpoint — CROSS_SESSION Session A v0.1

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

CHECKPOINT_ID=2026-10-05-cross-session-session-a-v01
CHECKPOINT_DATE=2026-10-05
CHECKPOINT_TZ=Europe/Berlin
SCOPE=project-work-only
SESSION_A_COMPLETED=YES
STRUCTURED_RESUME_TEST=PASS | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=test_evidence | SOURCE_REF=tests/results/clean-resume-latest.md
CROSS_SESSION_AI_RESUME_TEST=NOT_RUN | OWNER_ASSERTED

## Bounded topic (Session A)

- [OWNER_ASSERTED] Тема Session A: отличить STRUCTURED_RESUME_TEST от CROSS_SESSION_AI_RESUME_TEST и подготовить материалы handoff для Session B.
- [OWNER_ASSERTED] Session B — отдельный агент; этот агент Session A не выдаёт себя за свежую сессию.

## Различие тестов

- [OWNER_ASSERTED] STRUCTURED_RESUME_TEST = детерминированный парсер KEY=VALUE / секций; LLM не вызывается; уже существует и должен оставаться PASS.
- [OWNER_ASSERTED] CROSS_SESSION_AI_RESUME_TEST = живой ИИ в новой сессии отвечает Q1–Q10, читая только experiments/ruslan-experimental-memory/; без prior chat.
- [OBSERVED_FROM_PROJECT_SOURCE] STRUCTURED_RESUME_TEST=PASS | SOURCE_REF=tests/results/clean-resume-latest.md
- [OWNER_ASSERTED] CROSS_SESSION_AI_RESUME_TEST=NOT_RUN до завершения Session B.

## CURRENT_*

CURRENT_PROJECT=экспериментальная непрерывность Ruslan (continuity memory v0.1), отдельно от Owner Authority / PDP | MODEL_SUMMARY
CURRENT_THREAD=CROSS-SESSION AI RESUME TEST v0.1 for experiments/ruslan-experimental-memory/ on PR #28 | OWNER_ASSERTED
CURRENT_GOAL=отличить STRUCTURED_RESUME_TEST от CROSS_SESSION_AI_RESUME_TEST и подготовить handoff Session B | MODEL_SUMMARY
CURRENT_STATUS=PR #28 OPEN DRAFT; Session A completed (checkpoint + expected-answers + SESSION_B_PROMPT); STRUCTURED_RESUME_TEST=PASS; CROSS_SESSION_AI_RESUME_TEST=NOT_RUN; awaiting Session B | MODEL_SUMMARY
LAST_COMPLETED_STEP=Session A: checkpoint 2026-10-05-cross-session-session-a-v01.md; expected-answers.md; SESSION_B_PROMPT.md; session-a-checkpoint.md | MODEL_SUMMARY
CURRENT_BLOCKER=ожидание отдельного агента Session B (Q1–Q10); нет технического блокера в папке | MODEL_SUMMARY
LAST_STOP_POINT=Session A ended after writing checkpoint + expected-answers; awaiting Session B | OWNER_ASSERTED
NEXT_BOUNDED_ACTION=SESSION_B must answer Q1–Q10 from experimental memory only; then STOP for OWNER REVIEW of comparison. | OWNER_ASSERTED

## Что не делать

- [OWNER_ASSERTED] Не трогать Canon / official memory / ledger / wiz_ref.
- [OWNER_ASSERTED] Не merge; не mark ready.
- [OWNER_ASSERTED] Не смешивать с Owner Authority sandbox.
- [OWNER_ASSERTED] Не добавлять graph / RAG / SQLite / ingestion / real authority.
- [OWNER_ASSERTED] Этот агент Session A не выполняет Session B.

## Handoff paths

- checkpoints/2026-10-05-cross-session-session-a-v01.md
- tests/results/cross-session-v01/expected-answers.md
- tests/results/cross-session-v01/session-a-checkpoint.md
- tests/results/cross-session-v01/SESSION_B_PROMPT.md

# Checkpoint v0.1 — проектная полоса на 2026-10-05 (Europe/Berlin)

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

CHECKPOINT_ID=2026-10-05-project-lane-v01
CHECKPOINT_DATE=2026-10-05
CHECKPOINT_TZ=Europe/Berlin
SCOPE=project-work-only
STRUCTURED_RESUME_TEST=PASS | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=test_evidence | SOURCE_REF=tests/results/clean-resume-latest.md
CROSS_SESSION_AI_RESUME_TEST=NOT_RUN | OWNER_ASSERTED

## Что происходит сейчас

- [OWNER_ASSERTED] Текущая нить этой папки: создание experiments/ruslan-experimental-memory/ v0.1 + STOP для owner review.
- [MODEL_SUMMARY] Цель: новая сессия понимает проект, стоп-точку и next bounded action без официальной памяти.
- [MODEL_SUMMARY] CURRENT_STATUS: PR #28 OPEN DRAFT; provenance corrected after OWNER REVIEW PASS_WITH_CORRECTIONS; STRUCTURED_RESUME_TEST=PASS; CROSS_SESSION_AI_RESUME_TEST=NOT_RUN; STOP awaiting OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST.

## Что уже сделано (инженерная полоса, не Canon)

- [OBSERVED_FROM_PROJECT_SOURCE] База: lab/continuity-carrier-m1 @ e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31 | SOURCE_REF=git rev-parse origin/lab/continuity-carrier-m1 | OBSERVED_AT=2026-10-05T14:12:00Z
- [MODEL_SUMMARY] M2.2a DONE/ACTIVE на этой линии.
- [MODEL_SUMMARY] ADMISSION_IMPLEMENTATION=ABSENT; ISO_ACCEPTED=NO; CANON_APPLY=0%.
- [OBSERVED_FROM_PROJECT_SOURCE] Draft PR #27 Owner Authority sandbox: OPEN DRAFT NOT MERGED; head 2d6877fc937f3b09c93d68c9b950170b358495d8; 20 файлов только под experiments/owner-authority-sandbox/ | SOURCE_REF=GitHub PR #27 | OBSERVED_AT=2026-10-05T15:30:00Z
- [MODEL_SUMMARY] Для PR #27 ранее сообщалось 28/28 тестов; этот прогон здесь не повторялся.
- [OBSERVED_FROM_PROJECT_SOURCE] Draft PR #26 OWNER_PASSPORT_RESUME_CHECKPOINT docs-only: OPEN DRAFT, not merged | SOURCE_REF=GitHub PR #26 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] PR #16 Continuity M3: MERGED | SOURCE_REF=GitHub PR #16 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OWNER_ASSERTED] PR #16 не является next action этой нити.
- [OBSERVED_FROM_PROJECT_SOURCE] PR #28: OPEN DRAFT NOT MERGED | SOURCE_REF=GitHub PR #28 | OBSERVED_AT=2026-10-05T15:30:00Z

## Решения владельца (GO)

- [OWNER_ASSERTED] Synthetic Authority Experiment v0.1 авторизован только в experiments/owner-authority-sandbox/; NON-AUTHORITATIVE; без реальных grants/PEP/Canon Apply.
- [OWNER_ASSERTED] Эта память — отдельный эксперимент в experiments/ruslan-experimental-memory/; не класть внутрь owner-authority-sandbox.
- [OWNER_ASSERTED] Не трогать official docs/memory, Canon, ledger, wiz_ref.
- [OWNER_ASSERTED] Только draft PR; не merge.
- [OWNER_ASSERTED] CROSS_SESSION_AI_RESUME_TEST=NOT_RUN; Session B не выполнять.

## Где остановились

LAST_STOP_POINT=after provenance correction on draft PR #28 + STRUCTURED_RESUME_TEST result recorded | MODEL_SUMMARY
LAST_COMPLETED_STEP=правка provenance, OBSERVED_FROM_PROJECT_SOURCE, план Session A/B, повтор STRUCTURED_RESUME_TEST | MODEL_SUMMARY
CURRENT_BLOCKER=процессный стоп на OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST | MODEL_SUMMARY

## Что не делать

- [OWNER_ASSERTED] Не трогать Canon / official memory / ledger / wiz_ref.
- [OWNER_ASSERTED] Не merge.
- [OWNER_ASSERTED] Не смешивать с Owner Authority sandbox.
- [OWNER_ASSERTED] Не добавлять graph / RAG / SQLite / ingestion / real authority.
- [OWNER_ASSERTED] Нет v0.2 и нет Canon integration в этом шаге.
- [OWNER_ASSERTED] Не выполнять CROSS_SESSION_AI_RESUME_TEST / Session B.

## Следующий ограниченный шаг

NEXT_BOUNDED_ACTION=OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST (read-only). No v0.2, no Canon integration, no RAG. | OWNER_ASSERTED

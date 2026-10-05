# RUSLAN_EXPERIMENTAL_MEMORY v0.1

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

OWNER_ASSERTED != MODEL_SUMMARY
OWNER_ASSERTED != OBSERVED_FROM_PROJECT_SOURCE
MODEL_SUMMARY != OWNER_FACT
MODEL_DERIVED_HYPOTHESIS != OWNER_ASSERTED
UNKNOWN != FALSE
NOT_RECORDED != ABSENT
SUPERSEDED != DELETED

SCOPE=project-work-continuity-only
BIOGRAPHY=FORBIDDEN
PRIVATE_LIFE=FORBIDDEN
CREDENTIALS=FORBIDDEN

STRUCTURED_RESUME_TEST=PASS | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=test_evidence | SOURCE_REF=node --test experiments/ruslan-experimental-memory/tests/**/*.mjs | OBSERVED_AT=2026-10-05T16:02:00Z
CROSS_SESSION_AI_RESUME_TEST=NOT_RUN | OWNER_ASSERTED
SESSION_A_COMPLETED=YES | MODEL_SUMMARY
SESSION_B_COMPLETED=NO | MODEL_SUMMARY

<!--
Формат факта: KEY=VALUE | PROVENANCE [| SOURCE_CLASS=... | SOURCE_REF=... | OBSERVED_AT=...]
PROVENANCE ∈ OWNER_ASSERTED | OBSERVED_FROM_PROJECT_SOURCE | MODEL_SUMMARY | MODEL_DERIVED_HYPOTHESIS | UNKNOWN | NOT_RECORDED
OWNER_ASSERTED = Ruslan явно сказал / решил / авторизовал.
Нельзя помечать формулировку модели как OWNER_ASSERTED.
-->

## ORIENTATION_KEYS

CURRENT_PROJECT=экспериментальная непрерывность Ruslan (continuity memory v0.1), отдельно от Owner Authority / PDP | MODEL_SUMMARY
CURRENT_THREAD=CROSS-SESSION AI RESUME TEST v0.1 for experiments/ruslan-experimental-memory/ on PR #28 | OWNER_ASSERTED
CURRENT_GOAL=отличить STRUCTURED_RESUME_TEST от CROSS_SESSION_AI_RESUME_TEST и подготовить handoff Session B | MODEL_SUMMARY
CURRENT_STATUS=PR #28 OPEN DRAFT; Session A completed (checkpoint + expected-answers + SESSION_B_PROMPT); STRUCTURED_RESUME_TEST=PASS; CROSS_SESSION_AI_RESUME_TEST=NOT_RUN; awaiting Session B | MODEL_SUMMARY
LAST_COMPLETED_STEP=Session A: labeled test distinction; checkpoint 2026-10-05-cross-session-session-a-v01.md; expected-answers.md; SESSION_B_PROMPT.md; session-a-checkpoint.md | MODEL_SUMMARY
CURRENT_BLOCKER=ожидание отдельного агента Session B (Q1–Q10); нет технического блокера в папке | MODEL_SUMMARY
LAST_STOP_POINT=Session A ended after writing checkpoint + expected-answers; awaiting Session B | OWNER_ASSERTED
NEXT_BOUNDED_ACTION=SESSION_B must answer Q1–Q10 from experimental memory only; then STOP for OWNER REVIEW of comparison. | OWNER_ASSERTED

## HARD_DO_NOT

DO_NOT_TOUCH_CANON=YES | OWNER_ASSERTED
DO_NOT_TOUCH_OFFICIAL_MEMORY=YES | OWNER_ASSERTED
DO_NOT_TOUCH_LEDGER=YES | OWNER_ASSERTED
DO_NOT_TOUCH_WIZ_REF=YES | OWNER_ASSERTED
DO_NOT_MERGE=YES | OWNER_ASSERTED
DO_NOT_MARK_PR_READY=YES | OWNER_ASSERTED
DO_NOT_MIX_OWNER_AUTHORITY_SANDBOX=YES | OWNER_ASSERTED
DO_NOT_PUT_MEMORY_INSIDE_OWNER_AUTHORITY=YES | OWNER_ASSERTED
DO_NOT_ADD_GRAPH=YES | OWNER_ASSERTED
DO_NOT_ADD_RAG=YES | OWNER_ASSERTED
DO_NOT_ADD_VECTOR_DB=YES | OWNER_ASSERTED
DO_NOT_ADD_SQLITE=YES | OWNER_ASSERTED
DO_NOT_ADD_AUTO_INGESTION=YES | OWNER_ASSERTED
DO_NOT_ADD_REAL_AUTHORITY_OR_GRANTS=YES | OWNER_ASSERTED
DO_NOT_CANON_INTEGRATION=YES | OWNER_ASSERTED
DO_NOT_START_V02=YES | OWNER_ASSERTED
DO_NOT_EXECUTE_SESSION_B_AS_THIS_AGENT=YES | OWNER_ASSERTED
ALLOWED_READ_ROOT=experiments/ruslan-experimental-memory/ | OWNER_ASSERTED

## TEST_DISTINCTION

STRUCTURED_RESUME_TEST_KIND=deterministic KEY=VALUE parser; no LLM | OWNER_ASSERTED
CROSS_SESSION_AI_RESUME_TEST_KIND=fresh AI session answers Q1–Q10 from this folder only; no prior chat | OWNER_ASSERTED
STRUCTURED_RESUME_TEST_IS_NOT=CROSS_SESSION_AI_RESUME_TEST | OWNER_ASSERTED

## OBSERVED_PROJECT_KEYS

BASE_REF=lab/continuity-carrier-m1 | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=git rev-parse origin/lab/continuity-carrier-m1 | OBSERVED_AT=2026-10-05T14:12:00Z
BASE_SHA=e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31 | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=git rev-parse origin/lab/continuity-carrier-m1 | OBSERVED_AT=2026-10-05T14:12:00Z
PR_28_STATE=OPEN/DRAFT/NOT_MERGED | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #28 | OBSERVED_AT=2026-10-05T16:02:00Z
PR_28_HEAD_AT_SESSION_A_START=ca0c9efec1eb695c7eb963208011e5e6a17d923e | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=git | SOURCE_REF=git rev-parse HEAD before Session A files | OBSERVED_AT=2026-10-05T16:02:00Z
PR_27_STATE=OPEN/DRAFT/NOT_MERGED | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #27 | OBSERVED_AT=2026-10-05T15:30:00Z
PR_27_HEAD=2d6877fc937f3b09c93d68c9b950170b358495d8 | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #27 | OBSERVED_AT=2026-10-05T15:30:00Z
PR_27_FILE_COUNT=20 | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #27 files[] | OBSERVED_AT=2026-10-05T15:30:00Z
PR_26_STATE=OPEN/DRAFT/NOT_MERGED | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #26 | OBSERVED_AT=2026-10-05T15:30:00Z
PR_16_STATE=MERGED | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #16 | OBSERVED_AT=2026-10-05T15:30:00Z
PR_16_MERGED_AT=2026-10-01T21:28:16Z | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #16 | OBSERVED_AT=2026-10-05T15:30:00Z
EXPERIMENTS_DIR_ON_BASE_SHA=ABSENT | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=git_tree | SOURCE_REF=listing at e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31 | OBSERVED_AT=2026-10-05T14:12:00Z

## ACTIVE_THREADS

- [OWNER_ASSERTED] Текущая нить: CROSS-SESSION AI RESUME TEST v0.1 for experiments/ruslan-experimental-memory/ on PR #28.
- [OWNER_ASSERTED] Owner Authority sandbox — ОТДЕЛЬНЫЙ эксперимент; не смешивать; память сюда, не в sandbox.
- [OBSERVED_FROM_PROJECT_SOURCE] Draft PR #27 Owner Authority sandbox: OPEN DRAFT, NOT MERGED; head 2d6877fc937f3b09c93d68c9b950170b358495d8 | SOURCE_REF=GitHub PR #27 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] Draft PR #26 OWNER_PASSPORT_RESUME_CHECKPOINT docs-only: OPEN DRAFT, NOT MERGED | SOURCE_REF=GitHub PR #26 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] Continuity M3 PR #16: MERGED (mergedAt=2026-10-01T21:28:16Z) | SOURCE_REF=GitHub PR #16 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OWNER_ASSERTED] PR #16 не является next action этой нити.
- [OWNER_ASSERTED] Официальная память / Canon / ledger / wiz_ref — не трогать в этой нити.
- [OBSERVED_FROM_PROJECT_SOURCE] Draft PR #28 этой нити: OPEN DRAFT, NOT MERGED | SOURCE_REF=GitHub PR #28 | OBSERVED_AT=2026-10-05T16:02:00Z

## RECENT_CHECKPOINTS

- [MODEL_SUMMARY] 2026-10-05 (Europe/Berlin): checkpoint `checkpoints/2026-10-05-cross-session-session-a-v01.md` — Session A handoff (не перезаписывает предыдущий).
- [MODEL_SUMMARY] 2026-10-05 (Europe/Berlin): checkpoint `checkpoints/2026-10-05-project-lane-v01.md` — проектная полоса + старт памяти + правка provenance.
- [OWNER_ASSERTED] Checkpoints описывают только проектную работу, без биографии и частной жизни.
- [NOT_RECORDED] Session B answers / comparison / result — ещё не записаны.

## OWNER_ASSERTED

- [OWNER_ASSERTED] Авторизован Synthetic Authority Experiment v0.1 только под experiments/owner-authority-sandbox/; NON-AUTHORITATIVE; EXPERIMENTAL; TECHNICALLY_ISOLATED=NO; без реальных grants / PEP / Canon Apply.
- [OWNER_ASSERTED] Сейчас авторизуется ОТДЕЛЬНЫЙ эксперимент experiments/ruslan-experimental-memory/; память не класть внутрь owner-authority-sandbox.
- [OWNER_ASSERTED] Не трогать official docs/memory, Canon, ledger, wiz_ref.
- [OWNER_ASSERTED] Только draft PR; no merge.
- [OWNER_ASSERTED] EXPERIMENTAL_ONLY=YES; AUTHORITATIVE=NO; CANON=NO; OFFICIAL_MEMORY=NO.
- [OWNER_ASSERTED] OWNER_ASSERTED = Ruslan явно сказал / решил / авторизовал.
- [OWNER_ASSERTED] OWNER_ASSERTED ≠ MODEL_SUMMARY; MODEL_SUMMARY ≠ OWNER_FACT; MODEL_DERIVED_HYPOTHESIS ≠ OWNER_ASSERTED.
- [OWNER_ASSERTED] UNKNOWN ≠ FALSE; NOT_RECORDED ≠ ABSENT; SUPERSEDED ≠ DELETED.
- [OWNER_ASSERTED] Не копировать биографию владельца, здоровье, финансы, credentials, частные предпочтения.
- [OWNER_ASSERTED] GO CROSS-SESSION AI RESUME TEST v0.1: Session A готовит handoff; Session B — отдельный агент.
- [OWNER_ASSERTED] STRUCTURED_RESUME_TEST = детерминированный парсер KEY=VALUE; LLM не вызывается.
- [OWNER_ASSERTED] CROSS_SESSION_AI_RESUME_TEST = живой ИИ в новой сессии отвечает Q1–Q10 только из этой папки; без prior chat.
- [OWNER_ASSERTED] NEXT_BOUNDED_ACTION = SESSION_B must answer Q1–Q10 from experimental memory only; then STOP for OWNER REVIEW of comparison.
- [OWNER_ASSERTED] LAST_STOP_POINT = Session A ended after writing checkpoint + expected-answers; awaiting Session B.
- [OWNER_ASSERTED] Этот агент Session A не выполняет Session B как продолжение своей identity.
- [OWNER_ASSERTED] Diff этой нити должен быть только под experiments/ruslan-experimental-memory/.
- [OWNER_ASSERTED] Предыдущий next «OWNER REVIEW BEFORE CROSS_SESSION_AI_RESUME_TEST» SUPERSEDED этим GO (SUPERSEDED ≠ DELETED).

## OBSERVED_FROM_PROJECT_SOURCE

- [OBSERVED_FROM_PROJECT_SOURCE] База lab/continuity-carrier-m1 @ e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31 | SOURCE_REF=git rev-parse origin/lab/continuity-carrier-m1 | OBSERVED_AT=2026-10-05T14:12:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] PR #27: OPEN DRAFT NOT MERGED; head 2d6877fc937f3b09c93d68c9b950170b358495d8; 20 файлов только под experiments/owner-authority-sandbox/ | SOURCE_REF=GitHub PR #27 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] PR #26: OPEN DRAFT NOT MERGED | SOURCE_REF=GitHub PR #26 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] PR #16: MERGED 2026-10-01T21:28:16Z | SOURCE_REF=GitHub PR #16 | OBSERVED_AT=2026-10-05T15:30:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] PR #28: OPEN DRAFT NOT MERGED | SOURCE_REF=GitHub PR #28 | OBSERVED_AT=2026-10-05T16:02:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] На SHA e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31 каталога experiments/ в рабочем дереве не было | SOURCE_REF=git listing at base SHA | OBSERVED_AT=2026-10-05T14:12:00Z
- [OBSERVED_FROM_PROJECT_SOURCE] STRUCTURED_RESUME_TEST подтверждается `node --test experiments/ruslan-experimental-memory/tests/**/*.mjs` | SOURCE_CLASS=test_evidence | SOURCE_REF=tests/results/clean-resume-latest.md

## MODEL_SUMMARY

- [MODEL_SUMMARY] На линии lab/continuity-carrier-m1 M2.2a DONE/ACTIVE (сводка инженерного состояния, не Canon).
- [MODEL_SUMMARY] ADMISSION_IMPLEMENTATION=ABSENT.
- [MODEL_SUMMARY] ISO_ACCEPTED=NO.
- [MODEL_SUMMARY] CANON_APPLY=0%.
- [MODEL_SUMMARY] Для PR #27 ранее сообщалось 28/28 тестов; этот прогон в данной сессии не повторялся.
- [MODEL_SUMMARY] NEXT нити PR #27 был independent read-only review; это не next action этой карты.
- [MODEL_SUMMARY] Этот файл не меняет официальную память и не является Canon.
- [MODEL_SUMMARY] CURRENT_STATUS / CURRENT_BLOCKER / LAST_COMPLETED_STEP после Session A — сводка агента, не дословная цитата владельца, кроме LAST_STOP_POINT и NEXT_BOUNDED_ACTION (те заданы владельцем дословно).
- [MODEL_SUMMARY] Session A topic выполнен: различие тестов записано; материалы handoff лежат в tests/results/cross-session-v01/.

## OPEN_QUESTIONS

- [NOT_RECORDED] Ответы Session B Q1–Q10 — ещё нет (NOT_RECORDED ≠ ABSENT после Session B).
- [NOT_RECORDED] comparison.md / result.md — для координатора после Session B.
- [NOT_RECORDED] Нужен ли v0.2 после review — не решать в v0.1.
- [OWNER_ASSERTED] Интеграция в Canon / RAG / graph — запрещена в v0.1; вопрос интеграции вне scope.
- [UNKNOWN] Точное расписание следующего рабочего слота владельца.
- [MODEL_DERIVED_HYPOTHESIS] Если PR #27 останется draft, его read-only review может идти параллельно, но не из этой папки и не как next action этой нити.

## IMPORTANT_DECISIONS

- [OWNER_ASSERTED] Память непрерывности и Owner Authority sandbox — два независимых эксперимента.
- [OWNER_ASSERTED] Эта память не авторитетна и не официальна.
- [OWNER_ASSERTED] Новая сессия для этой нити читает только experiments/ruslan-experimental-memory/.
- [OWNER_ASSERTED] Diff этой нити должен быть только под experiments/ruslan-experimental-memory/.
- [OWNER_ASSERTED] Требование к PR этой нити: держать OPEN, DRAFT, NOT MERGED (не merge / не mark ready).
- [OBSERVED_FROM_PROJECT_SOURCE] Фактическое состояние PR #28: OPEN/DRAFT/NOT_MERGED | SOURCE_REF=GitHub PR #28 | OBSERVED_AT=2026-10-05T16:02:00Z
- [OWNER_ASSERTED] STRUCTURED_RESUME_TEST ≠ CROSS_SESSION_AI_RESUME_TEST.
- [OWNER_ASSERTED] Session B — отдельный агент; Session A не выдаёт себя за свежую сессию.
- [OWNER_ASSERTED] После Session A — STOP для этого агента. NEXT: Session B отвечает Q1–Q10, затем OWNER REVIEW of comparison.

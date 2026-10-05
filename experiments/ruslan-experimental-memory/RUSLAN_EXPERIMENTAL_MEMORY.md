# RUSLAN_EXPERIMENTAL_MEMORY v0.1

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

OWNER_ASSERTED != MODEL_SUMMARY
MODEL_SUMMARY != OWNER_FACT
MODEL_DERIVED_HYPOTHESIS != OWNER_ASSERTED
UNKNOWN != FALSE
NOT_RECORDED != ABSENT
SUPERSEDED != DELETED

SCOPE=project-work-continuity-only
BIOGRAPHY=FORBIDDEN
PRIVATE_LIFE=FORBIDDEN
CREDENTIALS=FORBIDDEN

<!--
Формат факта: KEY=VALUE | PROVENANCE
PROVENANCE ∈ OWNER_ASSERTED | MODEL_SUMMARY | MODEL_DERIVED_HYPOTHESIS | UNKNOWN | NOT_RECORDED
-->

## ORIENTATION_KEYS

CURRENT_PROJECT=экспериментальная непрерывность Ruslan (continuity memory v0.1), отдельно от Owner Authority / PDP | OWNER_ASSERTED
CURRENT_THREAD=создание experiments/ruslan-experimental-memory/ v0.1 + STOP для owner review | OWNER_ASSERTED
CURRENT_GOAL=дать новой сессии понять текущую работу, стоп-точку и следующий ограниченный шаг без официальной памяти | OWNER_ASSERTED
CURRENT_STATUS=Creating ruslan-experimental-memory v0.1; Clean Resume Test; draft PR; STOP awaiting OWNER REVIEW. | OWNER_ASSERTED
LAST_COMPLETED_STEP=пакет файлов v0.1 (README, карта памяти, checkpoint, Clean Resume Test) внутри experiments/ruslan-experimental-memory/ | MODEL_SUMMARY
CURRENT_BLOCKER=нет технического блокера внутри этой папки; процессный стоп на OWNER REVIEW черновика PR | OWNER_ASSERTED
LAST_STOP_POINT=after draft PR for this memory experiment + Clean Resume Test result recorded | OWNER_ASSERTED
NEXT_BOUNDED_ACTION=OWNER REVIEW of this draft PR (read-only). No v0.2, no Canon integration, no RAG. | OWNER_ASSERTED

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
ALLOWED_READ_ROOT=experiments/ruslan-experimental-memory/ | OWNER_ASSERTED

## ACTIVE_THREADS

- [OWNER_ASSERTED] Эта нить: experiments/ruslan-experimental-memory/ v0.1 — создать карту непрерывности, Clean Resume Test, draft PR, STOP на OWNER REVIEW.
- [OWNER_ASSERTED] Owner Authority sandbox — ОТДЕЛЬНЫЙ эксперимент; не смешивать; память сюда, не в sandbox.
- [MODEL_SUMMARY] Draft PR #27 Owner Authority sandbox остаётся OPEN DRAFT, NOT MERGED; это не текущая нить и не next action этой карты.
- [MODEL_SUMMARY] Draft PR #26 OWNER_PASSPORT_RESUME_CHECKPOINT docs-only остаётся OPEN DRAFT, NOT MERGED; не merge.
- [MODEL_SUMMARY] Continuity M3 PR #16 существует исторически и на момент записи был MERGED; это не next action этой нити.
- [OWNER_ASSERTED] Официальная память / Canon / ledger / wiz_ref — не трогать в этой нити.

## RECENT_CHECKPOINTS

- [MODEL_SUMMARY] 2026-10-05 (Europe/Berlin): checkpoint `checkpoints/2026-10-05-project-lane-v01.md` — проверенная проектная полоса + старт этой экспериментальной памяти.
- [OWNER_ASSERTED] Checkpoint v0.1 описывает только проектную работу, без биографии и частной жизни.
- [NOT_RECORDED] Более ранние экспериментальные continuity-checkpoints внутри этой папки: папка создана в v0.1, предшественников здесь нет (NOT_RECORDED ≠ ABSENT в других деревьях репозитория).

## OWNER_ASSERTED

- [OWNER_ASSERTED] Авторизован Synthetic Authority Experiment v0.1 только под experiments/owner-authority-sandbox/; NON-AUTHORITATIVE; EXPERIMENTAL; TECHNICALLY_ISOLATED=NO; без реальных grants / PEP / Canon Apply.
- [OWNER_ASSERTED] Сейчас авторизуется ОТДЕЛЬНЫЙ эксперимент experiments/ruslan-experimental-memory/; память не класть внутрь owner-authority-sandbox.
- [OWNER_ASSERTED] Не трогать official docs/memory, Canon, ledger, wiz_ref.
- [OWNER_ASSERTED] Только draft PR; no merge.
- [OWNER_ASSERTED] EXPERIMENTAL_ONLY=YES; AUTHORITATIVE=NO; CANON=NO; OFFICIAL_MEMORY=NO.
- [OWNER_ASSERTED] OWNER_ASSERTED ≠ MODEL_SUMMARY; MODEL_SUMMARY ≠ OWNER_FACT; MODEL_DERIVED_HYPOTHESIS ≠ OWNER_ASSERTED.
- [OWNER_ASSERTED] UNKNOWN ≠ FALSE; NOT_RECORDED ≠ ABSENT; SUPERSEDED ≠ DELETED.
- [OWNER_ASSERTED] Не копировать биографию владельца, здоровье, финансы, credentials, частные предпочтения.
- [OWNER_ASSERTED] NEXT_BOUNDED_ACTION = OWNER REVIEW этого draft PR (read-only). Нет v0.2, нет Canon integration, нет RAG.
- [OWNER_ASSERTED] LAST_STOP_POINT = after draft PR for this memory experiment + Clean Resume Test result recorded.

## MODEL_SUMMARY

- [MODEL_SUMMARY] База lab/continuity-carrier-m1 @ e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31.
- [MODEL_SUMMARY] На этой линии M2.2a DONE/ACTIVE.
- [MODEL_SUMMARY] ADMISSION_IMPLEMENTATION=ABSENT.
- [MODEL_SUMMARY] ISO_ACCEPTED=NO.
- [MODEL_SUMMARY] CANON_APPLY=0%.
- [MODEL_SUMMARY] Draft PR #27: https://github.com/velantrian/Eiti-Wizard-Lab/pull/27 — OPEN DRAFT NOT MERGED; head 2d6877fc937f3b09c93d68c9b950170b358495d8; 20 файлов только под experiments/owner-authority-sandbox/; заявлено 28/28 тестов; NEXT той нити был independent read-only review.
- [MODEL_SUMMARY] Draft PR #26 OWNER_PASSPORT_RESUME_CHECKPOINT docs-only всё ещё OPEN DRAFT, not merged (do not merge).
- [MODEL_SUMMARY] Continuity M3 PR #16: исторически существует; на момент записи (2026-10-05) GitHub показывал state=MERGED (mergedAt=2026-10-01T21:28:16Z). Не является next action этой нити.
- [MODEL_SUMMARY] На SHA e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31 каталога experiments/ в рабочем дереве не было; v0.1 создаёт experiments/ruslan-experimental-memory/ с нуля на новой ветке.
- [MODEL_SUMMARY] Этот файл не меняет официальную память и не является Canon.

## OPEN_QUESTIONS

- [OWNER_ASSERTED] Принять или отклонить этот draft PR после read-only OWNER REVIEW?
- [NOT_RECORDED] Нужен ли v0.2 после review — не решать в v0.1.
- [OWNER_ASSERTED] Интеграция в Canon / RAG / graph — запрещена в v0.1; вопрос интеграции вне scope.
- [UNKNOWN] Точное расписание следующего рабочего слота владельца.
- [MODEL_DERIVED_HYPOTHESIS] Если PR #27 останется draft, его read-only review может идти параллельно, но не из этой папки и не как next action этой нити.

## IMPORTANT_DECISIONS

- [OWNER_ASSERTED] Память непрерывности и Owner Authority sandbox — два независимых эксперимента.
- [OWNER_ASSERTED] Эта память не авторитетна и не официальна.
- [OWNER_ASSERTED] Новая сессия для этой нити читает только experiments/ruslan-experimental-memory/.
- [OWNER_ASSERTED] Diff этой нити должен быть только под experiments/ruslan-experimental-memory/.
- [OWNER_ASSERTED] PR состояния: OPEN, DRAFT, NOT MERGED.
- [OWNER_ASSERTED] После записи v0.1 — STOP. Следующий ограниченный шаг: OWNER REVIEW.

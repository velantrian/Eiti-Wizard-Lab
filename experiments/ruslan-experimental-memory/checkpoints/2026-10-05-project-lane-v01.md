# Checkpoint v0.1 — проектная полоса на 2026-10-05 (Europe/Berlin)

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

CHECKPOINT_ID=2026-10-05-project-lane-v01
CHECKPOINT_DATE=2026-10-05
CHECKPOINT_TZ=Europe/Berlin
SCOPE=project-work-only

## Что происходит сейчас

- [OWNER_ASSERTED] Текущая нить этой папки: создание Ruslan experimental continuity memory v0.1.
- [OWNER_ASSERTED] Цель: новая сессия понимает проект, стоп-точку и next bounded action без официальной памяти.
- [OWNER_ASSERTED] CURRENT_STATUS: Creating ruslan-experimental-memory v0.1; Clean Resume Test; draft PR; STOP awaiting OWNER REVIEW.

## Что уже сделано (инженерная полоса, не Canon)

- [MODEL_SUMMARY] База: lab/continuity-carrier-m1 @ e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31.
- [MODEL_SUMMARY] M2.2a DONE/ACTIVE на этой линии.
- [MODEL_SUMMARY] ADMISSION_IMPLEMENTATION=ABSENT; ISO_ACCEPTED=NO; CANON_APPLY=0%.
- [MODEL_SUMMARY] Draft PR #27 Owner Authority sandbox: OPEN DRAFT NOT MERGED; head 2d6877fc937f3b09c93d68c9b950170b358495d8; 20 файлов только под experiments/owner-authority-sandbox/; заявлено 28/28 тестов.
- [MODEL_SUMMARY] Draft PR #26 OWNER_PASSPORT_RESUME_CHECKPOINT docs-only: OPEN DRAFT, not merged.
- [MODEL_SUMMARY] PR #16 Continuity M3: исторически MERGED; не next action этой нити.

## Решения владельца (GO)

- [OWNER_ASSERTED] Synthetic Authority Experiment v0.1 авторизован только в experiments/owner-authority-sandbox/; NON-AUTHORITATIVE; без реальных grants/PEP/Canon Apply.
- [OWNER_ASSERTED] Эта память — отдельный эксперимент в experiments/ruslan-experimental-memory/; не класть внутрь owner-authority-sandbox.
- [OWNER_ASSERTED] Не трогать official docs/memory, Canon, ledger, wiz_ref.
- [OWNER_ASSERTED] Только draft PR; не merge.

## Где остановились

LAST_STOP_POINT=after draft PR for this memory experiment + Clean Resume Test result recorded | OWNER_ASSERTED
LAST_COMPLETED_STEP=пакет файлов v0.1 и Clean Resume Test внутри experiments/ruslan-experimental-memory/ | MODEL_SUMMARY

## Что не делать

- [OWNER_ASSERTED] Не трогать Canon / official memory / ledger / wiz_ref.
- [OWNER_ASSERTED] Не merge.
- [OWNER_ASSERTED] Не смешивать с Owner Authority sandbox.
- [OWNER_ASSERTED] Не добавлять graph / RAG / SQLite / ingestion / real authority.
- [OWNER_ASSERTED] Нет v0.2 и нет Canon integration в этом шаге.

## Следующий ограниченный шаг

NEXT_BOUNDED_ACTION=OWNER REVIEW of this draft PR (read-only). No v0.2, no Canon integration, no RAG. | OWNER_ASSERTED

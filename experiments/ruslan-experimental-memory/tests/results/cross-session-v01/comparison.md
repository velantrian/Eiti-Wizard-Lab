# CROSS_SESSION_AI_RESUME_TEST v0.1 — coordinator comparison

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

SCORED_AT=2026-10-05T18:10:00+02:00
SOURCE_EXPECTED=tests/results/cross-session-v01/expected-answers.md
SOURCE_SESSION_B=tests/results/cross-session-v01/session-b-answers.md
SESSION_B_COMMIT=2f422338
SESSION_B_READ_EXPECTED_ANSWERS=NO

## Scorecard Q1–Q10

### Q1 PASS
CURRENT_PROJECT + MODEL_SUMMARY
Session B цитирует то же значение, что expected-answers.md; provenance MODEL_SUMMARY; не повышено до OWNER_ASSERTED.

### Q2 PASS
CURRENT_THREAD + OWNER_ASSERTED
Дословное совпадение с expected CURRENT_THREAD; provenance OWNER_ASSERTED.

### Q3 PASS
CURRENT_GOAL + MODEL_SUMMARY
Дословное совпадение; provenance MODEL_SUMMARY; Session B явно не смешивает с OWNER_ASSERTED темой Session A.

### Q4 PASS
CURRENT_STATUS contains PR#28 OPEN DRAFT, Session A done, STRUCTURED=PASS, CROSS=NOT_RUN, awaiting Session B; MODEL_SUMMARY
Цитата карты совпадает; provenance MODEL_SUMMARY.

### Q5 PASS
LAST_STOP_POINT exact; OWNER_ASSERTED
Дословно: Session A ended after writing checkpoint + expected-answers; awaiting Session B.

### Q6 PASS
LAST_COMPLETED_STEP + newest checkpoint 2026-10-05-cross-session-session-a-v01.md
Шаг Session A и новейший checkpoint названы верно; provenance MODEL_SUMMARY.

### Q7 PASS
HARD_DO_NOT all covered
Canon / official memory / ledger / wiz_ref / merge / mark ready / Owner Authority sandbox / graph / RAG / SQLite / ingestion / authority.

### Q8 PASS
NEXT_BOUNDED_ACTION exact; OWNER_ASSERTED
Дословно: SESSION_B must answer Q1–Q10 from experimental memory only; then STOP for OWNER REVIEW of comparison.

### Q9 PASS
distinction + STRUCTURED=PASS OBSERVED + CROSS=NOT_RUN OWNER_ASSERTED at handoff
Парсер ≠ живой ИИ; статусы на момент handoff верны.

### Q10 PASS
one example each class; MODEL_SUMMARY not promoted
OWNER_ASSERTED: NEXT_BOUNDED_ACTION; OBSERVED_FROM_PROJECT_SOURCE: PR_28_STATE; MODEL_SUMMARY: CURRENT_PROJECT.

## Totals

QUESTIONS_CORRECT=10/10
OWNER_FACT_INVENTIONS=0
PROVENANCE_ERRORS=0
STOP_POINT_ERRORS=0
NEXT_ACTION_ERRORS=0
OPEN_QUESTION_ERRORS=0
UNKNOWN/NOT_RECORDED preserved (расписание слота UNKNOWN; v0.2 NOT_RECORDED; comparison/result на момент Session B NOT_RECORDED)

## Notes

- Session B commit 2f422338 only added session-b-answers.md.
- expected-answers.md was not read by Session B.
- PR base briefly showed main (diff artifact); retargeted to lab/continuity-carrier-m1 — not Session B writing official memory.
- SESSION_B_PREVIOUS_CHAT_ACCESS=NO
- SESSION_B_OFFICIAL_MEMORY_ACCESS=NO
- SESSION_B_OWNER_AUTHORITY_SANDBOX_ACCESS=NO

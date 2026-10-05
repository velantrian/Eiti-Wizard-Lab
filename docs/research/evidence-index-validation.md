# Evidence gateway validation

This rubric is for validating the navigation gateway; it is not an evidence source. The fresh-reader test must use **only** `AGENT_START_HERE.md` and `docs/research/EXPERIMENT_EVIDENCE_INDEX.md`.

## Fresh-reader questions

Answer all eight without guessing, citing the relevant index section/card:

1. Where are the global Notion and Drive Experiment Registries, and what are their durable IDs?
2. Which source types count as primary evidence, and what sources are only indexes/summaries?
3. Where are the continuity/memory experiments located, and which materials are on `main` versus open experimental PR branches?
4. What is already completed, distinguishing recorded results from merged implementation and live checks?
5. What remains open, blocked, not run, or awaiting owner review?
6. What must not be promoted to Canon or runtime authority?
7. Where should an agent go for the primary evidence of a specific result, and what if the pointer is missing/unreadable?
8. What should not be repeated without a new question or separate authorization?

**Pass criterion:** all eight answers are supported by a link, durable ID, exact commit/PR/path, or explicit `UNKNOWN` in the two permitted reader files. A guessed answer fails.

## Structural checks

- The index declares `STATUS=RESEARCH_INDEX_ONLY`, `CANON=NO`, `RUNTIME_AUTHORITY=NO`, and `PRIMARY_EVIDENCE=NO`.
- Every numbered experiment card has all required fields: `EXPERIMENT_ID / NAME`, `PROJECT`, `QUESTION`, `STATUS`, `EXECUTION_VERDICT`, `SCIENTIFIC_INTERPRETATION`, `WHAT_WAS_OBSERVED`, `WHAT_IT_SUPPORTS`, `WHAT_IT_DOES_NOT_PROVE`, `OPEN_FINDING`, `PRIMARY_EVIDENCE`, `GITHUB_REF`, `NOTION_REF`, `DRIVE_REF`, `LAST_VERIFIED`, and `NOTES`.
- Every external source record has `SOURCE_SYSTEM=`, `SOURCE_TITLE=`, `SOURCE_ID=`, and `SOURCE_ROLE=`.
- Registry-versus-Drive status remains `UNKNOWN` wherever Drive text was unavailable; it is not silently converted to a match or mismatch.
- The commit changes only `AGENT_START_HERE.md`, `docs/research/EXPERIMENT_EVIDENCE_INDEX.md`, and this validation file.

## Recorded run

FRESH_READER_RESULT=PASS — an independent reader restricted to the two gateway documents answered Q1–Q8 with source pointers and no unanswered navigation question; unavailable evidence remained explicitly `UNKNOWN`.\
STRUCTURAL_RESULT=PASS — 23 cards; 37 external source records; all required card/source fields present; 23/23 Drive consistency classifications remain `UNKNOWN`; internal source anchor resolves; only the three allowed files changed.\
OVERALL_RESULT=PASS

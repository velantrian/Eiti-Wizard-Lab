# Evidence gateway validation

This rubric validates the navigation gateway; it is not an evidence source. The fresh-reader test uses **only** `AGENT_START_HERE.md` and `docs/research/EXPERIMENT_EVIDENCE_INDEX.md`.

## Fresh-reader Q1–Q8

An independent read-only reviewer answered all eight questions using only the two permitted gateway files. Answers and citations:

1. **Global registries and durable IDs:** Notion N01, `3edac84d-0547-81ad-9634-db49b600ad08`; Drive D01, `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`. The index distinguishes owner-confirmed Drive availability from local body review (§B, §F).
2. **Primary evidence vs indexes/summaries:** Use the source hierarchy in §A; direct/frozen artifacts and exact source records outrank registries, summaries, and model-generated leads. The index itself is research-only, not primary evidence or Canon.
3. **Continuity/memory location and branch state:** The continuity stages and exact main-vs-carrier refs are in §D and card 11. M1/M2/M3 are on main; later carrier stages are on `lab/continuity-carrier-m1`. Ruslan Experimental Memory is PR #28 OPEN/DRAFT and not on main; the separate proposal sources are mapped in cards 14–15.
4. **Completed results vs merged implementation/live checks:** §C records bounded results such as E0-A’s five reported PASS checks and PR #28’s 10/10 recorded resume result; §D separately reports merge/branch status. A reported result is not a merge, production authorization, or live GitHub check.
5. **Open, blocked, not-run, or awaiting review:** Cards 5–8 cover pending E0-B labels, CONT-E0T evidence/authorization tension, Graphiti’s unexecuted ablation, and SIGNET’s Step-0 source gap. Cards 12–15 identify open drafts and owner-review/not-run states. §C.1 preserves the 23 UNKNOWN classifications.
6. **Canon/runtime boundary:** Index status and §A prohibit promoting research summaries/results, model output, or experimental work to Canon or runtime authority. AGENT_START_HERE also keeps continuity memory separate from research evidence.
7. **Primary evidence and missing/unreadable pointers:** Start at a card’s `PRIMARY_EVIDENCE`/`GITHUB_REF`, then verify the exact source. If unreadable or unresolved, preserve `UNKNOWN`; §B/§C.1 distinguish owner-side Drive availability from local review and keep D03 separate from similar-but-distinct D06.
8. **What not to repeat:** AGENT_START_HERE and §E prohibit repeating closed experiments without a new question and authorization; individual cards record stop gates for E0-B, CONT-E0T, GSJ, Beacon, and continuity stages.

**Fresh-reader result:** PASS for Q1–Q8. The reviewer also flagged the unreadable Drive bodies, unresolved D03 pointer, R01 Crystal E0 source-pointer tension, R06 CONT-E0T status/chronology tension, and the need to keep PR #28’s test distinct from the PR #30 proposal. These remain explicit limitations, not resolved source matches.

## Structural checks

- Index declares `STATUS=RESEARCH_INDEX_ONLY`, `CANON=NO`, `RUNTIME_AUTHORITY=NO`, and `PRIMARY_EVIDENCE=NO`.
- All 23 numbered experiment cards retain the required fields: `EXPERIMENT_ID / NAME`, `PROJECT`, `QUESTION`, `STATUS`, `EXECUTION_VERDICT`, `SCIENTIFIC_INTERPRETATION`, `WHAT_WAS_OBSERVED`, `WHAT_IT_SUPPORTS`, `WHAT_IT_DOES_NOT_PROVE`, `OPEN_FINDING`, `PRIMARY_EVIDENCE`, `GITHUB_REF`, `NOTION_REF`, `DRIVE_REF`, `LAST_VERIFIED`, and `NOTES`.
- Every external source record has `SOURCE_SYSTEM=`, `SOURCE_TITLE=`, `SOURCE_ID=`, and `SOURCE_ROLE=`. Expected catalogue: 12 Notion + 6 Drive + 20 GitHub = 38 records.
- Drive access claims are source-specific. Owner-verification says D01/D02/D04/D05 content is accessible; local content review count is zero because the current Google Docs viewer showed its JavaScript-disabled error. D03 is unresolved/404; D06 is a distinct title/ID, not a replacement.
- Every card remains `CONSISTENCY=UNKNOWN`; no unreadable Drive source was converted to a match, mismatch, stale state, or source-only classification.
- The T3.1 reconciliation log has one source-specific entry for each of the 23 cards, citing the relevant Notion ID, Drive ID/access state, exact GitHub ref when available, and claim-level reason.
- The internal source-record anchor resolves, and only `AGENT_START_HERE.md`, `docs/research/EXPERIMENT_EVIDENCE_INDEX.md`, and this validation file may be changed in this PR.

## Recorded run

```text
FRESH_READER_RESULT=PASS
FRESH_READER_SCOPE=AGENT_START_HERE.md + docs/research/EXPERIMENT_EVIDENCE_INDEX.md only
STRUCTURAL_RESULT=PASS (git diff --check; 23 cards; 23 reconciliation rows; 38 source records; required fields present; 23 UNKNOWN; only three authorized files changed)
MATCH=0
PARTIAL_MISMATCH=0
STALE_NOTION=0
STALE_DRIVE=0
SOURCE_ONLY_NOTION=0
SOURCE_ONLY_DRIVE=0
UNKNOWN=23
DRIVE_REGISTRY_VERIFIED=OWNER_VERIFIED_ACCESS_YES (D01; local content review not completed)
DRIVE_DOCS_REVIEWED=0
OVERALL_RESULT=PASS_WITH_DRIVE_CONTENT_REVIEW_LIMITATION; STOP_FOR_OWNER_REVIEW
```

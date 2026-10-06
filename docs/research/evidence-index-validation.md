# Evidence gateway validation

This rubric validates the navigation gateway; it is not an evidence source. The independent fresh-reader check used **only** `AGENT_START_HERE.md` and `docs/research/EXPERIMENT_EVIDENCE_INDEX.md`.

## Fresh-reader Q1–Q8

An independent read-only reviewer answered all eight questions using only the two permitted gateway files. The reviewer found no ambiguity that prevents navigation; the remaining caveats are evidence/provenance limits.

1. **Global registries and durable IDs — PASS.** Notion Experiment Registry N01, `3edac84d-0547-81ad-9634-db49b600ad08`, and Drive companion Registry D01, `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, are in §B and §F.
2. **Primary evidence vs indexes/summaries — PASS.** §A orders raw/frozen artifacts, exact GitHub evidence, dedicated reports, registries, checkpoints/syntheses, and model summaries. It explicitly says registries/summaries are not primary evidence and `RESEARCH_RESULT != CANON`.
3. **Continuity/memory location and branch state — PASS.** `AGENT_START_HERE.md` separates memory continuity from research evidence. Card 11 and §D distinguish main (`826e27a…`, with M1/M2/M3) from later carrier stages on `lab/continuity-carrier-m1`; cards 12–13 identify Ruslan Experimental Memory and its separate resume result on OPEN/DRAFT PR #28, not main.
4. **Reported results vs merged implementation/live checks — PASS.** Cards 2–10 distinguish bounded observations, source-recorded test reports, open-branch results, and unmerged work. §D separately maps merge and branch state; a reported PASS is not live CI, merged implementation, production authorization, or Canon.
5. **Open, blocked, not-run, or awaiting review — PASS.** Cards 1–8 preserve unresolved Crystal artifact location, TCE follow-up gates, unknown Beacon causality, GSJ freeze/GO, E0-B labels and unrun blind tests, CONT-E0T unrecovered raw evidence, Graphiti's unrun annotation/ablation, and SIGNET's Step-0 source gap. Cards 12–23 preserve owner-review, proposal, candidate, not-run, and authorization boundaries.
6. **Canon/runtime boundary — PASS.** The index declares `RESEARCH_INDEX_ONLY`, `CANON=NO`, `RUNTIME_AUTHORITY=NO`, and `PRIMARY_EVIDENCE=NO`. §A and `AGENT_START_HERE.md` prohibit promoting research summaries, model output, or experimental work into Canon/runtime authority.
7. **Finding exact evidence and treating missing pointers — PASS.** Follow a card's `PRIMARY_EVIDENCE` and exact `GITHUB_REF`; preserve unresolved sources as unresolved. §B, R17, and §F distinguish unresolved D03 from separately reviewed D06; D06 is not a substitute. R01's Crystal primary artifact path and R06's raw run artifacts remain unresolved/unrecovered.
8. **What not to repeat — PASS.** `AGENT_START_HERE.md` and §E require a new question and authorization before repeating work. Cards preserve specific stop gates for TCE/Beacon, CONT-E0T, GSJ, E0-B, Graphiti, and continuity stages.

**Fresh-reader result:** PASS for Q1–Q8. Material caveats are navigable but prevent stronger claims: the exact Crystal E0 primary artifact path is unresolved; CONT-E0T raw evidence is unrecovered and its reproduction package is unsealed; D01 predates PR #27/#28; D03 remains unresolved/404; and several tests are source-recorded rather than live CI.

## Structural checks

- Index declares `STATUS=RESEARCH_INDEX_ONLY`, `CANON=NO`, `RUNTIME_AUTHORITY=NO`, and `PRIMARY_EVIDENCE=NO`.
- All 23 numbered experiment cards retain the required experiment, claim, status, limitation, evidence-pointer, source-status, `CONSISTENCY`, `LAST_VERIFIED`, and `NOTES` fields.
- All 23 reconciliation entries in §C.1 identify claim-level sources and the reason for their classification.
- External source catalogue contains **14 Notion + 6 Drive + 20 GitHub = 40 records**; each has `SOURCE_SYSTEM=`, `SOURCE_TITLE=`, `SOURCE_ID=`, and `SOURCE_ROLE=`.
- Read-only Drive content review covered **5 sources (D01, D02, D04, D05, D06)**. Owner-verified access remains source-specific. D03 is unresolved/404; the distinct D06 is not a replacement.
- Claim-level counters are `MATCH=18`, `PARTIAL_MISMATCH=2`, `STALE_DRIVE=3`, `STALE_NOTION=0`, `SOURCE_ONLY_NOTION=0`, `SOURCE_ONLY_DRIVE=0`, and `UNKNOWN=0`. `PARTIAL_MISMATCH` marks source-pointer/chronology limitations, not an invented experimental contradiction; `STALE_DRIVE` reflects the verified D01 timestamp predating later PR creation.
- `AGENT_START_HERE.md`, `docs/research/EXPERIMENT_EVIDENCE_INDEX.md`, and this validation file are the only authorized PR paths. T3.2 adds no Canon, runtime, memory, ledger, or `wiz_ref` changes.

## Recorded run — PRE-MERGE VALIDATION SNAPSHOT

```text
FRESH_READER_RESULT=PASS (Q1-Q8, independent read-only reviewer)
FRESH_READER_SCOPE=AGENT_START_HERE.md + docs/research/EXPERIMENT_EVIDENCE_INDEX.md only
STRUCTURAL_RESULT=PASS (git diff --check; 23 cards; 23 reconciliation rows; 40 source records; required fields present; only authorized gateway paths changed)
MATCH=18
PARTIAL_MISMATCH=2
STALE_NOTION=0
STALE_DRIVE=3
SOURCE_ONLY_NOTION=0
SOURCE_ONLY_DRIVE=0
UNKNOWN=0
DRIVE_REGISTRY_VERIFIED=OWNER_VERIFIED_ACCESS_YES (D01; D02/D04/D05 and separate D06 also owner-verified)
DRIVE_DOCS_REVIEWED=5 (D01, D02, D04, D05, D06)
D03=NOT_FOUND/404; IDENTITY_AND_PROVENANCE=UNRESOLVED; DO_NOT_SUBSTITUTE_D06
PR31_STATE=OPEN/DRAFT; MERGED=NO; READY=NO
PR31_HEAD_AT_REVIEW_START=f6edf764b44d3065ab72508f1baea5aecdcc2dd4
OVERALL_RESULT=PASS_WITH_SOURCE_LIMITATIONS; KEEP_PR_OPEN_DRAFT
```

## POST-MERGE VERIFICATION

```text
PR31=MERGED
MERGE_COMMIT=3653345d7ba40ceab22d7d6d1781f4b2c0b8abcd
CURRENT_MAIN=3653345d7ba40ceab22d7d6d1781f4b2c0b8abcd
GATEWAY_FILES_PRESENT=YES (AGENT_START_HERE.md; docs/research/EXPERIMENT_EVIDENCE_INDEX.md; docs/research/evidence-index-validation.md)
```

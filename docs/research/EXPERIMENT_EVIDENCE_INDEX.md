# Eiti-Wizard-Lab — Experiment & Evidence Index

STATUS: `RESEARCH_INDEX_ONLY`\
CANON: `NO`\
RUNTIME_AUTHORITY: `NO`\
PRIMARY_EVIDENCE: `NO`\
LAST_VERIFIED: `2026-10-06` (Notion and GitHub checks; Drive pages could not be rendered)

PURPOSE: Point a new agent to completed and open research lines, their bounded results, limits, and primary evidence. This is a navigation layer; it does not establish a result, authorize a run, or change project state.

> **Registry ≠ primary evidence. Summary ≠ primary evidence. Research result ≠ Canon. Test PASS ≠ production GO. Model output ≠ evidence. UNKNOWN ≠ FALSE.**

## A. Source authority and evidence hierarchy

Use the most direct available source for the claim being checked:

1. **Raw or frozen experiment artifacts** — original inputs, outputs, annotations, manifests, hashes, and run receipts. Confirm their completeness and provenance before relying on them.
2. **Exact GitHub evidence** — repository, commit SHA, path, test/log, or PR head. A PR’s open/draft state and a recorded test report are not the same as a merged change or independently verified CI.
3. **Dedicated experiment report** — useful for methods, interpretation, and pointers; not a substitute for missing raw artifacts.
4. **Experiment Registry** — cross-project discovery and status map; not primary evidence.
5. **Checkpoint or synthesis** — orientation and lifecycle context; check mutable facts against the live source.
6. **Model summary** — a lead to verify, never evidence by itself.

Keep these distinctions intact: `RETRIEVAL ≠ TRUTH`; `CROSS_MODEL_REPRODUCED ≠ ROOT_CAUSE_PROVEN`; `CONTINUATION ≠ FAITHFUL REPRODUCTION`; `GOOD RESUME / GOOD SUMMARY ≠ CORRECT STATUS HISTORY`; `NOT_CHOSEN ≠ REJECTED`; `OPEN_OPTION_SET ≠ USER_COMMITMENT`; `TCE ≠ LEARNING`; `CONTINUITY ≠ EXPERIENCE`; `MEMORY_FIDELITY ≠ STATE_TRANSITION_CORRECTNESS`; `AGREEMENT ≠ VALIDITY`; `DISAGREEMENT ≠ MODEL_FAILURE`; `BLOCKED ≠ FAIL`; `RESEARCH_RESULT ≠ CANON`; `TEST_PASS ≠ PRODUCTION_GO`.

## B. Global registries and cross-source status

**Notion — Experiment Registry** is the main discovery map: [N01](#f-external-source-records).\
**Google Drive — companion Experiment Registry** is intended as the long-form registry/evidence companion: [D01](#f-external-source-records).

**Drive status is per source, not global.** Owner-side connected Drive verification says content is accessible for D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`), D02 (`1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs`), D04 (`1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA`), and D05 (`1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM`). This is **owner-verified availability**, not a claim that this task independently reviewed the documents.

The current authorized browser session was tried read-only on D01, D02, D04, and D05. In each, Google Docs displayed: “Не удалось открыть файл, поскольку в вашем браузере отключено использование JavaScript. Включите его и перезагрузите страницу.” The document titles were visible, but no document body text was available for comparison. This is a browser/tool limitation, not evidence that the documents are absent or that their claims match. Accordingly `DRIVE_REGISTRY_VERIFIED=OWNER_VERIFIED_ACCESS_YES (D01; local content review not completed)` and `DRIVE_DOCS_REVIEWED=0` (content-level reviews). All 23 cards retain `CONSISTENCY=UNKNOWN`; claim-level reasons and exact Notion/Drive/GitHub references are recorded in §C.1. Do not infer `MATCH`, `STALE_*`, or `SOURCE_ONLY_*` from availability alone.

D03’s current locator `1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k` was reported by the owner as NOT FOUND/404 through connected Drive. Its identity/provenance is unresolved; this is not a finding that the source is absent or deleted. The similar but different ID is recorded separately as D06 and must not replace D03.

Notion page timestamps vary. `LAST_VERIFIED` below means the page/branch was checked on 2026-10-06; use the source’s own date for the age of its claims. For source-record details, see [External source records](#f-external-source-records).

## C. Experiment line index

### 1. Crystal E0 / Project Aurora

EXPERIMENT_ID / NAME: `Crystal E0 / Project Aurora`, including E0-SMOKE-01, E0-GROK-01, E0-GPT6-LUNA-01, E0-DEEPSEEK-V41-01, E0-FINDING-TEMPORAL-01, and E0-FINDING-META-RETRIEVAL-01.\
PROJECT: Velantrim Exo-Cortex Crystal.\
QUESTION: Bounded conflict/currentness and retrieval questions; consult the frozen protocol for exact contrasts.\
STATUS: Registry says the current bounded temporal question is closed and META-RETRIEVAL-01 remains open.\
EXECUTION_VERDICT: `UNKNOWN` in the reviewed Registry excerpt; `CROSS_MODEL_REPRODUCED` is a status label, not a run-level PASS/FAIL verdict. Individual raw runs were not inspected here.\
SCIENTIFIC_INTERPRETATION: Replication across models supports a bounded observed pattern, not its root cause.\
WHAT_WAS_OBSERVED: Registry reports temporal/currentness findings across model-labelled runs and a separate open meta-retrieval finding.\
WHAT_IT_SUPPORTS: Reopening the bounded temporal question only if a new, distinct question or evidence justifies it.\
WHAT_IT_DOES_NOT_PROVE: A root cause, universal cognition law, complete memory mechanism, or production readiness.\
OPEN_FINDING: META-RETRIEVAL-01; exact primary artifact paths and current external repository state remain unverified here.\
PRIMARY_EVIDENCE: Frozen source SHA `3ed3a53ee9b8445a5f2ebf16046f782a3095555e` is reported by the Registry; artifact path not verified.\
GITHUB_REF: [GH17](#f-external-source-records).  NOTION_REF: [N01](#f-external-source-records), [N12](#f-external-source-records).  DRIVE_REF: [D01](#f-external-source-records); any dedicated report is unverified.\
NOTION_STATUS: Bounded temporal question closed; meta-retrieval open.  DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `CROSS_MODEL_REPRODUCED != ROOT_CAUSE_PROVEN`.

### 2. TCE / Snapshot / Observer / Continuity

EXPERIMENT_ID / NAME: TCE-TRIAL-04A-MAIN, 04B, OBSERVER-01, SLOT-01, TCE-LIVE-01, plus the bounded TCE continuity line.\
PROJECT: TCE research line.\
QUESTION: Can compact external state support a bounded continuation while preserving decisions, constraints, actor/status, open questions, and non-selection?\
STATUS: Multiple bounded captures/resume observations are recorded; TCE-LIVE-01 capture audit is complete, with **no resume yet**.\
EXECUTION_VERDICT: 04B demonstrated continuation sufficiency in one run; Observer benefit is not established; allowing `NOT_PRESENT` alone did not remove the observed status mixing in one run; TCE-LIVE-01 showed material state-fidelity problems.\
SCIENTIFIC_INTERPRETATION: Continuation can coexist with poor state/authority fidelity. The page does not establish a universal mechanism or solve learning.\
WHAT_WAS_OBSERVED: 04A preserved the unselected options; 04B resumed the thread and the model then selected a new direction. Observer/SLOT runs lost the unselected options. TCE-LIVE-01 promoted some model proposals into apparently shared decisions in the Snapshot.\
WHAT_IT_SUPPORTS: Separate measurement of continuation sufficiency, capture fidelity, and status/authority fidelity.\
WHAT_IT_DOES_NOT_PROVE: Observer superiority, a model effect separated from role/context, a universal compression mechanism, EDCA, learning, or state-transition correctness.\
OPEN_FINDING: A bounded state-safe capture/carry-forward design; separate GO is required before any proposed follow-up.\
PRIMARY_EVIDENCE: Dedicated Notion experiment report N06 contains frozen-source and output hashes; direct Drive companion D02 is not readable here. Raw bytes were not independently recovered in this task.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab for these TCE runs. NOTION_REF: [N06](#f-external-source-records). DRIVE_REF: [D02](#f-external-source-records), plus [D01](#f-external-source-records); both unverified.\
NOTION_STATUS: Bounded runs complete with the limitations above. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `CONTINUATION != FAITHFUL REPRODUCTION`; `GOOD RESUME != GOOD CAPTURE`; `NOT_CHOSEN != REJECTED`; `TCE != LEARNING`.

### 3. Beacon experiments

EXPERIMENT_ID / NAME: TCE-BEACON-LIVE-01 Condition B; STRESS-01; TAIL-02; candidate JST-CAUSAL-01 and JST-RETRACT-02.\
PROJECT: TCE / Beacon line.\
QUESTION: Does a persistent Beacon help preserve the user’s current research direction without anchoring unrelated or changed topics?\
STATUS: Condition B is recorded complete with five calls and frozen raw run; there was no matched Condition A. The registry says no robust causal benefit is established; TAIL-02’s localized T15 effect is disputed. JST follow-ups are candidates, not completed results.\
EXECUTION_VERDICT: Condition B run recorded complete (five calls, raw run frozen); no matched Condition A was run.\
SCIENTIFIC_INTERPRETATION: No robust causal benefit is established; the TAIL-02 localized T15 effect is disputed.\
WHAT_WAS_OBSERVED: The bounded Condition B responses remained broadly aligned; no matched control establishes that Beacon caused this. The registry reports a disputed localized T15 effect for TAIL-02.\
WHAT_IT_SUPPORTS: Further bounded causal/retraction tests only after separate authorization and a defined contrast.\
WHAT_IT_DOES_NOT_PROVE: Robust Beacon benefit, necessity of Beacon, or a final memory architecture.\
OPEN_FINDING: JST-CAUSAL-01 and JST-RETRACT-02 remain candidate next experiments; exact protocols need review.\
PRIMARY_EVIDENCE: N06 describes the live condition; raw artifacts are referenced there, not copied here.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N01](#f-external-source-records), [N06](#f-external-source-records). DRIVE_REF: [D02](#f-external-source-records), unreadable here; [D01](#f-external-source-records) is the global registry.\
NOTION_STATUS: No robust causal benefit; TAIL-02/T15 disputed; follow-ups candidate. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not repeat Condition B as a causal test without a matched control and a distinct question.

### 4. GSJ — Ground-Sensitive Judgment

EXPERIMENT_ID / NAME: GSJ v0.5.1 semantic preflight.\
PROJECT: GSJ benchmark line.\
QUESTION: Can reviewers apply the active rule set to frozen benchmark cases without relying on answer-revealing cues?\
STATUS: Registry reports semantic preflight PASS; formal preregistration is not frozen and the formal pilot is not authorized.\
EXECUTION_VERDICT: 36/36 isolated decision-and-ground matches are reported for the preflight; this is not a formal pilot result.\
SCIENTIFIC_INTERPRETATION: The preflight supports the frozen item set’s semantic readiness for the stated scope, not independent model generality or a pilot outcome.\
WHAT_WAS_OBSERVED: The Registry reports two isolated reviewer passes after repair and 36/36 decision/ground agreement. The older v0.4.2 journal records earlier ambiguity and is historical, not the current result.\
WHAT_IT_SUPPORTS: No further rewrite is warranted on the reported v0.5.1 preflight evidence; artifact integrity/freeze and separate owner GO remain gates.\
WHAT_IT_DOES_NOT_PROVE: Formal-pilot performance, general reasoning ability, or authorization to run.\
OPEN_FINDING: Exact frozen v0.5.1 artifacts/hashes and owner authorization.\
PRIMARY_EVIDENCE: N07 is an older journal; current summary is N01. Exact v0.5.1 primary artifact path was not verified.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N01](#f-external-source-records), [N07](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); linked companion not verified.\
NOTION_STATUS: Preflight PASS; formal pilot not authorized. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `PREFLIGHT PASS ≠ FREEZE ≠ RUN AUTHORIZATION`.

### 5. E0-B Typing Reliability

EXPERIMENT_ID / NAME: E0-B, including the fresh U0 reference and U0b boundary/provenance work.\
PROJECT: Eiti-Wizard-Lab memory governance.\
QUESTION: Can human act-count and semantic intent be frozen and qualified well enough to support later typing-reliability comparisons?\
STATUS: Latest Registry/checkpoint says fresh U0 count and semantic intent are frozen 30/30; exact boundary/provenance remains open. Phase 1B corpus capture is complete, but human labels are pending and the blind run was not run.\
EXECUTION_VERDICT: Phase 1B corpus capture recorded complete; human labels are pending and the blind run plus A0/A1/B are `NOT_RUN`.\
SCIENTIFIC_INTERPRETATION: The current freeze is a bounded reference step, not a classifier result. Historical model-exposed boundary material is provenance-qualified and is not strict-blind gold.\
WHAT_WAS_OBSERVED: 30/30 human U0 count/intent entries are reported frozen; exact textual boundaries are not fully established; the E0-B PR result explicitly says ground truth pending and blind run not run.\
WHAT_IT_SUPPORTS: Continue only with the documented human-label/provenance disposition; do not claim typing accuracy.\
WHAT_IT_DOES_NOT_PROVE: Strict-blind human gold, model performance, or that exposed material is useless.\
OPEN_FINDING: U0b durable boundary/provenance artifact and human-label gate.\
PRIMARY_EVIDENCE: Open PR #7 head `b14fbd76995c36c69526103a3598f4c753d5bb31`, `experiments/memory-governance-e0b/RESULT.md`, `SOURCE_INTEGRITY_REPORT.md`, and recovery manifest; status remains on an unmerged branch.\
GITHUB_REF: [GH03](#f-external-source-records). NOTION_REF: [N04](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); dedicated companion not verified.\
NOTION_STATUS: U0 30/30 frozen; boundary/provenance open; A0/A1/B not run. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `MODEL-EXPOSED ≠ USELESS`, but model-exposed ≠ strict-blind gold.

### 6. CONT-E0T

EXPERIMENT_ID / NAME: CONT-E0T confirmatory transfer result and reproducibility recovery.\
PROJECT: Velantrim Continuum.\
QUESTION: Under the frozen contrast, does adding the tested transfer representation improve practical resume adequacy over the bounded current-state comparator?\
STATUS: Historical run is `RUN_REPORTED_COMPLETE / RESULT_RECORDED`; `RAW_RUN_EVIDENCE=NOT_RECOVERED`; `REPRODUCIBILITY_PACKAGE=NOT_SEALED`; Issue #57 closed under the fail-closed rule.\
EXECUTION_VERDICT: Run is reported complete: four fixtures × two arms; all eight outputs were `PRIMARY_PARTIAL`; `S=0, I=0, U=4`. Raw run evidence was not recovered.\
SCIENTIFIC_INTERPRETATION: `CLAIM_B_SUPPORT=UNDERDETERMINED`; both arms were inadequate at the frozen threshold, so the contrast is uninformative about a history/trajectory advantage.\
WHAT_WAS_OBSERVED: The recorded result reports over-abstention and incomplete relation composition; the original raw responses and run receipts were not recovered.\
WHAT_IT_SUPPORTS: Preserve the historical recorded result and its underdetermined status.\
WHAT_IT_DOES_NOT_PROVE: History is useless/necessary, trajectory superiority, event-sourcing necessity, or an independently reproduced result.\
OPEN_FINDING: Original raw artifacts were not recovered and the package was not sealed; no reconstruction or rerun is authorized by the status note.\
PRIMARY_EVIDENCE: Frozen source SHA `6847eb759d747955b8618021d2414f5ffa840584`; exact raw run artifacts unavailable per the Continuum status record.\
GITHUB_REF: [GH19](#f-external-source-records). NOTION_REF: [N08](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); direct report not verified.\
NOTION_STATUS: Result recorded, raw evidence not recovered, package not sealed. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not reconstruct missing outputs from summaries; `RESULT RECORDED ≠ RAW ARTIFACTS RECOVERED`.

### 7. Graphiti FM-13 → FM-17-pre

EXPERIMENT_ID / NAME: Graphiti Fractal memory line FM-13 through FM-17-pre.\
PROJECT: Graphiti Fractal Lab.\
QUESTION: If query/fact structure were oracle-correct, would typed structural qualification add measurable value over frozen CrossEncoder ranking?\
STATUS: FM-17-pre protocol/integrity is recorded `PASS_WITH_MINOR_FINDINGS`; offline ablation is a permitted next step; real annotation/A0–A3 were not run.\
EXECUTION_VERDICT: Preflight PASS_WITH_MINOR_FINDINGS; outcome-producing annotation/ablation remains not run.\
SCIENTIFIC_INTERPRETATION: Structural value, Honest Empty, and multi-hop benefit are not established by preflight.\
WHAT_WAS_OBSERVED: The checkpoint reports independent verification of T27/T28/T29 and P7, with the enforcement suite `40 passed, 1 warning`; no new material R1+R2+R3 bypass remained. This is protocol/integrity evidence, not an ablation outcome.\
WHAT_IT_SUPPORTS: Proceed only within the allowed offline ablation scope if separately authorized.\
WHAT_IT_DOES_NOT_PROVE: Structural memory value, Honest Empty, multi-hop capability, or production suitability.\
OPEN_FINDING: Real annotation and A0–A3 remain unrun; exact result artifacts/path must be read at the target commit.\
PRIMARY_EVIDENCE: N05 points to GitHub commit `080e1959fe6a3d996f2690059fcdc687dd5c832e` and `docs/research/fm17_pre/` on the experiment branch; not independently opened in this task.\
GITHUB_REF: [GH18](#f-external-source-records). NOTION_REF: [N05](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D04](#f-external-source-records), not content-verified here; [D01](#f-external-source-records) is the global registry.\
NOTION_STATUS: Preflight pass with minor findings; ablation readiness only. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Preflight readiness is not an experiment outcome.

### 8. SIGNET-TRACE / SOURCE-RECOVERY

EXPERIMENT_ID / NAME: SIGNET-TRACE-01 / SOURCE-RECOVERY-01-R1.\
PROJECT: Crystal/SIGNET research.\
QUESTION: Can a real status-promotion case be traced end to end from attributable raw source through admission and current standing?\
STATUS: `BLOCKED_AT_STEP_0_BY_SOURCE_GAP`; end-to-end result not obtained; Protocol v0.1 not validated and not falsified end to end.\
EXECUTION_VERDICT: `BLOCKED`, not FAIL.\
SCIENTIFIC_INTERPRETATION: Available derived documents did not substitute for the missing raw conversation source.\
WHAT_WAS_OBSERVED: Primary raw source, provider-native locator, chronology, and completeness boundary were not recovered; no UserSelected/UserRejected event was created.\
WHAT_IT_SUPPORTS: A bounded source-recoverability finding only.\
WHAT_IT_DOES_NOT_PROVE: A successful E2E trace, protocol validation/falsification, or any admission/status mutation.\
OPEN_FINDING: Re-entry requires an attributable raw/exported conversation with chronology and an explicit completeness boundary.\
PRIMARY_EVIDENCE: Source-recovery record says `PRIMARY_RAW_SOURCE=NOT_RECOVERED`; detailed run record is on the Crystal research branch.\
GITHUB_REF: [GH20](#f-external-source-records). NOTION_REF: [N06](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); linked Drive protocol not verified.\
NOTION_STATUS: Blocked at Step 0 by source gap. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not re-label derived-document analysis as the E2E trace result.

### 9. E0-A Ownership & Governance Conformance Probe

EXPERIMENT_ID / NAME: E0-A.\
PROJECT: Eiti-Wizard-Lab memory governance.\
QUESTION: Given correct typing, can governance act safely in the bounded probe?\
STATUS: Result artifacts exist on OPEN PR #6; not merged to main.\
EXECUTION_VERDICT: The PR’s `RESULTS.md` records PASS for five bounded checks: model proposal ≠ user decision; no silent erasure; rejected branch remains retrievable; unsupported model claim is non-authoritative; resume restores task state/next action. No live GitHub checks were listed.\
SCIENTIFIC_INTERPRETATION: Reported synthetic/bounded conformance evidence, not general proof of memory governance.\
WHAT_WAS_OBSERVED: Those five checks are recorded as PASS; the report says no new organ for this slice.\
WHAT_IT_SUPPORTS: The specific tested invariants at the recorded PR head.\
WHAT_IT_DOES_NOT_PROVE: Production safety, broader cognition, or merged/main behavior.\
OPEN_FINDING: PR #6 remains open; check its exact head and tests before treating it as current main evidence.\
PRIMARY_EVIDENCE: PR #6 head `c36c5bc1fb9ddd5a54a8499cf9439e35ba3ca19c`, `experiments/memory-governance-e0a/RESULTS.md`, `logs/test_run.txt`, and `tests/test_e0a.py`.\
GITHUB_REF: [GH02](#f-external-source-records). NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); dedicated companion not verified.\
NOTION_STATUS: E0-A is a current consolidated line; exact Registry summary details should be rechecked. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: This E0-A result is on a branch; do not report it as merged.

### 10. Memory Admission Controller v0.1

EXPERIMENT_ID / NAME: Memory Admission Controller v0.1 (REVIEW mode).\
PROJECT: Eiti-Wizard-Lab memory admission.\
QUESTION: Can a staged review/apply flow preserve source/status boundaries and fail safely under tested writes and races?\
STATUS: OPEN/DRAFT PR #10; code and test records are not merged.\
EXECUTION_VERDICT: The checkpoint records 38/38 DB tests, 13/13 admission-browser tests, 36/36 existing reference-memory DB tests, 10/10 existing reference-memory browser tests, and private scan PASS/0 hits at test commit `e286c50`. No live PR checks were listed.\
SCIENTIFIC_INTERPRETATION: Source-recorded bounded implementation tests; not independent live CI or production authorization.\
WHAT_WAS_OBSERVED: Reported suites cover review/apply/dismiss, persistence, race, stale-plan, and rollback cases; the checkpoint also lists residual durability/concurrency/host-authority limitations.\
WHAT_IT_SUPPORTS: The tested behavior at the cited test commit, subject to its listed limitations.\
WHAT_IT_DOES_NOT_PROVE: Authenticated host authority, scale readiness, all crash/race outcomes, or production/Canon suitability.\
OPEN_FINDING: Independent final audit and the documented residual limitations; no evidence of a merge.\
PRIMARY_EVIDENCE: PR #10 checkpoint `docs/checkpoints/MEMORY_ADMISSION_CONTROLLER_v0.1.md` and `tests/admission/` at the recorded test commit.\
GITHUB_REF: [GH04](#f-external-source-records). NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Present under Eiti admission line; details require Registry verification. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `IMPLEMENTED ≠ ACTIVATED`; `TESTED ≠ PRODUCTION_AUTHORIZED`.

### 11. Eiti-Wizard-Lab continuity stages M1 / M2 / M2.1 / M2.1.1 / M2.2a / M3

EXPERIMENT_ID / NAME: Eiti continuity carrier and provider-neutral orientation stages.\
PROJECT: Eiti-Wizard-Lab.\
QUESTION: Can source-qualified continuity state be represented, exported, validated, and read through bounded project stages without silently granting admission/write authority?\
STATUS: **Stage map:** M1 PR #13 merged to `main`; M2 export-context PR #15 merged to `main`; M3 read-only runtime bridge PR #16 merged at current `main@826e27a`. Separate carrier branch `lab/continuity-carrier-m1@e9e5ea3` contains M2.1 PR #14, M2.1.1 PR #18/#20, and M2.2a PR #25; those later carrier stages are **not merged to main**.\
EXECUTION_VERDICT: Main-branch M3 checkpoint reports 66/66 Node tests and seed validation of 79 records with 0 errors/0 warnings. Separate M2.1/M2.1.1/M2.2a memory-layer checks passed; the M2.2a checkpoint reports 52/52 ledger, 18/18 seed, 10/10 browser, and Reference DB 35/36 with the reproduced baseline `CACHE_NAME not bumped`.\
SCIENTIFIC_INTERPRETATION: These are bounded implementation/check results, not evidence of learning, subjective continuity, or production authorization.\
WHAT_WAS_OBSERVED: M1 declarations and M2/M3 read-only orientation are in main; later OBSERVED-only ledger/intake/step work remains on its separate experimental carrier branch.\
WHAT_IT_SUPPORTS: The exact tests and bounded stage semantics at the referenced commits.\
WHAT_IT_DOES_NOT_PROVE: USER ADMIT, Canon apply, authenticated writer, provider portability, experience, or that later carrier stages are part of main.\
OPEN_FINDING: Checkpoint says stop before M2.2b; resolve the documented baseline issue and obtain the appropriate review before any next stage.\
PRIMARY_EVIDENCE: M1/M2/M3 exact PRs and paths are GH05–GH07; M2.1/M2.1.1/M2.2a are GH08–GH11. Main SHA `826e27abb9e1f114a11773adc2a79e1bc60927d0`; carrier SHA `e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31`.\
GITHUB_REF: [GH01](#f-external-source-records), [GH05](#f-external-source-records)–[GH11](#f-external-source-records). NOTION_REF: [N02](#f-external-source-records), [N03](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records), plus any linked report UNKNOWN.\
NOTION_STATUS: M1/M2/M2.1/M2.1.1/M2.2a bounded checkpoints complete; branch distinction and stop retained. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not conflate the merged main line with the later carrier branch. `IMPLEMENTED ≠ ACTIVATED`; `EXPERIMENTAL ≠ OFFICIAL_MEMORY`.

### 12. Ruslan Experimental Continuity Memory v0.1

EXPERIMENT_ID / NAME: `experiments/ruslan-experimental-memory/` v0.1.\
PROJECT: Eiti-Wizard-Lab experimental memory.\
QUESTION: Can a fresh session recover the bounded stop point and next action from the experimental project memory?\
STATUS: Exists only on OPEN/DRAFT PR #28 at head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`; not in main.\
EXECUTION_VERDICT: The PR contains test/result artifacts; a recorded cross-session PASS is linked below. No GitHub checks were listed; the memory contents were not copied into this index.\
SCIENTIFIC_INTERPRETATION: A bounded result on the recorded project source; not proof of general memory continuity or official/Canon status.\
WHAT_WAS_OBSERVED: Result artifacts and lifecycle/clean-resume tests exist on the draft branch.\
WHAT_IT_SUPPORTS: Review of that exact experimental branch and its recorded scope.\
WHAT_IT_DOES_NOT_PROVE: A merged feature, complete research continuity, broad reliability, or authority over official memory.\
OPEN_FINDING: Owner review of the v0.1 result; scope and provenance should be checked before reuse.\
PRIMARY_EVIDENCE: PR #28 paths `README.md`, `RUSLAN_EXPERIMENTAL_MEMORY.md`, `CROSS_SESSION_TEST_PLAN.md`, `tests/lifecycle.test.mjs`, and `tests/clean-resume.test.mjs` at the exact PR head. Sensitive memory content is intentionally not reproduced here.\
GITHUB_REF: [GH13](#f-external-source-records). NOTION_REF: [N02](#f-external-source-records), [N10](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); no Drive content verified.\
NOTION_STATUS: Workspace design proposal remains non-Canon; exact scope match to PR #28 is unresolved. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: This answers “where did we stop and what should the next session continue?”; it is not the evidence index.

### 13. Cross-session AI Resume Test

EXPERIMENT_ID / NAME: `CROSS_SESSION_AI_RESUME_TEST` v0.1 (PR #28 result artifacts).\
PROJECT: Eiti-Wizard-Lab experimental memory.\
QUESTION: Can a fresh session recover the project lane, last stop, open question, and next action without prior chat history?\
STATUS: Recorded PASS in the OPEN/DRAFT PR #28 branch; not merged.\
EXECUTION_VERDICT: `PASS` as recorded; `NEXT_ACTION_ERRORS=0`; `OPEN_QUESTION_ERRORS=0`. No GitHub CI checks were listed and this index did not rerun the experiment.\
SCIENTIFIC_INTERPRETATION: Bounded pass for the recorded project source and criteria only.\
WHAT_WAS_OBSERVED: The result record reports zero next-action and open-question errors and points to a Session B result.\
WHAT_IT_SUPPORTS: That bounded resume result at the exact branch head, pending owner review.\
WHAT_IT_DOES_NOT_PROVE: General memory reliability, production readiness, Canon authority, or equivalence to the later Working Research Workspace proposal.\
OPEN_FINDING: Owner review; establish whether this result satisfies the separately proposed workspace test before treating the two as the same experiment.\
PRIMARY_EVIDENCE: `experiments/ruslan-experimental-memory/tests/results/cross-session-v01/result.md` and `checkpoints/2026-10-05-cross-session-pass-v01.md` at PR #28 head.\
GITHUB_REF: [GH13](#f-external-source-records). NOTION_REF: [N10](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Working Research Workspace page describes its first resume test as a candidate/next step; PR #28 records a separate-scope PASS. Do not silently reconcile. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `PASS` is recorded in an open draft branch; no independent reproduction is claimed.

### 14. Owner Authority / Personal Authority sandbox

EXPERIMENT_ID / NAME: Owner Authority Sandbox v0.1.\
PROJECT: Eiti-Wizard-Lab authority-boundary experiment.\
QUESTION: Can a synthetic passport/request decision path distinguish proposed context from owner-granted authority?\
STATUS: OPEN/DRAFT PR #27 on the separate continuity branch; not merged.\
EXECUTION_VERDICT: Test files exist (`pdp.test.mjs`, `replay.test.mjs`), but no PR checks or test result were listed; execution verdict is `UNKNOWN`.\
SCIENTIFIC_INTERPRETATION: At most a synthetic prototype; it is explicitly non-authoritative.\
WHAT_WAS_OBSERVED: PR file list contains synthetic fixtures, PDP code, harness, and test files.\
WHAT_IT_SUPPORTS: A pointer to an experimental test surface for owner review.\
WHAT_IT_DOES_NOT_PROVE: Real owner authority, permission to alter official memory, user intent, or any production security property.\
OPEN_FINDING: Review the exact branch and obtain test evidence before making claims.\
PRIMARY_EVIDENCE: PR #27 head `2d6877fc937f3b09c93d68c9b950170b358495d8`, `experiments/owner-authority-sandbox/`; synthetic fixtures are labeled as such.\
GITHUB_REF: [GH12](#f-external-source-records). NOTION_REF: [N01](#f-external-source-records), [N10](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Authority boundaries are research proposals; no Canon/runtime authorization. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `OWNER_AUTHORITY_SANDBOX ≠ OWNER_AUTHORITY`; do not merge with the memory or evidence-index layer.

### 15. Working Research Workspace / Digital Identity Routing

EXPERIMENT_ID / NAME: Working Research Workspace v0.1 and Digital Identity / Owner Passport routing proposal.\
PROJECT: Eiti-Wizard-Lab research architecture.\
QUESTION: Can a fresh agent find the authoritative thread, last stop, bounded next action, and source locations without prior chat history?\
STATUS: Design proposal in OPEN/DRAFT PR #30; no run result is recorded there.\
EXECUTION_VERDICT: `NOT_RUN` for this proposal’s first experiment.\
SCIENTIFIC_INTERPRETATION: A candidate workspace/routing design, not an experiment result, Canon, or runtime authority.\
WHAT_WAS_OBSERVED: The Notion page and PR describe candidate fields, storage routes, and a proposed first resume test; they also explicitly separate auto-routing from auto-admission.\
WHAT_IT_SUPPORTS: Using stable IDs, source references, bounded statuses, and an explicit owner-review/admission boundary as design questions.\
WHAT_IT_DOES_NOT_PROVE: A working retrieval system, correct automatic routing, successful resume, or any authority to promote content to Canon.\
OPEN_FINDING: Design/test the isolated v0.1 workspace and review the first cross-session test; clarify whether PR #28’s recorded PASS meets this proposal’s criteria.\
PRIMARY_EVIDENCE: PR #30’s single proposal file `docs/research/working-research-workspace/WORKING_RESEARCH_WORKSPACE.md` at head `9c2410d0a026748ccb2f13cfef41d12040776ea6`; no test artifact.\
GITHUB_REF: [GH14](#f-external-source-records). NOTION_REF: [N10](#f-external-source-records). DRIVE_REF: [D05](#f-external-source-records), architecture link from N10; not content-verified here.\
NOTION_STATUS: Research/architecture proposal; first test is candidate/next step. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `AUTO-ROUTING ≠ AUTO-ADMISSION`; `WORKSPACE ≠ CANON`.

### 16. HLC Human ↔ LLM behavioral trace line

EXPERIMENT_ID / NAME: HLC-001-PILOT-A; HLC-001B; HLC-001-PILOT-B P04–P05 (with P06/P07 extensions); HLC-MODALITY-01.\
PROJECT: Human Cognition / LLM behavioral research.\
QUESTION: What bounded behavioral differences and revision patterns appear when a human and specific AI products answer matched or follow-up probes?\
STATUS: **PILOT-A:** exploratory, three questions, one human participant (N=1), non-blind; primary transcript is not frozen as a standalone artifact. **HLC-001B:** preregistered/not yet run. **PILOT-B P04–P05 and P06/P07:** exploratory, post-exposure, non-blind, not controlled; generalization not authorized. **HLC-MODALITY-01:** candidate/not run.\
EXECUTION_VERDICT: PILOT-A/B provide bounded observational traces only; HLC-001B and HLC-MODALITY-01 have no run verdict.\
SCIENTIFIC_INTERPRETATION: Useful for methodology discovery and question generation; not evidence for a general human-vs-machine law or hidden cognitive mechanism.\
WHAT_WAS_OBSERVED: The dedicated review describes visible response differences across a small number of ordinary product questions and flags product context, participant exposure, and non-blind assessment as limits.\
WHAT_IT_SUPPORTS: A carefully controlled, predeclared follow-up measuring revision, source/actor status, uncertainty, and what remains unknown.\
WHAT_IT_DOES_NOT_PROVE: General human/LLM differences, a stable human trait, internal mechanisms, or medical/real-world competence.\
OPEN_FINDING: Freeze primary stimuli/transcripts and criteria; keep HLC-001B separate from Pilot-A; do not call extensions HLC-001B.\
PRIMARY_EVIDENCE: N11 is a secondary review and says the standalone Pilot-A transcript is not frozen; the Registry lists HLC-001B as preregistered/not run.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N01](#f-external-source-records), [N09](#f-external-source-records), [N11](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); other linked Research Program references are `UNKNOWN` because they were not reviewed.\
NOTION_STATUS: Pilot-A exploratory/non-blind; HLC-001B not run; Pilot-B exploratory/post-exposure/non-blind; HLC-MODALITY-01 candidate/not run. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `OBSERVED PRODUCT BEHAVIOR ≠ BASE-MODEL PROPERTY`; `SELF-REPORT ≠ COMPLETE MECHANISM`.

### 17. Human Cognition → Computational Reconstruction Map

EXPERIMENT_ID / NAME: Human Cognition → Computational Reconstruction Map (research synthesis; not an experiment).\
PROJECT: Human cognition / computational analogy research.\
QUESTION: Which human phenomena are well-supported, partial, open, or only candidate computational analogies?\
STATUS: Research synthesis dated 2026-10-05; not Canon, not a complete theory, and not primary experiment evidence.\
EXECUTION_VERDICT: `NOT_APPLICABLE` — synthesis, not a run.\
SCIENTIFIC_INTERPRETATION: The page explicitly distinguishes functional, biological, and consciousness reproduction; it leaves phenomenal consciousness and subject-pole questions open.\
WHAT_WAS_OBSERVED: It summarizes established/partial/unknown areas and bounded Eiti results including TCE and HLC.\
WHAT_IT_SUPPORTS: Research orientation and cautious hypothesis formation.\
WHAT_IT_DOES_NOT_PROVE: That a computational analogy reproduces a biological mechanism or subjective experience.\
OPEN_FINDING: Consciousness, subjectivity, identity, understanding, and durable learning remain open in the synthesis.\
PRIMARY_EVIDENCE: This map is a synthesis; follow its linked owning pages and experimental artifacts for primary evidence.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N09](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records), [D06](#f-external-source-records) (separate Human Cognition source; not D03).\
NOTION_STATUS: Current synthesis, not Canon. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `FUNCTIONAL REPRODUCTION ≠ BIOLOGICAL REPRODUCTION ≠ CONSCIOUSNESS REPRODUCTION`.

### 18. PAL-CONTAM-01

EXPERIMENT_ID / NAME: PAL-CONTAM-01.\
PROJECT: Candidate identifier present; exact owning project is `UNKNOWN` in the reviewed Registry excerpt.\
QUESTION: `UNKNOWN` — retrieve the dedicated protocol before interpretation.\
STATUS: Candidate/preregistered, not run, not authorized.\
EXECUTION_VERDICT: `NOT_RUN`.\
SCIENTIFIC_INTERPRETATION: No empirical result is available.\
WHAT_WAS_OBSERVED: The Registry lists the candidate; its detailed design was not reviewed.\
WHAT_IT_SUPPORTS: Navigation to a source for later verification only; no empirical inference.\
WHAT_IT_DOES_NOT_PROVE: That such bias occurs, its size, or any adapter effect.\
OPEN_FINDING: Locate and review the dedicated protocol, then verify scope and status; do not run without separate authorization.\
PRIMARY_EVIDENCE: Registry candidate listing only; no dedicated protocol or run artifact was verified.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Candidate/not run/not authorized. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Candidate ≠ roadmap commitment; do not run without separate GO.

### 19. FORK-01

EXPERIMENT_ID / NAME: FORK-01.\
PROJECT: Research candidate; exact owning project is `UNKNOWN` in the reviewed Registry excerpt.\
QUESTION: `UNKNOWN` — retrieve the linked protocol before interpretation.\
STATUS: Present in the Registry; execution state beyond candidate discovery is `UNKNOWN`.\
EXECUTION_VERDICT: `UNKNOWN`.\
SCIENTIFIC_INTERPRETATION: No result can be inferred from the identifier alone.\
WHAT_WAS_OBSERVED: Registry search confirms the identifier; no primary result was reviewed.\
WHAT_IT_SUPPORTS: Navigation to a source for later verification only.\
WHAT_IT_DOES_NOT_PROVE: Any completed run or scientific claim.\
OPEN_FINDING: Identify the owning protocol and explicit current status.\
PRIMARY_EVIDENCE: `UNKNOWN`; Registry is a discovery pointer only.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Identifier present; detailed status not verified. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not infer that it is run, failed, or authorized.

### 20. INTENT-CONTINUITY-EXTRACTION-01

EXPERIMENT_ID / NAME: INTENT-CONTINUITY-EXTRACTION-01.\
PROJECT: Research candidate; exact owning project is `UNKNOWN` in the reviewed Registry excerpt.\
QUESTION: `UNKNOWN` — retrieve the linked protocol before interpretation.\
STATUS: Candidate identifier present; exact protocol/run state is not independently verified.\
EXECUTION_VERDICT: `UNKNOWN`.\
SCIENTIFIC_INTERPRETATION: No result can be inferred from the identifier alone.\
WHAT_WAS_OBSERVED: Registry search confirms the identifier; no primary result was reviewed.\
WHAT_IT_SUPPORTS: Navigation to a source for later verification only.\
WHAT_IT_DOES_NOT_PROVE: Any completed run or continuity claim.\
OPEN_FINDING: Locate the dedicated source and verify scope and status.\
PRIMARY_EVIDENCE: `UNKNOWN`; Registry is a discovery pointer only.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Identifier present; exact status unresolved. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `CONTINUITY ≠ EXPERIENCE`.

### 21. JST-CAUSAL-01

EXPERIMENT_ID / NAME: JST-CAUSAL-01.\
PROJECT: Research candidate; exact owning project is `UNKNOWN` in the reviewed Registry excerpt.\
QUESTION: `UNKNOWN` — consult the candidate protocol.\
STATUS: Candidate next experiment, not a completed result.\
EXECUTION_VERDICT: `NOT_RUN` (Registry labels it candidate, not completed).\
SCIENTIFIC_INTERPRETATION: No causal finding is available.\
WHAT_WAS_OBSERVED: The Registry lists it alongside JST-RETRACT-02 as a candidate.\
WHAT_IT_SUPPORTS: A future bounded causal question only after protocol review.\
WHAT_IT_DOES_NOT_PROVE: Any cause or effect.\
OPEN_FINDING: Dedicated protocol, scope, and owner authorization.\
PRIMARY_EVIDENCE: `UNKNOWN`; candidate listing only.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Candidate/not completed. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Candidate ≠ authorization.

### 22. JST-RETRACT-02

EXPERIMENT_ID / NAME: JST-RETRACT-02.\
PROJECT: Research candidate; exact owning project is `UNKNOWN` in the reviewed Registry excerpt.\
QUESTION: `UNKNOWN` — consult the candidate protocol.\
STATUS: Candidate next experiment, not a completed result.\
EXECUTION_VERDICT: `NOT_RUN` (Registry labels it candidate, not completed).\
SCIENTIFIC_INTERPRETATION: No retraction finding is available.\
WHAT_WAS_OBSERVED: The Registry lists it alongside JST-CAUSAL-01 as a candidate.\
WHAT_IT_SUPPORTS: A future bounded retraction question only after protocol review.\
WHAT_IT_DOES_NOT_PROVE: Any retraction effect or failure mode.\
OPEN_FINDING: Dedicated protocol, scope, and owner authorization.\
PRIMARY_EVIDENCE: `UNKNOWN`; candidate listing only.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Candidate/not completed. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Candidate ≠ authorization.

### 23. TCE-BEACON-SHIFT-01

EXPERIMENT_ID / NAME: TCE-BEACON-SHIFT-01 — Beacon relevance/over-anchoring candidate.\
PROJECT: TCE / Beacon line.\
QUESTION: Can the same persistent Beacon remain available without dragging an old intent into unrelated topics or overriding an explicit current-user change?\
STATUS: Candidate, not started, not authorized.\
EXECUTION_VERDICT: `NOT_RUN`.\
SCIENTIFIC_INTERPRETATION: No result is available; the current Beacon Condition B is not a causal test.\
WHAT_WAS_OBSERVED: The detailed TCE report proposes adjacent, unrelated, and explicit-override probes; none is authorized by that proposal.\
WHAT_IT_SUPPORTS: A future relevance-gating test only after a separate GO.\
WHAT_IT_DOES_NOT_PROVE: Beacon benefit, a final architecture, or a failure in every unrelated context.\
OPEN_FINDING: Freeze a distinct matched test and obtain separate authorization.\
PRIMARY_EVIDENCE: Candidate design in N06; no run artifact.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N06](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D02](#f-external-source-records), unreadable.\
NOTION_STATUS: Candidate/not started/not authorized. DRIVE_STATUS: `UNKNOWN`. CONSISTENCY: `UNKNOWN`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not run automatically.

## C.1. T3.1 cross-source reconciliation record (2026-10-06)

**Rule:** each row names the current Notion-derived claim, the relevant Drive ID and owner/local-review state, and the exact GitHub source when present. D01/D02/D04/D05 availability is owner-verified, but their bodies did not render locally. Therefore every overall card classification remains `UNKNOWN`; GitHub-only support or pointer tensions do not create a Drive match. `GITHUB_REF=UNKNOWN` means the current card/index has no exact GitHub source for that claim.

1. **R01 — Crystal E0 / Project Aurora — `CONSISTENCY=UNKNOWN`.** Notion N01 `3edac84d-0547-81ad-9634-db49b600ad08` and N12 `3edac84d-0547-81d9-9165-ebbf2ad0222f` summarize temporal/currentness findings and report SHA `3ed3a53ee9b8445a5f2ebf16046f782a3095555e` as the frozen Crystal E0 source. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; local text not reviewed (JavaScript-disabled error). GitHub GH17 resolves to `docs/research/CONTINUUM_CURRENT_STATE_VS_TRAJECTORY_CROSS_PROJECT_EVIDENCE.md`, a Continuum/CONT-E0T cross-project note, not an identified Crystal E0 run artifact. Flag the source pointer for owner/source-map resolution; do not guess a replacement or conclude a Drive mismatch.
2. **R02 — TCE / Snapshot / Observer / Continuity — `CONSISTENCY=UNKNOWN`.** Compared N06 `3e1ac84d-0547-8182-a48e-ed965721de93` and N01 `3edac84d-0547-81ad-9634-db49b600ad08`: bounded 04A/04B/Observer/SLOT outcomes and limitations. Drive D02 `1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs` and D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; body text not reviewed. Exact GitHub run source=UNKNOWN; 04B continuation and unestablished Observer benefit cannot be compared with Drive text.
3. **R03 — Beacon experiments — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` and N06 `3e1ac84d-0547-8182-a48e-ed965721de93` say Condition B had five calls, no matched Condition A, no robust causal benefit, and disputed TAIL-02/T15 effect. Drive D02 `1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs` and D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; body text not reviewed. Exact GitHub run source=UNKNOWN; no Drive/GitHub consistency claim is supported.
4. **R04 — GSJ semantic preflight — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` and N07 `3dbac84d-0547-8199-800d-c1132b75738b` describe 36/36 reported preflight agreement, not a formal pilot, with authorization open. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source for current v0.5.1 artifacts=UNKNOWN; no comparison with D01 content.
5. **R05 — E0-B Typing Reliability — `CONSISTENCY=UNKNOWN`.** N04 `3e3ac84d-0547-8103-9762-eec24dadd4eb` and N01 `3edac84d-0547-81ad-9634-db49b600ad08` say U0 count/intent frozen 30/30, Phase 1B captured, labels pending, and blind run/A0/A1/B not run. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH03, PR #7 head `b14fbd76995c36c69526103a3598f4c753d5bb31`, files `experiments/memory-governance-e0b/RESULT.md` and `SOURCE_INTEGRITY_REPORT.md`, report 42 verbatim atoms, human confirmation pending, ground truth pending, blind run not run. This supports those Phase 1B limits but does not independently verify the separate 30/30 U0 claim or Drive content.
6. **R06 — CONT-E0T — `CONSISTENCY=UNKNOWN`.** N08 `3bcac84d-0547-81eb-b7b3-cbd281bdcdc6` and N01 `3edac84d-0547-81ad-9634-db49b600ad08` report a historical run/result, raw evidence not recovered, and an unsealed reproduction package. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH19 commit `6847eb759d747955b8618021d2414f5ffa840584`, `docs/research/CONT_E0T_FINAL_PREREGISTRATION.md`, says separate owner GO required, authorization NOT_AUTHORIZED, and no reader/scoring/outputs; its cross-project summary records `CONT_E0T_EXECUTED=NO` and `CONT_E0T_RESULT=NOT_ESTABLISHED`. This is an unresolved chronology/status tension, not a final adjudication; remain UNKNOWN pending source/owner reconciliation.
7. **R07 — Graphiti FM-13 → FM-17-pre — `CONSISTENCY=UNKNOWN`.** N05 `3d8ac84d-0547-8188-9133-c5e27c14f8f1` and N01 `3edac84d-0547-81ad-9634-db49b600ad08` describe an integrity/preflight gate with minor findings and no annotation/ablation outcome. Drive D04 `1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA` and D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH18 commit `080e1959fe6a3d996f2690059fcdc687dd5c832e`, `docs/research/fm17_pre/` including README and `EXTERNAL_FREEZE_ANCHOR.md`, documents the v1.3.1 external-root gate and says ablation not executed. Readiness/integrity evidence is not an outcome or Drive comparison.
8. **R08 — SIGNET-TRACE / SOURCE-RECOVERY — `CONSISTENCY=UNKNOWN`.** N06 `3e1ac84d-0547-8182-a48e-ed965721de93` and N01 `3edac84d-0547-81ad-9634-db49b600ad08` state blocked at Step 0 by source gap and no end-to-end result. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH20 at `943281bda8e96bfb6b3613ab14941131e41d93eb`, `docs/research/SIGNET_TRACE_01.md`, withdraws “TRACE_COMPLETE” as official and records blocked at Step 0 / no result. GitHub supports bounded status; D01 remains unreviewed.
9. **R09 — E0-A Ownership & Governance — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` summarizes five bounded checks as PASS on an open, unmerged branch. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH02 PR #6 head `c36c5bc1fb9ddd5a54a8499cf9439e35ba3ca19c`, `RESULTS.md` and `logs/test_run.txt`, lists PASS for tests 1, 2, 5, 11, and 12; PR #6 remains open. This corroborates the bounded reported result, not a Drive comparison or merged behavior.
10. **R10 — Memory Admission Controller v0.1 — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` reports checkpointed suites at code commit `e286c50` and an unmerged lab implementation. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH04 PR #10 is OPEN/DRAFT at head `105b880e5439f2022ca052747bdf10bfee97262c`; `docs/checkpoints/MEMORY_ADMISSION_CONTROLLER_v0.1.md` pins code commit `e286c50aed03a7cd1956d36fc5b216f2f15ea81d` and labels the work lab-only, synthetic, non-Canon/non-runtime, with final audit pending. This is not live CI and cannot establish a Drive match.
11. **R11 — Eiti continuity M1/M2/M2.1/M2.1.1/M2.2a/M3 — `CONSISTENCY=UNKNOWN`.** N02 `3ecac84d-0547-81b3-a8d2-e0aea1d44ba5`, N03 `3ecac84d-0547-81a7-9b7a-d6a916bf0709`, and N01 `3edac84d-0547-81ad-9634-db49b600ad08` distinguish main from the continuity-carrier branch. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH01 is `main@826e27abb9e1f114a11773adc2a79e1bc60927d0`; GH05/#13, GH06/#15, GH07/#16 are main merges; GH08–GH11/#14/#18/#20/#25 are merged to `lab/continuity-carrier-m1`, not main. Live metadata supports the branch map, not Drive consistency.
12. **R12 — Ruslan Experimental Continuity Memory v0.1 — `CONSISTENCY=UNKNOWN`.** N02 `3ecac84d-0547-81b3-a8d2-e0aea1d44ba5` and N10 `3f0ac84d-0547-81fb-aec2-de6544dcfd95` describe an experimental memory and owner-review boundary. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH13 PR #28 head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`, README, marks it experimental, non-authoritative, non-Canon, and separate from official memory; PR #28 remains OPEN/DRAFT. Scope/status only; no Drive comparison.
13. **R13 — Cross-session AI Resume Test — `CONSISTENCY=UNKNOWN`.** N10 `3f0ac84d-0547-81fb-aec2-de6544dcfd95` treats its proposed first test as a candidate; N01 `3edac84d-0547-81ad-9634-db49b600ad08` records a separate PR #28 result. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH13 PR #28 head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`, `tests/results/cross-session-v01/result.md`, reports PASS, 10/10 correct, listed errors zero, NEXT=OWNER REVIEW. Keep the distinct test scopes separate; no Drive match.
14. **R14 — Owner Authority sandbox — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` and N10 `3f0ac84d-0547-81fb-aec2-de6544dcfd95` describe a synthetic boundary proposal without a verified run result. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH12 PR #27 head `2d6877fc937f3b09c93d68c9b950170b358495d8`, README, says synthetic-only, non-authoritative, no real grants/PEP/production authorization; test files exist but no result is cited in the reviewed material.
15. **R15 — Working Research Workspace / Digital Identity Routing — `CONSISTENCY=UNKNOWN`.** N10 `3f0ac84d-0547-81fb-aec2-de6544dcfd95` describes a proposal/candidate test, not a result. Drive D05 `1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM` and D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. GitHub GH14 PR #30 head `9c2410d0a026748ccb2f13cfef41d12040776ea6`, `WORKING_RESEARCH_WORKSPACE.md`, is an architecture proposal; PR #30 OPEN/DRAFT, no run result recorded. Proposal-only scope, not Drive consistency.
16. **R16 — HLC Human ↔ LLM behavioral trace — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08`, N09 `3f0ac84d-0547-815e-95c6-d5dad0e842cf`, and N11 `3efac84d-0547-81c7-a04a-f81b001ed319` describe exploratory/non-blind limited traces and distinguish HLC-001B/not-run from Pilot-A/B. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; no cross-source status assigned.
17. **R17 — Human Cognition → Computational Reconstruction Map — `CONSISTENCY=UNKNOWN`.** Notion N09 `3f0ac84d-0547-815e-95c6-d5dad0e842cf` describes a dated synthesis. D03 `1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k` is unresolved/404 and is not substituted. Similar but distinct D06 ID `1ZwacnCQe-wREwE4syx1TM4eBkGj1H_t6mIrYYIA22-k` is owner-identified by the title “🧠 Human Cognition → Computational Reconstruction Map — Science · Velantrim · Open Questions · 2026-10-05”; its content accessibility/review is unknown. D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos` is owner-accessible but locally unreadable. Exact GitHub source=UNKNOWN; no content match claimed.
18. **R18 — PAL-CONTAM-01 — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` lists a candidate/preregistration, not run or authorized, with no dedicated protocol reviewed. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; do not infer result or absence.
19. **R19 — FORK-01 — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` supports identifier discovery only; project, question, execution state, and primary evidence remain unknown. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; no status promotion.
20. **R20 — INTENT-CONTINUITY-EXTRACTION-01 — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` lists a candidate identifier but does not verify protocol/run. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; no inference from identifier alone.
21. **R21 — JST-CAUSAL-01 — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` lists a candidate, not a completed causal result or authorization. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; do not treat candidate as run or authorized.
22. **R22 — JST-RETRACT-02 — `CONSISTENCY=UNKNOWN`.** N01 `3edac84d-0547-81ad-9634-db49b600ad08` lists a candidate, not a retraction result or authorization. Drive D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; no failure mode inferred.
23. **R23 — TCE-BEACON-SHIFT-01 — `CONSISTENCY=UNKNOWN`.** N06 `3e1ac84d-0547-8182-a48e-ed965721de93` and N01 `3edac84d-0547-81ad-9634-db49b600ad08` describe an unstarted, unauthorized relevance/over-anchoring candidate. Drive D02 `1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs` and D01 `1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`: owner access YES; text not reviewed. Exact GitHub source=UNKNOWN; do not run automatically or claim an effect.

**T3.1 counters:** `MATCH=0`; `PARTIAL_MISMATCH=0`; `STALE_NOTION=0`; `STALE_DRIVE=0`; `SOURCE_ONLY_NOTION=0`; `SOURCE_ONLY_DRIVE=0`; `UNKNOWN=23`. Every row names the specific claim and exact relevant source IDs; the cards remain unknown because Drive bodies could not be read in this session. GitHub-only confirmations or pointer tensions are not substitutes for the missing Drive-side comparison.

## D. Eiti-Wizard-Lab implementation and status map

The following status fields summarize repository evidence only. `IMPLEMENTED` means code/doc artifacts exist at the cited ref; it does not mean enabled or authorized. `TESTED` distinguishes reported test records from live GitHub checks. Open/draft branches remain experimental and are not part of main.

| Stage / line | IMPLEMENTED? | TESTED? | MERGED? | ACTIVE? | EXPERIMENTAL? | AUTHORITATIVE? | CANON? | NEXT OPEN QUESTION? |
|---|---|---|---|---|---|---|---|---|
| M1 — PR #13 | Yes; declaration in current main | Docs-only declaration; no live checks listed; canonical seed SHA unchanged | Yes, main merge `7a400909…` | Yes; current Canon declaration | No; declaration-only merged stage | Yes; designated source of admitted orientation records, not absolute truth or permission | Yes; M1 declares Canon, seed itself unchanged | Follow exact stage scope in N03 |
| M2 — PR #15 export-context | Yes, at PR #15/main | Seed tests exist; checkpoint reports completion; no live PR checks listed | Yes, main merge `efa981ef…` | Yes; derived context export in main | No; bounded merged implementation | No; derived from Canon | No; export/bootstrap is not Canon | Provider-neutral export boundaries |
| M2.1 — PR #14 | Yes, at continuity branch | Memory-layer checks SUCCESS | Merged to `lab/continuity-carrier-m1`, not main | Branch line active | Yes | No | No | OBSERVED-only ledger semantics |
| M2.1.1 — PR #18/#20 | Yes, at continuity branch | Memory-layer checks SUCCESS | Merged to continuity branch, not main | Branch line active | Yes | No | No | Intake/re-smoke limits and next gate |
| M2.2a — PR #25 | Yes, at continuity branch | Checkpoint: 52/52 ledger, 18/18 seed, 10/10 browser; Reference DB 35/36 baseline | Merged to continuity branch, not main | Latest bounded branch stage | Yes | No | No | Stop before M2.2b; address noted baseline/review gate |
| M3 — PR #16 read-only runtime bridge | Yes, on main | Checkpoint: 66/66 Node suite; seed validation 79 records, 0 errors/warnings | Yes, exact current main `826e27a…` | Yes in main; default OFF per guide | No; bounded merged feature | No; read-only orientation only | No; derived runtime bootstrap does not write Canon | Preserve read-only and Clean Resume boundaries |
| E0-A — PR #6 | Result/test files on open branch | Five bounded report checks PASS; no PR checks | No | Open | Yes | No | No | Open PR review/currentness |
| E0-B — PR #7 | Capture artifacts on open branch | Phase 1B captured; ground truth pending; blind run NOT_RUN | No | Open but stopped at human labels | Yes | No | No | Boundary/provenance and human-label gate |
| Memory Admission Controller — PR #10 | Prototype on open branch | Checkpoint reports suites; no PR checks | No | Review-mode draft | Yes | No | No | Independent audit and residuals |
| Ruslan Experimental Memory — PR #28 | Files on open branch only | Recorded cross-session PASS; no PR checks | No | Owner review pending | Yes | No | No | Owner review; do not treat as official memory |
| Cross-session AI Resume Test — PR #28 | Result files on open branch | PASS recorded; 0 next-action and open-question errors | No | Result awaits review | Yes | No | No | Confirm scope versus PR #30 proposal |
| Owner Authority Sandbox — PR #27 | Synthetic code/fixtures on open branch | Test files exist; no result/checks verified | No | Draft | Yes | No | No | Review test evidence; preserve synthetic scope |
| Working Research Workspace — PR #30 | Proposal doc on open branch | First test NOT_RUN for this proposal | No | Draft | Yes | No | No | Design isolated v0.1 test and owner review |

`M1/M2/M3` on main and `M2.1/M2.1.1/M2.2a` on the separate continuity-carrier branch are related but **not one merged lifecycle**. PR #28 is not the base for this gateway. Do not merge or mutate any of those existing PRs as part of this task.

## E. Avoid unnecessary repetition

Do not repeat a bounded run merely because this index is new. For TCE/Beacon, separate continuation/capture from learning and require a genuinely new question before a follow-up. For CONT-E0T, preserve the recorded underdetermined result and focus on the stated missing-artifact status; do not reconstruct outputs from summaries or rerun without separate authorization. For GSJ, do not rewrite v0.5.1 or run a formal pilot before the artifact-integrity/freeze and owner-GO gates. For E0-B, wait at the human-label/provenance gate; A0/A1/B have not run. For M2.2a, stop before M2.2b. For HLC, keep exploratory/post-exposure results separate from HLC-001B and do not generalize Pilot-A/B. For PR #28’s cross-session test, review the recorded result rather than silently promoting it to main or Canon.

When a specific result is needed, open the relevant card’s `PRIMARY_EVIDENCE` and `GITHUB_REF` first, then verify at that exact path/SHA. If the artifact is missing or unreadable, keep the field `UNKNOWN`.

## F. External source records

Each record below uses the required durable identity fields. Cards above refer to these IDs. This catalogue is a navigation aid; a pointer does not mean the linked page/artifact was independently verified as primary evidence.

### Notion records

**N01**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=Velantrim Experiment Registry — Evidence, Results & Findings\
SOURCE_ID=3edac84d-0547-81ad-9634-db49b600ad08 ([open](https://app.notion.com/p/3edac84d054781ad9634db49b600ad08))\
SOURCE_ROLE=CROSS_PROJECT_RESEARCH_INDEX_NOT_PRIMARY_EVIDENCE

**N02**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🧠 Continuity Carrier — M1/M2.1 Checkpoint · 2026-10-01\
SOURCE_ID=3ecac84d-0547-81b3-a8d2-e0aea1d44ba5 ([open](https://app.notion.com/p/3ecac84d054781b3a8d2e0aea1d44ba5))\
SOURCE_ROLE=PROJECT_CHECKPOINT

**N03**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=Eiti-Wizard-Lab — Continuity M1/M2/M3 checkpoint · 2026-10-01\
SOURCE_ID=3ecac84d-0547-81a7-9b7a-d6a916bf0709 ([open](https://app.notion.com/p/3ecac84d054781a79b7ad6a916bf0709))\
SOURCE_ROLE=PROJECT_CHECKPOINT

**N04**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🧠🔬 E0-B Typing Reliability — Human U0 Freeze → Boundary Layer · 2026-09-23\
SOURCE_ID=3e3ac84d-0547-8103-9762-eec24dadd4eb ([open](https://app.notion.com/p/3e3ac84d054781039762eec24dadd4eb))\
SOURCE_ROLE=DEDICATED_EXPERIMENT_CHECKPOINT

**N05**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🔬 Research & Evidence Directory — Graphiti Fractal · Retrieval Relevance · FM-13→FM-17-pre\
SOURCE_ID=3d8ac84d-0547-8188-9133-c5e27c14f8f1 ([open](https://app.notion.com/p/3d8ac84d054781889133c5e27c14f8f1))\
SOURCE_ROLE=DEDICATED_GRAPHITI_RESEARCH_ROUTE_AND_STATUS_POINTER_NOT_PRIMARY_OUTCOME

**N06**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🧪 TCE Snapshot / Observer Experiments — 04A · 04B · Observer-01 · SLOT-01 — 2026-09-19–20\
SOURCE_ID=3e1ac84d-0547-8182-a48e-ed965721de93 ([open](https://app.notion.com/p/3e1ac84d05478182a48eed965721de93))\
SOURCE_ROLE=DEDICATED_EXPERIMENT_REPORT_AND_EVIDENCE_POINTERS

**N07**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🧪 Journal 2026-09-14 · GSJ v0.4.2 · RESEARCH ONLY\
SOURCE_ID=3dbac84d-0547-8199-800d-c1132b75738b ([open](https://app.notion.com/p/3dbac84d05478199800dc1132b75738b))\
SOURCE_ROLE=HISTORICAL_GSJ_JOURNAL_NOT_CURRENT_FORMAL_PILOT

**N08**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🌎 Velantrim Continuum — IDPS Research 🪎\
SOURCE_ID=3bcac84d-0547-81eb-b7b3-cbd281bdcdc6 ([open](https://app.notion.com/p/3bcac84d054781ebb7b3cbd281bdcdc6))\
SOURCE_ROLE=CONT-E0T_STATUS_AND_REPRODUCIBILITY_CHECKPOINT

**N09**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=Human Cognition → Computational Reconstruction Map · 2026-10-05\
SOURCE_ID=3f0ac84d-0547-815e-95c6-d5dad0e842cf ([open](https://app.notion.com/p/3f0ac84d0547815e95c6d5dad0e842cf))\
SOURCE_ROLE=RESEARCH_SYNTHESIS_NOT_PRIMARY_EXPERIMENT_EVIDENCE

**N10**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🧭 Eiti Working Research Workspace & Digital Identity Routing · 2026-10-05\
SOURCE_ID=3f0ac84d-0547-81fb-aec2-de6544dcfd95 ([open](https://app.notion.com/p/3f0ac84d054781fbaec2de6544dcfd95))\
SOURCE_ROLE=RESEARCH_ARCHITECTURE_PROPOSAL_AND_TEST_CANDIDATE

**N11**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=HLC-001-PILOT-A — независимая сверка экспертного мнения и исследовательской ценности · 2026-10-05\
SOURCE_ID=3efac84d-0547-81c7-a04a-f81b001ed319 ([open](https://app.notion.com/p/3efac84d054781c7a04af81b001ed319))\
SOURCE_ROLE=SECONDARY_ANALYTICAL_REVIEW_NOT_PRIMARY_TRANSCRIPT

**N12**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🔎 Crystal + Titan — GitHub ↔ Notion Audit · 2026-10-02\
SOURCE_ID=3edac84d-0547-81d9-9165-ebbf2ad0222f ([open](https://app.notion.com/p/3edac84d054781d99165ebbf2ad0222f))\
SOURCE_ROLE=CROSS_SOURCE_AUDIT_CONTEXT_NOT_CURRENT_CRYSTAL_LIVE_STATE

### Google Drive records

**D01**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=Velantrim Experiment Registry — Evidence, Results & Findings\
SOURCE_ID=1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos ([open](https://docs.google.com/document/d/1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos/edit))\
SOURCE_ROLE=GLOBAL_REGISTRY_COMPANION; OWNER_VERIFIED_CONTENT_ACCESS=YES; LOCAL_CONTENT_REVIEW=NO (Google Docs JavaScript-disabled viewer error)

**D02**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=TCE Snapshot / Observer Experiments — 04A · 04B · Observer-01 · SLOT-01\
SOURCE_ID=1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs ([open](https://docs.google.com/document/d/1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs/edit))\
SOURCE_ROLE=DEDICATED_EXPERIMENT_REPORT; OWNER_VERIFIED_CONTENT_ACCESS=YES; LOCAL_CONTENT_REVIEW=NO (Google Docs JavaScript-disabled viewer error)

**D03**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=Eiti-Wizard-Lab consolidated evidence companion (Registry-linked title; document title not confirmed)\
SOURCE_ID=1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k ([current locator](https://docs.google.com/document/d/1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k/edit))\
SOURCE_ROLE=REGISTRY-LINKED_EITI_EVIDENCE_POINTER; OWNER_VERIFIED_LOOKUP=NOT_FOUND/404; LOCATOR=UNRESOLVED/INACCESSIBLE; NOT EVIDENCE OF ABSENCE OR DELETION; DO NOT SUBSTITUTE D06

**D04**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=Graphiti Fractal — Retrieval Relevance Research Track — Current\
SOURCE_ID=1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA ([open](https://docs.google.com/document/d/1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA/edit))\
SOURCE_ROLE=DEDICATED_RESEARCH_REPORT; OWNER_VERIFIED_CONTENT_ACCESS=YES; LOCAL_CONTENT_REVIEW=NO (Google Docs JavaScript-disabled viewer error)

**D05**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=🧠 Eiti Working Memory & Research Workspace — Digital Identity Routing Policy · 2026-10-05\
SOURCE_ID=1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM ([open](https://docs.google.com/document/d/1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM/edit))\
SOURCE_ROLE=WORKSPACE_ARCHITECTURE_LINK; OWNER_VERIFIED_CONTENT_ACCESS=YES; LOCAL_CONTENT_REVIEW=NO (Google Docs JavaScript-disabled viewer error)

**D06**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=🧠 Human Cognition → Computational Reconstruction Map — Science · Velantrim · Open Questions · 2026-10-05\
SOURCE_ID=1ZwacnCQe-wREwE4syx1TM4eBkGj1H_t6mIrYYIA22-k\
SOURCE_ROLE=SEPARATE_HUMAN_COGNITION_SOURCE_FOR_CARD_17; OWNER_VERIFIED_TITLE_AND_ID_ONLY; NOT_D03; CONTENT_ACCESSIBILITY_AND_LOCAL_CONTENT_REVIEW=UNKNOWN

### GitHub records

**GH01**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Eiti-Wizard-Lab main, live base for this index\
SOURCE_ID=main@826e27abb9e1f114a11773adc2a79e1bc60927d0 ([commit](https://github.com/velantrian/Eiti-Wizard-Lab/commit/826e27abb9e1f114a11773adc2a79e1bc60927d0))\
SOURCE_ROLE=VERIFIED_BASE_BRANCH_AND_MAIN_IMPLEMENTATION

**GH02**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #6 — E0-A Ownership & Governance Conformance Probe\
SOURCE_ID=PR#6 head c36c5bc1fb9ddd5a54a8499cf9439e35ba3ca19c; `experiments/memory-governance-e0a/RESULTS.md`, `tests/test_e0a.py`, `logs/test_run.txt` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/6))\
SOURCE_ROLE=OPEN_BRANCH_EXPERIMENT_AND_REPORTED_TEST_EVIDENCE

**GH03**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #7 — E0-B Phase 1B corpus preparation\
SOURCE_ID=PR#7 head b14fbd76995c36c69526103a3598f4c753d5bb31; `experiments/memory-governance-e0b/RESULT.md`, `SOURCE_INTEGRITY_REPORT.md` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/7))\
SOURCE_ROLE=OPEN_BRANCH_CAPTURE_AND_PROVENANCE_EVIDENCE

**GH04**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #10 — Memory Admission Controller v0.1\
SOURCE_ID=PR#10 head 105b880e5439f2022ca052747bdf10bfee97262c; test checkpoint `docs/checkpoints/MEMORY_ADMISSION_CONTROLLER_v0.1.md` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/10))\
SOURCE_ROLE=OPEN_DRAFT_IMPLEMENTATION_AND_REPORTED_TESTS

**GH05**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #13 — Continuity Carrier M1\
SOURCE_ID=merge 7a400909629c0029dd438e796d5d942da450411b; `docs/memory/CONTINUITY_CARRIER.md`, `docs/memory/event_ledger.jsonl`, `docs/memory/manifest.json` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/13))\
SOURCE_ROLE=MERGED_M1_IMPLEMENTATION_POINTER

**GH06**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #15 — M2 provider-neutral context export\
SOURCE_ID=merge efa981efaeef08999be168aaf6c6bb9cb330b820; `docs/memory/AI_CONTEXT_BOOTSTRAP.md`, `tools/memory/seed_tool.mjs`, `tools/memory/seed_tool.test.mjs` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/15))\
SOURCE_ROLE=MERGED_M2_IMPLEMENTATION_AND_TEST_POINTER

**GH07**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #16 — M3 read-only runtime bridge\
SOURCE_ID=merge/current main 826e27abb9e1f114a11773adc2a79e1bc60927d0; `continuity-runtime.mjs`, `tools/memory/continuity_runtime.test.mjs`, `docs/memory/AI_CONTEXT_RUNTIME.md` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/16))\
SOURCE_ROLE=MERGED_M3_IMPLEMENTATION_AND_TEST_POINTER

**GH08**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #14 — M2.1 OBSERVED-only ledger\
SOURCE_ID=merge 4984d3a201b6706d1f3ec4b566075f9ce0260237; `tools/memory/ledger_tool.mjs`, `tools/memory/ledger_tool.test.mjs` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/14))\
SOURCE_ROLE=EXPERIMENTAL_BRANCH_IMPLEMENTATION_AND_TEST_POINTER

**GH09**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #18 — M2.1.1 OBSERVED intake\
SOURCE_ID=merge 1e35f38c5dabd380eaf8ede863757d630636e73b ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/18))\
SOURCE_ROLE=EXPERIMENTAL_BRANCH_STAGE_POINTER

**GH10**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #20 — M2.1.1 clean re-smoke\
SOURCE_ID=merge 6c4b2e59cf2ef6ae51c4e02ca65397b14f36668a; `docs/memory/event_ledger.jsonl` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/20))\
SOURCE_ROLE=EXPERIMENTAL_BRANCH_RESMOKE_POINTER

**GH11**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #25 — M2.2a candidate/proposal events\
SOURCE_ID=merge/current continuity branch e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31; accepted head 7186fdb3dc6661a5fb846f1fdadb1f267f778162 ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/25))\
SOURCE_ROLE=EXPERIMENTAL_BRANCH_STAGE_AND_CHECK_POINTER

**GH12**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #27 — Owner Authority Sandbox v0.1\
SOURCE_ID=PR#27 head 2d6877fc937f3b09c93d68c9b950170b358495d8; `experiments/owner-authority-sandbox/` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/27))\
SOURCE_ROLE=OPEN_DRAFT_SYNTHETIC_EXPERIMENT

**GH13**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #28 — Ruslan Experimental Continuity Memory v0.1\
SOURCE_ID=PR#28 head ec1a3b665cc0da29a7e10773a142aca45bda31b2; `experiments/ruslan-experimental-memory/` and `tests/results/cross-session-v01/` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/28))\
SOURCE_ROLE=OPEN_DRAFT_MEMORY_AND_RECORDED_CROSS_SESSION_RESULT

**GH14**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #30 — Working Research Workspace and Digital Identity Routing\
SOURCE_ID=PR#30 head 9c2410d0a026748ccb2f13cfef41d12040776ea6; `docs/research/working-research-workspace/WORKING_RESEARCH_WORKSPACE.md` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/30))\
SOURCE_ROLE=OPEN_DRAFT_RESEARCH_ARCHITECTURE_PROPOSAL

**GH15**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #26 — Owner Passport resume checkpoint\
SOURCE_ID=PR#26 head 5b0cc934909d63c010b7a3b9ec8330b0e516b58c ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/26))\
SOURCE_ROLE=OPEN_DRAFT_CHECKPOINT_POINTER

**GH16**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #29 — External agent-memory donor registry\
SOURCE_ID=PR#29 head 5f09ead69b17eca9181fb199f4b0ae89f9d71bd2 ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/29))\
SOURCE_ROLE=OPEN_DRAFT_DONOR_CATALOG_NOT_EXPERIMENT_RESULT

**GH17**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Registry-reported Crystal E0 source pointer — exact commit is a Continuum cross-project research note\
SOURCE_ID=commit 3ed3a53ee9b8445a5f2ebf16046f782a3095555e ([commit](https://github.com/velantrian/velantrim-exocortex-crystal/commit/3ed3a53ee9b8445a5f2ebf16046f782a3095555e))\
SOURCE_ROLE=COMMIT_REVIEWED; changed file `docs/research/CONTINUUM_CURRENT_STATE_VS_TRAJECTORY_CROSS_PROJECT_EVIDENCE.md` points to CONT-E0T preregistration; not verified as Crystal E0 primary evidence

**GH18**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Graphiti Fractal Lab reviewed checkpoint\
SOURCE_ID=commit 080e1959fe6a3d996f2690059fcdc687dd5c832e; N05 reports `docs/research/fm17_pre/` on `experiment/falkordblite-deterministic-memory` ([commit](https://github.com/velantrian/Graphiti_fractal_lab/commit/080e1959fe6a3d996f2690059fcdc687dd5c832e))\
SOURCE_ROLE=EXTERNAL_RESEARCH_CHECKPOINT_POINTER_REPORTED_BY_NOTION_NOT_INDEPENDENTLY_OPENED

**GH19**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Velantrim Continuum CONT-E0T frozen source\
SOURCE_ID=commit 6847eb759d747955b8618021d2414f5ffa840584 ([commit](https://github.com/velantrian/Velantrim-Continuum/commit/6847eb759d747955b8618021d2414f5ffa840584))\
SOURCE_ROLE=FROZEN_SOURCE_POINTER_RAW_RUN_NOT_RECOVERED

**GH20**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Crystal SIGNET-TRACE-01 / SOURCE-RECOVERY-01-R1 record\
SOURCE_ID=branch `research/signet-trace-01-protocol-v0-1-20260927` at HEAD `943281bda8e96bfb6b3613ab14941131e41d93eb`, path `docs/research/SIGNET_TRACE_01.md`; Issue #489; Draft PR #490 ([record](https://github.com/velantrian/velantrim-exocortex-crystal/blob/research/signet-trace-01-protocol-v0-1-20260927/docs/research/SIGNET_TRACE_01.md), [issue](https://github.com/velantrian/velantrim-exocortex-crystal/issues/489), [PR](https://github.com/velantrian/velantrim-exocortex-crystal/pull/490))\
SOURCE_ROLE=CURRENT_BRANCH_RECORD_REVIEWED; confirms Step-0 source gap, no end-to-end result, and no protocol validation/falsification

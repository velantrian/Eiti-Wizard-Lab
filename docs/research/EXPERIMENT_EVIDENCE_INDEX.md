# Eiti-Wizard-Lab — Experiment & Evidence Index

STATUS: `RESEARCH_INDEX_ONLY`\
CANON: `NO`\
RUNTIME_AUTHORITY: `NO`\
PRIMARY_EVIDENCE: `NO`\
LAST_VERIFIED: `2026-10-06` (Notion, GitHub, and read-only Drive content review)

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
**Google Drive — companion Experiment Registry** is the long-form registry/evidence companion: [D01](#f-external-source-records).

**Drive access and content review are source-specific.** Owner-side verification confirms content access for D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`), D02 (`1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs`), D04 (`1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA`), and D05 (`1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM`). This task also exported and reviewed D01, D02, D04, D05, and the distinct D06 (`1ZwacnCQe-wREwE4syx1TM4eBkGj1H_t6mIrYYIA22-k`) through the read-only Google Workspace connector. `DRIVE_REGISTRY_VERIFIED=OWNER_VERIFIED_ACCESS_YES (D01)`; `DRIVE_DOCS_REVIEWED=5 (D01, D02, D04, D05, D06; local content review on 2026-10-06)`. These are text-level source reviews, not verification of missing raw experiment artifacts.

D01's Drive `modifiedTime` is `2026-10-05T10:34:28.190Z`, before PR #27 (`2026-10-05T13:19:29Z`) and PR #28 (`2026-10-05T14:15:54Z`) were created. Those absent entries are temporal staleness, not evidence of absence. D03's current locator `1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k` returned NOT FOUND/404 in both owner-side and current Drive lookup; its identity/provenance remains unresolved, not absent or deleted. The similar but different D06 ID is independently reviewed and must not replace D03.

Notion timestamps vary. `LAST_VERIFIED` below means the page/branch was checked on 2026-10-06; use the source's own date for claim age. The per-card claim comparisons and exact references are in [T3.2 source reconciliation](#c1-t32-source-reconciliation); source-record details are in [External source records](#f-external-source-records).

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
PRIMARY_EVIDENCE: Crystal E0 bounded result remains Registry-reported; exact primary Crystal E0 artifact path is unresolved. GH17 is a Continuum cross-project note, not the Crystal run artifact.\
GITHUB_REF: [GH17](#f-external-source-records).  NOTION_REF: [N01](#f-external-source-records), [N12](#f-external-source-records).  DRIVE_REF: [D01](#f-external-source-records); any dedicated report is unverified.\
NOTION_STATUS: Bounded temporal question closed; meta-retrieval open. DRIVE_STATUS: D01 reviewed; Registry claim aligns, but the cited GitHub commit is not Crystal E0 primary evidence. CONSISTENCY: `PARTIAL_MISMATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `CROSS_MODEL_REPRODUCED != ROOT_CAUSE_PROVEN`; do not treat GH17 as Crystal primary evidence.

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
PRIMARY_EVIDENCE: Dedicated Drive D02 TCE report and Notion N06 record reviewed; raw bytes remain linked/referenced, not recovered in this index.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab for these TCE runs. NOTION_REF: [N06](#f-external-source-records). DRIVE_REF: [D02](#f-external-source-records), [D01](#f-external-source-records); content reviewed, raw run bytes not recovered.\
NOTION_STATUS: Bounded runs complete with the limitations above. DRIVE_STATUS: D01 and D02 reviewed; TCE claims align with N06. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: No robust causal benefit; TAIL-02/T15 disputed; follow-ups candidate. DRIVE_STATUS: D01 and D02 reviewed; Condition B/no matched A and TAIL-02 limits align. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: Preflight PASS; formal pilot not authorized. DRIVE_STATUS: D01 reviewed; 36/36 preflight is distinct from an unauthorized formal pilot. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: U0 30/30 frozen; boundary/provenance open; A0/A1/B not run. DRIVE_STATUS: D01 reviewed; U0=30/30, boundaries open, A0/A1/B not run; PR #7 covers Phase 1B limits. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
PRIMARY_EVIDENCE: D01/N08 report a later historical result; GH19 is the earlier frozen preregistration only. Exact raw run artifacts remain `NOT_RECOVERED`.\
GITHUB_REF: [GH19](#f-external-source-records) — preregistration/frozen-source evidence only; not evidence that the later reported run occurred or did not occur. NOTION_REF: [N08](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); reviewed.\
NOTION_STATUS: Result recorded, raw evidence not recovered, package not sealed. DRIVE_STATUS: D01 reviewed; later result recorded, while GH19 is earlier preregistration only; raw evidence unrecovered. CONSISTENCY: `PARTIAL_MISMATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Preserve the later Registry-reported result; do not use GH19 as run evidence or infer the run never occurred. `RESULT RECORDED != RAW ARTIFACTS RECOVERED`.

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
PRIMARY_EVIDENCE: D04 and D01 reviewed; GH18 points to the exact FM-17-pre freeze-anchor/checkpoint at commit `080e1959fe6a3d996f2690059fcdc687dd5c832e`.\
GITHUB_REF: [GH18](#f-external-source-records). NOTION_REF: [N05](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D04](#f-external-source-records), [D01](#f-external-source-records); content reviewed.\
NOTION_STATUS: Preflight pass with minor findings; ablation readiness only. DRIVE_STATUS: D01 and D04 reviewed; integrity readiness only, no outcome-producing ablation. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: Blocked at Step 0 by source gap. DRIVE_STATUS: D01 reviewed; source gap blocks Step 0 and no end-to-end result exists. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: E0-A is a current consolidated line; exact Registry summary details should be rechecked. DRIVE_STATUS: D01 reviewed; five bounded E0-A checks PASS on open PR #6. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: Present under Eiti admission line; details require Registry verification. DRIVE_STATUS: D01 reviewed; bounded checkpoint results align with PR #10 test record. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: M1/M2/M2.1/M2.1.1/M2.2a bounded checkpoints complete; branch distinction and stop retained. DRIVE_STATUS: D01 reviewed; main/carrier branch distinction aligns with live PR refs. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not conflate the merged main line with the later carrier branch. `IMPLEMENTED ≠ ACTIVATED`; `EXPERIMENTAL ≠ OFFICIAL_MEMORY`.

### 12. Ruslan Experimental Continuity Memory v0.1

EXPERIMENT_ID / NAME: `experiments/ruslan-experimental-memory/` v0.1.\
PROJECT: Eiti-Wizard-Lab experimental memory.\
QUESTION: Can a fresh session recover the bounded stop point and next action from the experimental project memory?\
STATUS: D01 snapshot predates PR #28; current exact work exists on OPEN/DRAFT PR #28 at head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`; not in main.\
EXECUTION_VERDICT: The PR contains test/result artifacts; a recorded cross-session PASS is linked below. No GitHub checks were listed; the memory contents were not copied into this index.\
SCIENTIFIC_INTERPRETATION: A bounded result on the recorded project source; not proof of general memory continuity or official/Canon status.\
WHAT_WAS_OBSERVED: Result artifacts and lifecycle/clean-resume tests exist on the draft branch.\
WHAT_IT_SUPPORTS: Review of that exact experimental branch and its recorded scope.\
WHAT_IT_DOES_NOT_PROVE: A merged feature, complete research continuity, broad reliability, or authority over official memory.\
OPEN_FINDING: Owner review of the v0.1 result; scope and provenance should be checked before reuse.\
PRIMARY_EVIDENCE: PR #28 paths `README.md`, `RUSLAN_EXPERIMENTAL_MEMORY.md`, `CROSS_SESSION_TEST_PLAN.md`, `tests/lifecycle.test.mjs`, and `tests/clean-resume.test.mjs` at the exact PR head. Sensitive memory content is intentionally not reproduced here.\
GITHUB_REF: [GH13](#f-external-source-records). NOTION_REF: [N02](#f-external-source-records), [N10](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); no Drive content verified.\
NOTION_STATUS: Workspace design proposal remains non-Canon; exact scope match to PR #28 is unresolved. DRIVE_STATUS: D01 snapshot predates PR #28; absence is temporal, not evidence of absence. CONSISTENCY: `STALE_DRIVE`. LAST_VERIFIED: `2026-10-06`.\
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
NOTION_STATUS: N10 proposes a first test; PR #28 records a separate-scope PASS. Keep scopes distinct. Drive snapshot predates PR #28. DRIVE_STATUS: D01 snapshot predates PR #28; preserve the exact separate 10/10 result scope. CONSISTENCY: `STALE_DRIVE`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `PASS` is recorded in an open draft branch; no independent reproduction is claimed.

### 14. Owner Authority / Personal Authority sandbox

EXPERIMENT_ID / NAME: Owner Authority Sandbox v0.1.\
PROJECT: Eiti-Wizard-Lab authority-boundary experiment.\
QUESTION: Can a synthetic passport/request decision path distinguish proposed context from owner-granted authority?\
STATUS: D01 snapshot predates PR #27; current exact sandbox exists on OPEN/DRAFT PR #27 at head `2d6877fc937f3b09c93d68c9b950170b358495d8`; not merged.\
EXECUTION_VERDICT: Test files exist (`pdp.test.mjs`, `replay.test.mjs`), but no PR checks or test result were listed; execution verdict is `UNKNOWN`.\
SCIENTIFIC_INTERPRETATION: At most a synthetic prototype; it is explicitly non-authoritative.\
WHAT_WAS_OBSERVED: PR file list contains synthetic fixtures, PDP code, harness, and test files.\
WHAT_IT_SUPPORTS: A pointer to an experimental test surface for owner review.\
WHAT_IT_DOES_NOT_PROVE: Real owner authority, permission to alter official memory, user intent, or any production security property.\
OPEN_FINDING: Review the exact branch and obtain test evidence before making claims.\
PRIMARY_EVIDENCE: PR #27 head `2d6877fc937f3b09c93d68c9b950170b358495d8`, `experiments/owner-authority-sandbox/`; synthetic fixtures are labeled as such.\
GITHUB_REF: [GH12](#f-external-source-records). NOTION_REF: [N01](#f-external-source-records), [N10](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Authority boundaries are research proposals; no Canon/runtime authorization. DRIVE_STATUS: D01 snapshot predates PR #27; absence is temporal, not evidence of absence. CONSISTENCY: `STALE_DRIVE`. LAST_VERIFIED: `2026-10-06`.\
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
PRIMARY_EVIDENCE: D05 proposal text reviewed; PR #30 head `9c2410d0a026748ccb2f13cfef41d12040776ea6` is the matching proposal document, not a test result.\
GITHUB_REF: [GH14](#f-external-source-records). NOTION_REF: [N10](#f-external-source-records). DRIVE_REF: [D05](#f-external-source-records), [D01](#f-external-source-records); content reviewed.\
NOTION_STATUS: Research/architecture proposal; first test is candidate/next step. DRIVE_STATUS: D05 and D01 reviewed; proposal-only/non-Canon/non-runtime status aligns with N10/PR #30. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
PRIMARY_EVIDENCE: D01 HLC status passages reviewed; N11 remains a secondary review, not a frozen primary transcript.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N01](#f-external-source-records), [N09](#f-external-source-records), [N11](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); other linked Research Program references are `UNKNOWN` because they were not reviewed.\
NOTION_STATUS: Pilot-A exploratory/non-blind; HLC-001B not run; Pilot-B exploratory/post-exposure/non-blind; HLC-MODALITY-01 candidate/not run. DRIVE_STATUS: D01 reviewed; HLC exploratory and not-run boundaries align with N01/N09/N11. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
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
PRIMARY_EVIDENCE: D06 is the separate 2026-10-05 Human Cognition synthesis; it was read directly. D03 remains a distinct unresolved locator.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N09](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records), [D06](#f-external-source-records) (separate Human Cognition source; not D03).\
NOTION_STATUS: Current synthesis, not Canon. DRIVE_STATUS: D01 and distinct D06 reviewed; D03 remains unresolved and is not substituted. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `FUNCTIONAL REPRODUCTION ≠ BIOLOGICAL REPRODUCTION ≠ CONSCIOUSNESS REPRODUCTION`.

### 18. PAL-CONTAM-01

EXPERIMENT_ID / NAME: PAL-CONTAM-01.\
PROJECT: Personal-adapter research / interaction-induced adaptation bias.\
QUESTION: If an adapter is trained only on user-authored messages, can it still learn prior model framing when the user’s wording follows model exposure?\
STATUS: Candidate experiment; NOT RUN; NOT AUTHORIZED; not an architecture decision or runtime change.\
EXECUTION_VERDICT: `NOT_RUN`.\
SCIENTIFIC_INTERPRETATION: No empirical result is available.\
WHAT_WAS_OBSERVED: D01 and D02 identify the paired independent-versus-model-exposed design; both state that no run result exists.\
WHAT_IT_SUPPORTS: A bounded candidate design distinguishing who authored text from whether prior model exposure shaped it.\
WHAT_IT_DOES_NOT_PROVE: That such bias occurs, its size, or any adapter effect.\
OPEN_FINDING: No empirical result; review the candidate protocol before any separately authorized run.\
PRIMARY_EVIDENCE: D01 registry section 17.1 and the dedicated D02 PAL-CONTAM-01 report; both content-reviewed.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records), [D02](#f-external-source-records); content reviewed.\
NOTION_STATUS: Candidate/not run/not authorized. DRIVE_STATUS: D01 and D02 reviewed; PAL-CONTAM-01 is candidate, not run, and not authorized. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Candidate ≠ roadmap commitment; do not run without separate GO.

### 19. FORK-01

EXPERIMENT_ID / NAME: FORK-01.\
PROJECT: Soul / Self / Subject / Continuity research; operational branching and lineage, not a subjectivity test.\
QUESTION: When one frozen agent state is instantiated into two parallel descendants, which continuity dimensions remain shared versus branch-specific, and which operational identity policies yield different preregistered predictions?\
STATUS: PREREGISTRATION DRAFT; NOT STARTED; NO RUN AUTHORIZATION; NOT SUBJECTIVITY TEST.\
EXECUTION_VERDICT: `NOT_RUN` — the dedicated source says no run is authorized and no evidence has been created.\
SCIENTIFIC_INTERPRETATION: May test operational lineage behavior; cannot establish numerical subjective identity or consciousness.\
WHAT_WAS_OBSERVED: The dedicated source specifies a frozen common ancestor and compares operational lineage policies; no completed result is recorded.\
WHAT_IT_SUPPORTS: A bounded preregistration for operational identity/lineage predictions only.\
WHAT_IT_DOES_NOT_PROVE: That the same phenomenal subject continues in either, both, or neither branch.\
OPEN_FINDING: Any future test still requires exact frozen state, branch isolation, provenance, and separate authorization.\
PRIMARY_EVIDENCE: Dedicated Notion N13 preregistration and D01 section 17.2; no run artifact exists in the reviewed sources.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N13](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); content reviewed.\
NOTION_STATUS: FORK-01 preregistration draft; not started; no run authorization; not a subjectivity test. DRIVE_STATUS: D01 and dedicated Notion N13 page reviewed; draft/not-started/not-authorized boundary aligns. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `FORK RESULT != SAME SUBJECT PROOF != CONSCIOUSNESS PROOF != SOUL TEST`.

### 20. INTENT-CONTINUITY-EXTRACTION-01

EXPERIMENT_ID / NAME: INTENT-CONTINUITY-EXTRACTION-01.\
PROJECT: Intent Continuity / goal lifecycle, extraction, persistence, and resumption research.\
QUESTION: How should a long-term cognitive system preserve and resume a person’s original/current goals, goal changes, subgoals, reasons, statuses, open commitments, and correct resumption after pause, compaction, handoff, or model change?\
STATUS: RESEARCH; NOT CANON; NOT RUNTIME; NO NEW ORGAN; NO ADMISSION; NO EXPERIMENT AUTHORIZATION. Candidate specification only.\
EXECUTION_VERDICT: `NOT_RUN` — INTENT-CONTINUITY-EXTRACTION-01 is not preregistered or authorized.\
SCIENTIFIC_INTERPRETATION: A research mechanism map and candidate annotation/fixture protocol, not an architecture contract or result.\
WHAT_WAS_OBSERVED: The dedicated map distinguishes lifecycle/integration, extraction/transition typing, and persistence/governance gaps; D01 labels the named protocol candidate-specification-only.\
WHAT_IT_SUPPORTS: A candidate annotation/fixture specification for where extraction or persistence loses intent/status/provenance.\
WHAT_IT_DOES_NOT_PROVE: That a full lifecycle has never been studied, or that a new organ/schema/runtime change is required.\
OPEN_FINDING: Prepare the annotation and fixture specification only; no implementation, schema freeze, owner assignment, Canon promotion, or run authorization.\
PRIMARY_EVIDENCE: Dedicated Notion N14 Intent Continuity map and D01 section 17.3; both describe research/candidate status, not a completed experiment.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N14](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records); content reviewed.\
NOTION_STATUS: Research, not Canon/runtime; no experiment authorization; candidate specification only. DRIVE_STATUS: D01 and dedicated Notion N14 page reviewed; candidate-spec/research-only boundary aligns. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: `RESEARCH != CANON`; `CANDIDATE SPECIFICATION != PREREGISTRATION OR AUTHORIZATION`.

### 21. JST-CAUSAL-01

EXPERIMENT_ID / NAME: JST-CAUSAL-01.\
PROJECT: Eiti-Wizard-Lab continuity / JST residual research.\
QUESTION: Does durable mutation add causal value over the strongest practical retrieval baseline, beyond retrieval-mediated adaptation?\
STATUS: Candidate next experiment, not a completed result.\
EXECUTION_VERDICT: `NOT_RUN` (Registry labels it candidate, not completed).\
SCIENTIFIC_INTERPRETATION: No causal finding is available.\
WHAT_WAS_OBSERVED: D01 says first map JST requirements against existing E0-A/E0-B/Admission/M1/M2/M2.1/M3 artifacts, then run a bounded causal contrast.\
WHAT_IT_SUPPORTS: A future bounded causal question only after protocol review.\
WHAT_IT_DOES_NOT_PROVE: Any cause or effect.\
OPEN_FINDING: Dedicated protocol, scope, and owner authorization.\
PRIMARY_EVIDENCE: D01 section 20.12; no completed GitHub experiment or run artifact is identified.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Candidate/not completed. DRIVE_STATUS: D01 reviewed; candidate next experiment, not a completed result. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Candidate ≠ authorization.

### 22. JST-RETRACT-02

EXPERIMENT_ID / NAME: JST-RETRACT-02.\
PROJECT: Eiti-Wizard-Lab continuity / JST residual research.\
QUESTION: Can selective downstream rollback occur after ground retraction while preserving independent support?\
STATUS: Candidate next experiment, not a completed result.\
EXECUTION_VERDICT: `NOT_RUN` (Registry labels it candidate, not completed).\
SCIENTIFIC_INTERPRETATION: No retraction finding is available.\
WHAT_WAS_OBSERVED: D01 says first map JST requirements against existing artifacts, then run a bounded selective-retraction contrast.\
WHAT_IT_SUPPORTS: A future bounded retraction question only after protocol review.\
WHAT_IT_DOES_NOT_PROVE: Any retraction effect or failure mode.\
OPEN_FINDING: Dedicated protocol, scope, and owner authorization.\
PRIMARY_EVIDENCE: D01 section 20.12; no completed GitHub experiment or run artifact is identified.\
GITHUB_REF: `UNKNOWN`. NOTION_REF: [N01](#f-external-source-records). DRIVE_REF: [D01](#f-external-source-records).\
NOTION_STATUS: Candidate/not completed. DRIVE_STATUS: D01 reviewed; candidate next experiment, not a completed result. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Candidate ≠ authorization.

### 23. TCE-BEACON-SHIFT-01

EXPERIMENT_ID / NAME: TCE-BEACON-SHIFT-01 — Beacon relevance/over-anchoring candidate.\
PROJECT: TCE / Beacon line.\
QUESTION: Can the same persistent Beacon remain available without forcing unrelated or explicitly changed user topics back toward the old intent?\
STATUS: Candidate next test; NOT STARTED; NOT AUTHORIZED YET; do not run automatically.\
EXECUTION_VERDICT: `NOT_RUN`.\
SCIENTIFIC_INTERPRETATION: No result is available; the current Beacon Condition B is not a causal test.\
WHAT_WAS_OBSERVED: The detailed TCE report proposes adjacent, unrelated, and explicit-override probes; none is authorized by that proposal.\
WHAT_IT_SUPPORTS: A future relevance-gating test only after a separate GO.\
WHAT_IT_DOES_NOT_PROVE: Beacon benefit, a final architecture, or a failure in every unrelated context.\
OPEN_FINDING: Freeze a distinct matched test and obtain separate authorization.\
PRIMARY_EVIDENCE: Dedicated D02 section 16 and D01 registry; both content-reviewed; no run artifact.\
GITHUB_REF: `UNKNOWN` in Eiti-Wizard-Lab. NOTION_REF: [N06](#f-external-source-records), [N01](#f-external-source-records). DRIVE_REF: [D02](#f-external-source-records), [D01](#f-external-source-records); content reviewed.\
NOTION_STATUS: Candidate/not started/not authorized. DRIVE_STATUS: D01 and D02 reviewed; candidate not started/not authorized and do-not-run-automatically boundary aligns. CONSISTENCY: `MATCH`. LAST_VERIFIED: `2026-10-06`.\
NOTES: Do not run automatically.

## C.1. T3.2 source reconciliation

**Rule:** `MATCH` means the reviewed source claims agree within their stated scope. `PARTIAL_MISMATCH` marks a provenance/source-pointer gap, not an inferred experimental contradiction. `STALE_DRIVE` means the D01 snapshot predates the later GitHub record; its omission is not evidence of absence. D03 remains an unresolved locator and does not force unrelated cards to `UNKNOWN`.

1. **R01 — Crystal E0 / Project Aurora — `CONSISTENCY=PARTIAL_MISMATCH`.** D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §6) and N01 (`3edac84d-0547-81ad-9634-db49b600ad08`) agree that the bounded Crystal temporal question is closed and META-RETRIEVAL-01 remains open. GH17 is commit `3ed3a53ee9b8445a5f2ebf16046f782a3095555e`, whose merge adds `docs/research/CONTINUUM_CURRENT_STATE_VS_TRAJECTORY_CROSS_PROJECT_EVIDENCE.md` with CONT-E0T/Continuum evidence; that is not a verified Crystal E0 primary run artifact. Keep the result Registry-reported and mark the primary Crystal artifact path unresolved.
2. **R02 — TCE / Snapshot / Observer / Continuity — `CONSISTENCY=MATCH`.** N06 (`3e1ac84d-0547-8182-a48e-ed965721de93`), D02 (`1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs`, §§3–6, 11) and D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §11) align: 04A preserves non-selection but has status mixing; 04B resumes then the model selects a direction; the post-hoc Observer loses the unselected options; allowing NOT_PRESENT alone does not remove status mixing. Observer benefit remains unestablished; raw bytes were not copied or recovered. No exact Eiti-Wizard-Lab GitHub run ref exists.
3. **R03 — Beacon experiments — `CONSISTENCY=MATCH`.** N01/N06 and D02 (`1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs`, §§7–11) plus D01 (§11) agree: Condition B has five calls but no matched Condition A, so causality/Beacon effect is unknown; TAIL-02 completed/froze 36/36 calls with a disputed localized T15 effect. No exact Eiti-Wizard-Lab GitHub run ref exists.
4. **R04 — GSJ semantic preflight — `CONSISTENCY=MATCH`.** N01 (`3edac84d-0547-81ad-9634-db49b600ad08`) and D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §12) agree on 36/36 decision/ground preflight alignment and the open integrity/freeze/owner-GO gates; N07 (`3dbac84d-0547-8199-800d-c1132b75738b`) is the older v0.4.2 journal, not the current formal pilot. No exact GitHub source for v0.5.1 primary artifacts was identified. Preflight is not a formal pilot or authorization.
5. **R05 — E0-B Typing Reliability — `CONSISTENCY=MATCH`.** N04 (`3e3ac84d-0547-8103-9762-eec24dadd4eb`), N01, D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §12) and GH03 (PR #7 head `b14fbd76995c36c69526103a3598f4c753d5bb31`, `experiments/memory-governance-e0b/RESULT.md`, `SOURCE_INTEGRITY_REPORT.md`) align on a frozen U0 count/intent of 30/30, open textual-boundary/provenance work, Phase 1B capture with labels/ground truth pending, and blind/A0/A1/B runs not done. PR #7’s 42 verbatim atoms are Phase 1B corpus evidence, not strict-blind ground truth.
6. **R06 — CONT-E0T — `CONSISTENCY=PARTIAL_MISMATCH`.** N08 (`3bcac84d-0547-81eb-b7b3-cbd281bdcdc6`), N01 and reviewed D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §13) report a historical completed/result-recorded run, raw evidence not recovered, and an unsealed package. GH19 is `Velantrim-Continuum@6847eb759d747955b8618021d2414f5ffa840584`, `docs/research/CONT_E0T_FINAL_PREREGISTRATION.md`; it is the earlier freeze (`READY_FOR_OWNER_GO=YES`, `EXPERIMENT_AUTHORIZATION=NOT_AUTHORIZED`, `NO READER / NO SCORING / NO OUTPUTS`), not run evidence. Keep the later reported result, preserve `RAW_RUN_EVIDENCE=NOT_RECOVERED`, and do not infer the later run never occurred.
7. **R07 — Graphiti FM-13 → FM-17-pre — `CONSISTENCY=MATCH`.** N05 (`3d8ac84d-0547-8188-9133-c5e27c14f8f1`), D01 and reviewed D04 (`1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA`) align on FM-17-pre protocol/integrity readiness, not an outcome-producing run. GH18 commit `080e1959fe6a3d996f2690059fcdc687dd5c832e`, `docs/research/fm17_pre/EXTERNAL_FREEZE_ANCHOR.md`, requires an externally supplied frozen root and stops before A0–A3; D04 reports real annotation/ablation not executed. No structural-value result is established.
8. **R08 — SIGNET-TRACE / SOURCE-RECOVERY — `CONSISTENCY=MATCH`.** N06 (`3e1ac84d-0547-8182-a48e-ed965721de93`), N01, and D01 (§14) agree that the work is blocked at Step 0 by a source gap, without an end-to-end result. GH20 at branch `research/signet-trace-01-protocol-v0-1-20260927`, head `943281bda8e96bfb6b3613ab14941131e41d93eb`, `docs/research/SIGNET_TRACE_01.md`, explicitly withdraws “TRACE_COMPLETE” as official and records no result. The bounded status is a match; the raw source remains unresolved.
9. **R09 — E0-A Ownership & Governance — `CONSISTENCY=MATCH`.** N01 and D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §20) report the five bounded governance checks as PASS. GH02 is open PR #6 head `c36c5bc1fb9ddd5a54a8499cf9439e35ba3ca19c`, `experiments/memory-governance-e0a/RESULTS.md` and `logs/test_run.txt`; it records the same five checks. This is bounded branch evidence, not merged or production behavior.
10. **R10 — Memory Admission Controller v0.1 — `CONSISTENCY=MATCH`.** N01, D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §20.4), and GH04 at open/draft PR #10 head `105b880e5439f2022ca052747bdf10bfee97262c`, `docs/checkpoints/MEMORY_ADMISSION_CONTROLLER_v0.1.md`, agree on reported suites: 38/38 admission DB, 13/13 admission browser, 36/36 existing Reference Memory DB, 10/10 Reference Memory browser, private scan PASS/0 hits, at code commit `e286c50aed03a7cd1956d36fc5b216f2f15ea81d`. The checkpoint is lab-only, no live CI, final audit pending, and not runtime authorization.
11. **R11 — Eiti continuity stages M1/M2/M2.1/M2.1.1/M2.2a/M3 — `CONSISTENCY=MATCH`.** N02 (`3ecac84d-0547-81b3-a8d2-e0aea1d44ba5`), N03 (`3ecac84d-0547-81a7-9b7a-d6a916bf0709`), N01, and D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §§20.5–20.13) preserve the main/branch distinction. GH01 main is `826e27abb9e1f114a11773adc2a79e1bc60927d0`; PRs #13/#15/#16 are on main, while #14/#18/#20/#25 are merged into the separate `lab/continuity-carrier-m1` chain, not main. Live PR metadata confirms the branch map.
12. **R12 — Ruslan Experimental Continuity Memory v0.1 — `CONSISTENCY=STALE_DRIVE`.** N02/N10 describe the experimental-memory and owner-review boundaries; D01’s `modifiedTime=2026-10-05T10:34:28.190Z` predates PR #28 creation at `2026-10-05T14:15:54Z`. GH13 is OPEN/DRAFT at head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`; its README labels the work experimental, separate from official memory. D01’s omission is stale, not proof the work did not exist.
13. **R13 — Cross-session AI Resume Test — `CONSISTENCY=STALE_DRIVE`.** N10 calls its proposed first test a candidate, while N01 records a separate PR #28 result. D01’s `modifiedTime=2026-10-05T10:34:28.190Z` predates PR #28. GH13 at the exact head records `CROSS_SESSION_AI_RESUME_TEST=PASS`, 10/10 correct, zero listed errors, `NEXT=OWNER REVIEW`. Preserve the separate-scope distinction; D01’s missing line is temporal, not absence.
14. **R14 — Owner Authority sandbox — `CONSISTENCY=STALE_DRIVE`.** N01/N10 describe a synthetic boundary proposal; D01’s `modifiedTime=2026-10-05T10:34:28.190Z` predates PR #27 creation at `2026-10-05T13:19:29Z`. GH12 is OPEN/DRAFT at head `2d6877fc937f3b09c93d68c9b950170b358495d8`; `experiments/owner-authority-sandbox/README.md` explicitly uses synthetic fixtures and says no real grants, production authorization, or Canon Apply. D01’s omission is temporal, not evidence of absence.
15. **R15 — Working Research Workspace / Digital Identity Routing — `CONSISTENCY=MATCH`.** N10, reviewed D05 (`1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM`), and PR #30/GH14 at head `9c2410d0a026748ccb2f13cfef41d12040776ea6` agree this is a research/architecture proposal: not Canon, not runtime authorization, not implemented, and not an automatic memory writer. The first test is a candidate; no run result is recorded.
16. **R16 — HLC Human ↔ LLM behavioral trace — `CONSISTENCY=MATCH`.** N01/N09/N11 and D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §21) align: Pilot-A is N=1 exploratory/non-blind, HLC-001B is not run, Pilot-B is post-exposure/non-blind, and HLC-MODALITY-01 is a candidate. No GitHub experiment ref exists; no universal human–LLM claim is supported.
17. **R17 — Human Cognition → Computational Reconstruction Map — `CONSISTENCY=MATCH`.** N09, D01 and the separate D06 (`1ZwacnCQe-wREwE4syx1TM4eBkGj1H_t6mIrYYIA22-k`) agree on a 2026-10-05 research synthesis/orientation, not Canon or runtime authority, and on `FUNCTIONAL REPRODUCTION ≠ BIOLOGICAL REPRODUCTION ≠ CONSCIOUSNESS REPRODUCTION`. D06 content was reviewed directly and is not D03. D03 (`1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k`) remains unresolved/404.
18. **R18 — PAL-CONTAM-01 — `CONSISTENCY=MATCH`.** N01, D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §17.1) and reviewed D02 (`1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs`, dedicated PAL-CONTAM-01 section) identify the same interaction-induced adaptation-bias question: user-authored text may still reflect prior model exposure. The paired design is a candidate; both Drive sources say no run result exists and no authorization is granted. No GitHub run ref exists.
19. **R19 — FORK-01 — `CONSISTENCY=MATCH`.** D01 (§17.2) and dedicated Notion N13 (`3eaac84d-0547-8167-b8f6-e288fdf4f004`) agree: `PREREGISTRATION DRAFT`, `NOT STARTED`, `NO RUN AUTHORIZATION`, `NOT SUBJECTIVITY TEST`. The page asks which continuity dimensions remain shared versus branch-specific when one frozen state produces two descendants, and which operational identity policies make different preregistered predictions. No result or GitHub run ref exists.
20. **R20 — INTENT-CONTINUITY-EXTRACTION-01 — `CONSISTENCY=MATCH`.** D01 (§17.3) and dedicated Notion N14 (`3ecac84d-0547-81f5-ad18-c166d757d884`) agree this is Intent Continuity research on goal lifecycle/extraction/persistence/resumption; the map is research-only, not Canon/runtime, has no new organ/admission/experiment authorization, and labels the protocol candidate-specification-only (not preregistered). No run result or GitHub experiment ref exists.
21. **R21 — JST-CAUSAL-01 — `CONSISTENCY=MATCH`.** N01 and D01 (`1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos`, §20.12) call it a candidate next experiment, not a completed result. Its stated contrast is durable mutation versus retrieval-mediated adaptation, after mapping requirements to existing E0-A/E0-B/Admission/M1/M2/M2.1/M3 artifacts and using a strong practical retrieval baseline. No GitHub run ref exists.
22. **R22 — JST-RETRACT-02 — `CONSISTENCY=MATCH`.** N01 and D01 (§20.12) call it a candidate next experiment, not a completed result. Its stated question is selective downstream rollback after ground retraction; the requirement-mapping step precedes implementation/run. No GitHub run ref exists.
23. **R23 — TCE-BEACON-SHIFT-01 — `CONSISTENCY=MATCH`.** N06/N01, D01 (§17) and reviewed D02 (`1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs`, §16) agree it is a candidate next test, not started and not authorized. The question is avoiding old-intent over-anchoring on unrelated or explicitly changed user topics; D02 says do not run automatically. No GitHub run ref exists.

**T3.2 counters:** `MATCH=18`; `PARTIAL_MISMATCH=2`; `STALE_NOTION=0`; `STALE_DRIVE=3`; `SOURCE_ONLY_NOTION=0`; `SOURCE_ONLY_DRIVE=0`; `UNKNOWN=0`. These are claim-level comparisons of source text, not claims that raw run artifacts were recovered or experiments independently reproduced.

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

**N13**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🧪 FORK-01 — Branching / Lineage / Operational Identity · Preregistration Draft\
SOURCE_ID=3eaac84d-0547-8167-b8f6-e288fdf4f004 ([open](https://app.notion.com/p/3eaac84d05478167b8f6e288fdf4f004))\
SOURCE_ROLE=DEDICATED_FORK_01_PREREGISTRATION; CONTENT_FETCHED=YES (2026-10-06); PAGE_LAST_EDITED=2026-09-29

**N14**\
SOURCE_SYSTEM=NOTION\
SOURCE_TITLE=🔬 Intent Continuity — Mechanism Map v1.1 · Historical Review & Research Comments · 2026-10-01\
SOURCE_ID=3ecac84d-0547-81f5-ad18-c166d757d884 ([open](https://app.notion.com/p/3ecac84d054781f5ad18c166d757d884))\
SOURCE_ROLE=DEDICATED_INTENT_CONTINUITY_RESEARCH_MAP; CONTENT_FETCHED=YES (2026-10-06); PAGE_LAST_EDITED=2026-10-03

### Google Drive records

**D01**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=Velantrim Experiment Registry — Evidence, Results & Findings\
SOURCE_ID=1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos ([open](https://docs.google.com/document/d/1EgYHDDdY10l97Y8f9SOqgeHfywPnnZTncLlyrLyIbos/edit))\
SOURCE_ROLE=GLOBAL_REGISTRY_COMPANION; OWNER_VERIFIED_CONTENT_ACCESS=YES; OWNER_CONTENT_REVIEW=YES; LOCAL_CONTENT_REVIEW=YES (read-only Google Workspace export, 2026-10-06); DRIVE_MODIFIED=2026-10-05T10:34:28.190Z

**D02**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=TCE Snapshot / Observer Experiments — 04A · 04B · Observer-01 · SLOT-01\
SOURCE_ID=1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs ([open](https://docs.google.com/document/d/1mLgFC4_HcvIPVDLxrhYFBcn0u5EULZBprKJCBcsgHEs/edit))\
SOURCE_ROLE=DEDICATED_EXPERIMENT_REPORT; OWNER_VERIFIED_CONTENT_ACCESS=YES; OWNER_CONTENT_REVIEW=YES; LOCAL_CONTENT_REVIEW=YES (read-only Google Workspace export, 2026-10-06)

**D03**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=Eiti-Wizard-Lab consolidated evidence companion (Registry-linked title; document title not confirmed)\
SOURCE_ID=1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k ([current locator](https://docs.google.com/document/d/1ZwacnCQe-wREwE4sy1TM4eBkGj1H_t6mIrYYIA22-k/edit))\
SOURCE_ROLE=REGISTRY-LINKED_EITI_EVIDENCE_POINTER; OWNER_VERIFIED_LOOKUP=NOT_FOUND/404; CURRENT_DRIVE_LOOKUP=NOT_FOUND/404; IDENTITY/PROVENANCE=UNRESOLVED; NOT EVIDENCE OF ABSENCE OR DELETION; DO NOT SUBSTITUTE D06

**D04**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=Graphiti Fractal — Retrieval Relevance Research Track — Current\
SOURCE_ID=1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA ([open](https://docs.google.com/document/d/1Z-tjZGi_-2ETkWp3NHsmClZIZ_mC23KAOGvAScXLYGA/edit))\
SOURCE_ROLE=DEDICATED_RESEARCH_REPORT; OWNER_VERIFIED_CONTENT_ACCESS=YES; OWNER_CONTENT_REVIEW=YES; LOCAL_CONTENT_REVIEW=YES (read-only Google Workspace export, 2026-10-06)

**D05**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=🧠 Eiti Working Memory & Research Workspace — Digital Identity Routing Policy · 2026-10-05\
SOURCE_ID=1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM ([open](https://docs.google.com/document/d/1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM/edit))\
SOURCE_ROLE=WORKSPACE_ARCHITECTURE_PROPOSAL; OWNER_VERIFIED_CONTENT_ACCESS=YES; OWNER_CONTENT_REVIEW=YES; LOCAL_CONTENT_REVIEW=YES (read-only Google Workspace export, 2026-10-06)

**D06**\
SOURCE_SYSTEM=GOOGLE_DRIVE\
SOURCE_TITLE=🧠 Human Cognition → Computational Reconstruction Map — Science · Velantrim · Open Questions · 2026-10-05\
SOURCE_ID=1ZwacnCQe-wREwE4syx1TM4eBkGj1H_t6mIrYYIA22-k\
SOURCE_ROLE=SEPARATE_HUMAN_COGNITION_SOURCE_FOR_CARD_17; OWNER_VERIFIED_CONTENT_ACCESS=YES; OWNER_CONTENT_REVIEW=YES; LOCAL_CONTENT_REVIEW=YES (read-only Google Workspace export, 2026-10-06); NOT_D03

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
SOURCE_ROLE=OPEN_DRAFT_SYNTHETIC_EXPERIMENT; PR_CREATED=2026-10-05T13:19:29Z; PR_STATE=OPEN/DRAFT

**GH13**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=PR #28 — Ruslan Experimental Continuity Memory v0.1\
SOURCE_ID=PR#28 head ec1a3b665cc0da29a7e10773a142aca45bda31b2; `experiments/ruslan-experimental-memory/` and `tests/results/cross-session-v01/` ([PR](https://github.com/velantrian/Eiti-Wizard-Lab/pull/28))\
SOURCE_ROLE=OPEN_DRAFT_MEMORY_AND_RECORDED_CROSS_SESSION_RESULT; PR_CREATED=2026-10-05T14:15:54Z; PR_STATE=OPEN/DRAFT

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
SOURCE_TITLE=Continuum cross-project research note incorrectly pointed to as Crystal E0 primary evidence\
SOURCE_ID=commit 3ed3a53ee9b8445a5f2ebf16046f782a3095555e ([commit](https://github.com/velantrian/velantrim-exocortex-crystal/commit/3ed3a53ee9b8445a5f2ebf16046f782a3095555e))\
SOURCE_ROLE=COMMIT_REVIEWED; changed file `docs/research/CONTINUUM_CURRENT_STATE_VS_TRAJECTORY_CROSS_PROJECT_EVIDENCE.md` points to CONT-E0T preregistration; not verified as Crystal E0 primary evidence

**GH18**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Graphiti Fractal Lab reviewed checkpoint\
SOURCE_ID=commit 080e1959fe6a3d996f2690059fcdc687dd5c832e; N05 reports `docs/research/fm17_pre/` on `experiment/falkordblite-deterministic-memory` ([commit](https://github.com/velantrian/Graphiti_fractal_lab/commit/080e1959fe6a3d996f2690059fcdc687dd5c832e))\
SOURCE_ROLE=EXACT_COMMIT_FILE_REVIEWED; EXTERNAL_FREEZE_ANCHOR_ONLY; NO_ABLATION_OUTCOME; D04_REPORTS_ANNOTATION_AND_A0_A3_UNEXECUTED

**GH19**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Velantrim Continuum CONT-E0T frozen source\
SOURCE_ID=commit 6847eb759d747955b8618021d2414f5ffa840584 ([commit](https://github.com/velantrian/Velantrim-Continuum/commit/6847eb759d747955b8618021d2414f5ffa840584))\
SOURCE_ROLE=EARLIER_FINAL_PREREGISTRATION_FREEZE_ONLY; NOT_RUN_EVIDENCE; LATER_REPORTED_RESULT_PRESERVED; RAW_RUN_NOT_RECOVERED

**GH20**\
SOURCE_SYSTEM=GITHUB\
SOURCE_TITLE=Crystal SIGNET-TRACE-01 / SOURCE-RECOVERY-01-R1 record\
SOURCE_ID=branch `research/signet-trace-01-protocol-v0-1-20260927` at HEAD `943281bda8e96bfb6b3613ab14941131e41d93eb`, path `docs/research/SIGNET_TRACE_01.md`; Issue #489; Draft PR #490 ([record](https://github.com/velantrian/velantrim-exocortex-crystal/blob/research/signet-trace-01-protocol-v0-1-20260927/docs/research/SIGNET_TRACE_01.md), [issue](https://github.com/velantrian/velantrim-exocortex-crystal/issues/489), [PR](https://github.com/velantrian/velantrim-exocortex-crystal/pull/490))\
SOURCE_ROLE=CURRENT_BRANCH_RECORD_REVIEWED; confirms Step-0 source gap, no end-to-end result, and no protocol validation/falsification

# E0-B Research Trajectory And Current State

STATUS:
RESEARCH TRAJECTORY / EXPERIMENT STATE
LAB-ONLY
NOT OWNER CANON
NOT RUNTIME AUTHORIZATION

This file is a narrative index.
Exact experiment artifacts, frozen hashes and Git commits remain the
evidence authority.

Repository: `velantrian/Eiti-Wizard-Lab`  
Branch: `exp/e0b-typing-reliability`  
Primary path: `experiments/memory-governance-e0b/`

---

## 1. Authority boundary

Eiti-Wizard-Lab experiment artifacts are the primary E0-B evidence authority.

Cross-project notes in Crystal / Soul / Continuum are research input only. They must not become alternative authorities for E0-B, and they do not authorize owner-repository architecture, runtime, Canon, or pilot changes.

Canonical rule:

- EITI-WIZARD-LAB EXPERIMENT ARTIFACTS = PRIMARY E0-B EVIDENCE AUTHORITY
- CRYSTAL / SOUL / CONTINUUM NOTES = CROSS-PROJECT RESEARCH INPUT ONLY

---

## 2. Verified freeze evidence (recomputed)

Frozen reference:

- path: `experiments/memory-governance-e0b/HUMAN_SEGMENTATION_REFERENCE.json`
- SHA-256: `2464ab24e1c6d6e25a6466380927dd0845f132cb58361bc7e48f6ce1ed5dbd2d`

Freeze receipt:

- path: `experiments/memory-governance-e0b/HUMAN_SEGMENTATION_REFERENCE_FREEZE_RECEIPT.json`
- SHA-256: `0d68cd4ae160a89049f9dcfcd38f2a7e35717c4ce25387e1ef5aafc258fce06c`

Human-answer fingerprint:

- `1cf0569676643cf920d7944cedc052c2710d8160d06cb06c78b1f93323e078b8`

Historical post-freeze HEAD (do not assume it is still live):

- `1f5ce9e2cd0117284f6ae6fb56847f50c0162487`

Live HEAD of `exp/e0b-typing-reliability` must be recorded separately at preservation time.

---

## 3. Why each stage happened

### 3.1 Original continuity problem

The original problem was not merely "store more chat text."

It was: after interruption, model replacement, process restart, or new chat, preserve the user's actual working state without silently converting model suggestions into user decisions.

Relevant state included current working point, goal, constraints, decisions, rationale, rejected branches, open questions, provenance, user vs model origin, and authority state.

Relevant invariants included:

- RETRIEVAL != EVIDENCE
- MODEL_PROPOSAL != USER_DECISION
- SOURCE/SENDER != CONTENT_ORIGIN
- UNKNOWN != FALSE
- NOT_RETRIEVED != ABSENT
- GOOD RESUME != LEARNING
- CONTEXT PRESERVATION != STATE REVISION

### 3.2 TCE / Snapshot / Observer / Beacon line

Earlier experiments investigated continuity and resumption. They were useful diagnostically. They showed that compact state can help continuation; that strong continuation can coexist with state-fidelity errors; that model proposals can be carried forward as if previously accepted; that Observer / Beacon effects were not established as a reliable general solution; and that context continuity alone does not establish learning or justified persistent-state revision.

Core pivot:

GOOD CONTINUATION != CORRECT PERSISTENT STATE

This motivated the Memory Governance question.

### 3.3 Memory Governance pivot

Separate:

A. Given a correctly understood event: can durable state be changed safely?  
B. Given raw natural language: was the event understood correctly in the first place?

This separation produced:

- E0-A = governance given correct typing
- E0-B = typing / interpretation reliability before durable admission

### 3.4 E0-A

E0-A intentionally avoided natural-language ambiguity. It used correctly pretyped deterministic events.

Lab-only composition concept:

Crystal-like admission → Native-Kernel-like transition semantics → SQLite durable state → Continuum-like resume

Bounded result: E0-A PASS.

Meaning: given correctly typed events, the bounded laboratory governance path behaved correctly.

Non-claims:

- E0-A PASS != automatic typing solved
- E0-A PASS != production authorization
- E0-A PASS != owner-repository integration
- E0-A PASS != persistent cognition solved

This created the next question: who verifies that raw USER text is correctly interpreted before governance receives it?

### 3.5 E0-B

Central E0-B path:

RAW USER TEXT → semantic act / segmentation → intent / typing → later durable-state governance

Critical possible errors include:

- MODEL_PROPOSAL → USER_DECISION
- USER_CONSTRAINT → REJECTED_BRANCH
- HYPOTHESIS → RESULT
- CLAIM → VERIFIED_FACT
- TESTED → AUTHORIZED
- OPEN_QUESTION → DECISION

Also preserve:

SOURCE = USER != USER EXERCISED AUTHORITY IN EVERY UTTERANCE

### 3.6 Early data / provenance problem

The early atom set could not simply be promoted into clean generalization evidence. Earlier stages were useful for calibration, protocol development, discovering segmentation ambiguity, provenance repair, and identifying compound messages.

But model-exposed mappings / candidate labels meant those materials could not serve as the sole untouched generalization reference.

Methodological lesson:

MODEL-TOUCHED DATA != CLEAN HUMAN GENERALIZATION GOLD

This motivated the fresh untouched corpus.

### 3.7 Phase 1J / A0-A1-B design

Future evaluation conditions:

**A0 — END-TO-END RAW**  
Measures: DETECTION + SEGMENTATION + TYPING

A0 preregistered segmentation includes Unicode character spans; deterministic one-to-one matching; character-level IoU; threshold IoU >= 0.5; missed-act; over-segmentation; under-segmentation.

**A1 — TYPING GIVEN HUMAN SEGMENTATION**  
Requires `exact_target_span` derived from human segmentation.

**B — AUGMENTED / SEMANTIC PREPROCESSING VALUE OR LEAKAGE VS A1**

### 3.8 Fresh untouched corpus

Fresh USER parent slice: `t8u` → `t37u`  
N = 30 USER parents  
Calibration examples excluded.

Before human U0 response, do not represent this as model-labelled data.

### 3.9 Human U0

Human answered for all 30 parents:

1. How many separate main semantic actions are here?
2. What did I want to do / communicate with each action in my own words?

Result:

- FRESH_U0_COMPLETE = YES
- FRESH_U0_COUNT = 30
- 25 / 30 = one main semantic action
- 5 / 30 = two main semantic actions

Multi-action items:

- FRESH-U0-02
- FRESH-U0-04
- FRESH-U0-14
- FRESH-U0-15
- FRESH-U0-17

Human U0 captured:

- main semantic-action count
- human wording of intended act meaning

Human U0 did **not** capture:

- exact textual source span for each act

Human intent was frozen before formal typing labels.

Careful phrasing:

100% HUMAN U0 COMPLETION = 100% OF COLLECTED COUNT + INTENT TASK  
It does **not** mean 100% protocol-complete segmentation gold.

### 3.10 Freeze

Freeze integrity audit confirmed 30 unique FRESH-U0 items, 30 unique source parents, correct order, no missing items, no duplicates, and unchanged human fingerprint.

Verdict:

FREEZE_AUDIT_PASS_WITH_LIMITATION

Known limitation:

- HUMAN_REFERENCE_SUPPORTS_EXACT_BOUNDARY_SCORING = NO
- HUMAN_REFERENCE_SUPPORTS_ACTION_COUNT_SCORING = YES
- HUMAN_REFERENCE_SUPPORTS_SEMANTIC_INTENT_COMPARISON = YES

### 3.11 Boundary gap

The artifact-grounded dependency audit inspected the actual protocol files and found that U0 collection missed one already-required layer: exact human textual boundaries.

The frozen artifact contains act count + intent wording, but not act source spans.

Therefore:

INTENT WORDING != TEXTUAL BOUNDARY

This is an execution miss, not evidence that the original protocol did not require spans.

### 3.12 Why A0 / A1 / B are blocked

- A0 cannot compute valid char-IoU segmentation gold without human spans.
- A1 cannot materialize `exact_target_span` without human spans.
- B depends on valid A1 span-conditioned inputs.

Therefore:

HUMAN_BOUNDARY_LAYER_REQUIRED_FIRST

Current protocol dependency result:

- CURRENT_U0_SUFFICIENT_FOR_A0 = NO
- CURRENT_U0_SUFFICIENT_FOR_A1 = NO
- CURRENT_U0_SUFFICIENT_FOR_B = NO

### 3.13 U0b

Future sibling artifact: `HUMAN_BOUNDARY_REFERENCE_U0b`

Frozen `HUMAN_SEGMENTATION_REFERENCE` must remain immutable.

For each item:

- human explicitly marks FULL_PARENT; OR
- human supplies exact verbatim substring for each act.

Offsets may be computed deterministically only after human selection.

Do not infer boundaries from human intent wording.  
Do not use model suggestions.  
Do not expose candidate cuts before the human decision.

Current next artifact:

HUMAN_BOUNDARY_REFERENCE_U0b = NOT_CREATED

### 3.14 Important semantic guards

- INTENT WORDING != TEXTUAL BOUNDARY
- PASTED TEXT != USER AUTHORSHIP
- But: PASTED TEXT MAY STILL BE PART OF THE USER'S COMMUNICATIVE ACT
- ACKNOWLEDGMENT TOKEN != AUTOMATICALLY OUTSIDE THE ACT SPAN
- SINGLE ACT != AUTOMATIC span(0, len(parent))

Human boundary choice is required.

### 3.15 u0b_triage.py (ancillary only)

Record as ancillary experimental material only.

Known artifact SHA-256:

`708a778956063dc429de03cf72e38fa50ee13dd469ca4261db95f9f479efebac`

Ruleset: `u0b-triage-rules-v1`  
Ruleset SHA-256:

`7e813d7471d8fb19b98d7e50bfed62e730b8f1856e32cda7e981dd32bfb78f7c`

Status:

- PROPOSED
- PROTOCOL AMENDMENT
- NOT PREREGISTERED

Current clean-path decision:

DO NOT RUN BEFORE OR DURING HUMAN U0b COLLECTION

If ever used, prefer POST-FREEZE AUDIT ONLY.  
Do not promote the script into gold generation.

---

## 4. Current stop state

Downstream state:

- GENERALIZATION_HUMAN_GOLD = NOT_CREATED
- A0 = NOT_RUN
- A1 = NOT_RUN
- B = NOT_RUN

No model-understanding accuracy result exists yet.

Exact next bounded action:

Collect and freeze a separate human boundary layer (`HUMAN_BOUNDARY_REFERENCE_U0b`) without modifying `HUMAN_SEGMENTATION_REFERENCE`.

---

## 5. Non-claims

Do **not** write or infer that:

- E0-B passed
- model understands user intent
- typing reliability established
- segmentation solved
- memory understanding solved
- human intent can be perfectly inferred
- LLMs understand intent reliably
- one-act messages always equal whole-parent spans
- pasted material is outside an act
- acknowledgment words are outside an act
- semantic typing is solved
- Crystal should integrate E0-B
- Soul should adopt a new cognition primitive
- Continuum should change its preregistration
- U0b is complete
- A0/A1/B have run
- production/runtime activation is authorized

---

## 6. Related protocol / contract files (index only)

Evidence and protocol live under `experiments/memory-governance-e0b/`. Exact frozen hashes and Git commits remain the evidence authority. This narrative does not replace those artifacts.

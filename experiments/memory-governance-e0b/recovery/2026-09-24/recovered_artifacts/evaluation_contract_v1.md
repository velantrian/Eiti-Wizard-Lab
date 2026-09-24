# E0-B Phase 1H-R — Evaluation Contract v1 (FROZEN)

Package SHA256: `745af6f39f2a2781553d8a289a7bd3a48d70773c27d9d74be04bbf975c3d9352`
Frozen at: 2026-09-22T00:18:44.315050+02:00
HUMAN_GOLD: NOT_CREATED
BLIND_RUN: NOT_RUN

## What E0-B evaluates

E0-B scores **typing reliability** of USER spans under a frozen representation contract.
It does **not** yet expand the semantic taxonomy.

### Three distinct objects (must not be collapsed)

| Object | Question | Typical evidence |
|--------|----------|------------------|
| **SPEECH_ACT** | What act is expressed by the *source utterance*? | Exact span text (+ allowed structural context per classifier_input_contract) |
| **COMMUNICATIVE_GOAL** | Why was the utterance made? | May require broader dialogue context; not identical to SPEECH_ACT |
| **RETROSPECTIVE_USER_SELF_REPORT** | What the user later says they intended / knew / meant | Interview / self-report only; never silently overwrite SPEECH_ACT |

### Representation contract (candidate_mapping.proposed)

Outer `CANDIDATE_MAPPING` structure remains valid.

Inside `proposed` use **one** semantic contract:

```
PRIMARY_ACT: <enum> | null
SECONDARY_ACTS: <array of enum> | null
```

Semantics of empty vs null:
- `SECONDARY_ACTS: []` = annotator **explicitly** identified no secondary acts
- `SECONDARY_ACTS: null` = **not annotated / unresolved**
- Neither `[]` nor `null` implies `DIRECT_HUMAN_CONFIRMATION`

`MULTI_ACT`: **deprecated** unless a specific justified semantic purpose is documented in a later contract bump. Prefer PRIMARY_ACT + SECONDARY_ACTS.

`COMPOUND`: **structural metadata only** (atomicity / span structure), not a semantic act label.

### DIRECT_HUMAN_CONFIRMATION

Allowed values: `YES` | `NO` | `PARTIAL` | `SOURCE_NOT_RECOVERED`

Current interview-derived claims: `SOURCE_NOT_RECOVERED`.

### V07 compatibility (not discrepancy-required)

For E0B-V07 preserve separately:
- SOURCE SPEECH_ACT: QUESTION-like
- RETROSPECTIVE SELF-REPORT: (when available) understood experimental state / testing memory-state recovery

Compatibility status ∈ {COMPATIBLE, INCOMPATIBLE, UNDERDETERMINED, UNKNOWN}.
Do **not** decide INCOMPATIBLE merely because layers differ.
Current: **UNDERDETERMINED**.

### Provenance separation for RATIONALE / REJECTED_BRANCH / OPEN_LOOP

Each of these fields must carry provenance when asserted:
- `SOURCE_TEXT` — visible in span/parent text
- `INTERVIEW` / `RETROSPECTIVE_SELF_REPORT` — from self-report
- `MODEL_INFERENCE` — forbidden in gold without confirmation

### Annotation exposure

`ANNOTATION_EXPOSURE = CANDIDATE_LABELS_SEEN`

Current set retained for protocol development / calibration / governance bridge.
A later **fresh untouched** set is required for cleaner generalization testing.

### Out of scope for this freeze

- Creating HUMAN_GOLD
- Blind classification / scoring
- Expanding semantic taxonomy

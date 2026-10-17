# ADMISSION_STATE_ROUTING_SLICE_v0.1

**Status:** Spec only — Research / E0-A  
**Date:** 2026-09-21  
**Non-goals:** No Memory Admission Controller organ; no implementation; no PST-01; no E0-B; no graph DB / Laya / ENGRAFT; no assumed new owner.

**Missing arrow this slice names:**

```
KNOWN TYPED EVENT → ADMISSION OUTCOME → AUTHORITY-APPROPRIATE STATE
```

**Depends on:** E0-A fixture PASS (deterministic law) + owner crosswalk (ecosystem conformance UNKNOWN / PARTIAL on admit triad).

---

## 0. Purpose

Minimum contract that routes a **known typed event** to an **admission outcome** and then to an **authority-appropriate durable state**, using only existing owner candidates where evidence exists, and marking gaps as **UNKNOWN**.

This is a routing law, not a new subsystem.

---

## 1. Input contract

### 1.1 Required fields

| Field | Type | Notes |
|-------|------|-------|
| `event_id` | stable id | Immutable once stored |
| `event_type` | enum (below) | **Known at ingress** — set by fixture/caller, never by LLM at commit time |
| `content` | text | Opaque payload for this slice |
| `source_actor` | enum | at least `MODEL` \| `USER` \| `SYSTEM` \| `RESEARCH` |
| `authority_class` | enum | derived or explicit (below) |
| `created_at` | timestamp | |
| `provenance` | object | see §5 |
| `rationale` | string \| null | required on some transitions; see §6 |

### 1.2 Event types (closed set for this slice)

| `event_type` | Meaning |
|--------------|---------|
| `MODEL_PROPOSAL` | Model-authored proposal; not a user decision |
| `USER_DECISION` | Explicit user decision for a scoped question |
| `RESEARCH_CLAIM` | Unsupported or weakly supported research claim |
| `OPEN_LOOP` | Explicit unresolved question / authorization gap |

No other types in v0.1. Unknown types → do not route; record as non-admitted observation only if an existing store path already allows raw append (**UNKNOWN** whether any owner must accept them).

### 1.3 Authority class (closed set)

| `authority_class` | Who may produce ACTIVE decision state |
|-------------------|----------------------------------------|
| `USER` | User (or user-delegated explicit confirm) |
| `MODEL` | Model — **never** sufficient alone for ACTIVE decision in this slice |
| `RESEARCH` | Research/process claim — **never** sufficient alone for ACTIVE decision |
| `SYSTEM` | Deterministic fixture/runner only |

### 1.4 Preconditions

- Event type is **known** before routing (fixture-typed or prior typed intake).
- LLM may draft content; LLM must **not** choose `event_type`, admission outcome, or commit.

---

## 2. Admission outcomes

Closed set:

| Outcome | Meaning |
|---------|---------|
| `ACCEPT` | Admitted into an authority-appropriate durable state (may be ACTIVE, or a non-authoritative held/proposed form — see §3) |
| `HOLD` | Retained as observed/non-authoritative; not ACTIVE decision |
| `REJECT` | Explicitly not adopted; row retained; no silent erase |

---

## 3. States

Closed set for authoritative / retained branches:

| State | Meaning |
|-------|---------|
| `ACTIVE` | Current authoritative scoped decision (or active open-loop marker if typed as such) |
| `REJECTED` | Explicitly not adopted; retrievable |
| `SUPERSEDED` | Was authoritative or candidate; replaced by a later justified transition |
| `UNKNOWN` | Only when projection cannot classify; must not be used to smuggle ACTIVE |

**Non-authoritative retained forms** used by routing (may be stored as state_status or subtype):

| Form | Used for |
|------|----------|
| `PROPOSED` | Accepted-as-proposal (`MODEL_PROPOSAL` + `ACCEPT`) — **not** ACTIVE |
| `HELD` | Accepted-as-hold (`RESEARCH_CLAIM` / unresolved) — **not** ACTIVE |

If an existing store lacks `PROPOSED`/`HELD` enums, mapping onto local vocabulary is an adapter concern; semantics above remain normative for E0-A.

---

## 4. Allowed transitions (routing table)

Notation: `(event_type, outcome) → state_effect`.

| event_type | outcome | Resulting state effect | Forbidden |
|------------|---------|------------------------|-----------|
| `MODEL_PROPOSAL` | `ACCEPT` | Create/retain **PROPOSED** (non-ACTIVE) | → `ACTIVE` |
| `MODEL_PROPOSAL` | `HOLD` | Retain as **HELD**/PROPOSED non-ACTIVE | → `ACTIVE` |
| `MODEL_PROPOSAL` | `REJECT` | **REJECTED**; keep row | delete / overwrite silence |
| `USER_DECISION` | `ACCEPT` | New **ACTIVE** scoped decision; prior conflicting PROPOSED/ACTIVE → `REJECTED` or `SUPERSEDED` with relation | LLM solo ACTIVE |
| `USER_DECISION` | `HOLD` | Discouraged in v0.1; if used, must not create second ACTIVE | dual ACTIVE |
| `USER_DECISION` | `REJECT` | Decision event stored as **REJECTED** (user declined) | erase history |
| `RESEARCH_CLAIM` | `ACCEPT` | **HELD** observed claim only | → `ACTIVE` decision |
| `RESEARCH_CLAIM` | `HOLD` | **HELD** | → `ACTIVE` |
| `RESEARCH_CLAIM` | `REJECT` | **REJECTED** | erase |
| `OPEN_LOOP` | `ACCEPT` | Open-loop record **ACTIVE** *as loop*, not as Phase authorization decision | treat as production auth |
| `OPEN_LOOP` | `HOLD` | Same as retain open | close without rationale |
| `OPEN_LOOP` | `REJECT` | Loop closed/rejected with rationale | silent drop |

**Invariant:** At most one **ACTIVE** *decision* per scope key (e.g. `goal_id` / decision scope). Open-loops are separate scope.

---

## 5. Authority requirements

| event_type | Minimum authority to `ACCEPT` into listed effect |
|------------|--------------------------------------------------|
| `MODEL_PROPOSAL` | `MODEL` or `SYSTEM` → PROPOSED/HELD only |
| `USER_DECISION` | `USER` (or explicit user-delegated confirm) → ACTIVE decision |
| `RESEARCH_CLAIM` | `MODEL` \| `RESEARCH` \| `SYSTEM` → HELD only |
| `OPEN_LOOP` | any actor may open; **closing** into authorized production requires `USER` (out of scope to auto-close) |

**Hard rules**

1. `authority_class=MODEL` must not produce ACTIVE **decision**.
2. Re-typed or untyped model text must not be upgraded to `USER_DECISION` by the model.
3. No existing owner may be assumed to supply USER authority without an explicit user-sourced event.

---

## 6. Provenance requirements

Every routed event and every state row MUST carry:

| Field | Required |
|-------|----------|
| `event_id` | yes |
| `source_actor` | yes |
| `authority_class` | yes |
| `source_ref` | yes if available (message/fixture/step id) |
| `admitted_from_event_id` | yes on state rows |
| `admission_outcome` | yes on state rows |
| `scope_key` | yes for decisions / open loops |

Relations (minimum):

| relation_type | When |
|---------------|------|
| `REJECTED_BECAUSE` | proposal rejected due to user decision / policy |
| `SUPERSEDES` | new ACTIVE replaces prior ACTIVE/PROPOSED |
| `CONTRADICTS` | optional; re-assertion against ACTIVE |
| `SUPPORTS` | optional; evidence link (not sufficient alone for ACTIVE) |

No silent erasure: SUPERSEDED/REJECTED rows remain queryable.

---

## 7. Rationale requirements

| Transition | `rationale` |
|------------|-------------|
| `USER_DECISION` → ACTIVE | required (may be short; fixture may supply) |
| `MODEL_PROPOSAL` → REJECTED on re-assertion | required (e.g. conflicts with ACTIVE decision) |
| `RESEARCH_CLAIM` → HELD | required note that claim is non-authoritative |
| `OPEN_LOOP` open | required question text |
| PROPOSED accept | optional |

Empty rationale on REJECT/SUPERSEDE of a prior PROPOSED when USER_DECISION applies is a **contract violation** for this slice.

---

## 8. Re-assertion / conflict behavior

### 8.1 Re-assertion of `MODEL_PROPOSAL` equal (or equivalent) to a REJECTED/PROPOSED item while an ACTIVE conflicting `USER_DECISION` exists

- Outcome: `REJECT` (or HOLD as duplicate observation)
- Must **not** create a second ACTIVE
- Must link `REJECTED_BECAUSE` / `CONTRADICTS` to ACTIVE decision
- Resume must surface rejected branch

### 8.2 New `USER_DECISION` conflicting with prior ACTIVE

- Prior ACTIVE → `SUPERSEDED` (not deleted)
- New state → `ACTIVE`
- Relation `SUPERSEDES` + rationale required

### 8.3 `RESEARCH_CLAIM` that asserts authorization / production readiness

- `HOLD` or `REJECT` as claim; **never** ACTIVE decision
- May open or reinforce an `OPEN_LOOP` on authorization

---

## 9. Existing owner mapping (evidence-bound; no assumed new owner)

Legend: **implements** = code path exists for that step’s *general* substrate; **gap** = does not implement E0-A typed triad semantics.

| Step | Existing owner candidate | Status | Evidence (from crosswalk) |
|------|--------------------------|--------|---------------------------|
| Receive typed/generic event | **Native Kernel** | usable substrate | `build_event_envelope`, append store |
| Receive (utterance ingest) | **Crystal** | alternate path; not E0-A types | `core/ingest.py` |
| Admit allow/deny (binary) | **Native Kernel** | **PARTIAL** — no HOLD; no MODEL_PROPOSAL/USER_DECISION/RESEARCH_CLAIM triad | `EventType.ADMIT`, `StaticAuthorityPolicy.decide`, `AdmissionReceipt` |
| Guardian / truth / curator reject | **Crystal** | **PARTIAL** — fact/utterance path; staged admission **doc-only** | `ingest.py`; `STAGED_WORKING_MEMORY_ADMISSION.md` (“Current implementation claim: None”) |
| HOLD disposition | — | **UNKNOWN** / **NOT_IMPLEMENTED** in inspected owners | Continuum enums in `e0-state.schema.json` are Experiment-0 schema only, not a live gate |
| Enforce SUPERSEDED links | **Native Kernel**, **Crystal** | **PARTIAL** — claim/conflict supersession, not E0-A decision law | `EventType.SUPERSEDED` + reducer; `conflict_decision.py` |
| Store event / relation | **Native Kernel**, **Mentaury Soul**, **Crystal** | substrate **SUPPORTED** | append store; `SQLiteEventPayloadStore`; Crystal memory/review stores |
| Project authoritative ACTIVE + retained REJECTED/HELD | — | **UNKNOWN** as single governance projection | NK `SemanticState` / Crystal review projection are not E0-A resume bundle |
| Resume retrieval (goal, ACTIVE, rationale, rejected branch, open loop, next) | **Crystal** review-resume **PARTIAL**; Clean Resume in Lab = chat snapshot | **UNKNOWN** for full E0-A bundle | `test_review_resumable.py`; Lab Clean Resume |
| Typed routing table §4 | — | **UNKNOWN** — no inspected owner exports this table | E0-A Lab fixture implements law **outside** Crystal/NK/Continuum/Mentaury wiring |
| Mentaury-Kernel admission | — | **NOT_IMPLEMENTED** (spec field only) | `CAPABILITY_PORT_V0_1.md` `target_admission_required` |
| Continuum live admit gate | — | **NOT_IMPLEMENTED** | lifecycle enums only |

**Do not assign** a new owner. Where status is UNKNOWN / NOT_IMPLEMENTED / PARTIAL relative to §4, ownership remains unresolved.

---

## 10. What remains UNKNOWN

1. **Who** is the live owner of the typed routing table (§4) in the ecosystem (not the Lab fixture).
2. **Who** emits `HOLD` as a first-class admission outcome (NK deny ≠ HOLD).
3. **Who** projects ACTIVE decision + REJECTED/HELD branches + OPEN_LOOP as one authoritative governance view.
4. **Who** resumes that bundle across chat/process boundaries (beyond Crystal review-session and Lab chat snapshot).
5. Whether Crystal staged admission (doc) or NK ADMIT will be extended **by their owners** — out of scope for this slice to decide.

---

## 11. Hosting verdict (ecosystem)

**Can the missing arrow be hosted entirely by existing owners/contracts today?**

**No — not as a complete typed path.**

- Substrates for **receive** and **store** exist (Native Kernel primary; Soul/Crystal stores).
- **Binary admit/deny** and **some supersession** exist (NK, Crystal) but do **not** implement  
  `MODEL_PROPOSAL → PROPOSED`, `USER_DECISION → ACTIVE`, `RESEARCH_CLAIM → HELD`, re-assert → `REJECT` without dual ACTIVE.
- Therefore:

```
OWNERSHIP OF TYPED ADMISSION→STATE ROUTING: UNKNOWN
```

```
MISSING ARROW REMAINS:
KNOWN TYPED EVENT → ADMISSION OUTCOME → AUTHORITY-APPROPRIATE STATE
```

Existing owners may later absorb this slice **without** a new Memory Admission Controller organ — but that absorption is **not confirmed** by current contracts/code. The Lab E0-A fixture demonstrates the law in isolation only; it is **not** an ecosystem owner.

---

## 12. STOP

Spec slice complete. No implementation. No new organ. No PST-01. No E0-B.

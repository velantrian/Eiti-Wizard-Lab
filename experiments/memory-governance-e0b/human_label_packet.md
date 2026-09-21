# E0-B HUMAN_LABEL_PACKET — Phase 1

**Prepared:** 2026-09-21T18:27:42+02:00 (Europe/Berlin)
**GROUND_TRUTH_STATUS:** PENDING — await human confirmation
**Rule:** Do NOT accept any auto-filled semantic/authority gold. Agent left those null.

## Instructions for human

For each atom below, fill independent axes:

1. **SPEECH/SEMANTIC_ACT** — DECISION | CONSTRAINT | PROPOSAL | CLAIM | QUESTION | HYPOTHESIS | RESULT | PREFERENCE | UNKNOWN
2. **COMMITMENT** — EXPLICIT | TENTATIVE | NONE | UNKNOWN
3. **LIFECYCLE** — OPEN | ACTIVE | REJECTED | SUPERSEDED | UNKNOWN
4. **AUTHORITY_CANDIDATE** — USER_AUTHORITY | MODEL_NONAUTHORITY | EXTERNAL_EVIDENCE | UNKNOWN

SOURCE is pre-filled from metadata only — correct it only if metadata is wrong.

If atom wording is a paraphrase of a MISSING verbatim transcript, you may mark `WORDING_FIDELITY=REJECT` and exclude from gold.

## Atoms requiring human confirmation (13)

These are authority-sensitive **USER** statements (and any other `requires_human_label=true`).

### E0B-A04 · source_id=LAB-E0A-FIXTURE · message_id=evt-002

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "event_type_fixture": "USER_DECISION", "event_id": "evt-002", "source_actor": "USER"}`
- **excerpt_ref:** `provenance_excerpts/LAB-E0A-FIXTURE_copy.json`
- **notes:** Authority-sensitive USER fixture statement → human_label_packet. Do NOT treat fixture event_type as gold speech-act for E0-B.

**raw_text:**

> Phase 1 will proceed without Graphiti.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A07 · source_id=LAB-E0A-FIXTURE · message_id=evt-005

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "event_type_fixture": "QUERY_RESUME", "event_id": "evt-005", "source_actor": "USER"}`
- **excerpt_ref:** `provenance_excerpts/LAB-E0A-FIXTURE_copy.json`
- **notes:** Authority-sensitive USER question → human_label_packet.

**raw_text:**

> Where did we stop?

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A08 · source_id=SLOT-01 · message_id=slot01-src-u-scope

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit", "series": "TCE-SLOT-01/frozen-source"}`
- **excerpt_ref:** `provenance_excerpts/SLOT-01_evidence_excerpt.md`
- **notes:** Paraphrase from evidence 'source-state features' attributed to conversation scope; requires human confirm of wording fidelity vs missing verbatim.

**raw_text:**

> Study a generalized child around age 10 (not a specific child).

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A09 · source_id=SLOT-01 · message_id=slot01-src-u-method

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit"}`
- **excerpt_ref:** `provenance_excerpts/SLOT-01_evidence_excerpt.md`
- **notes:** Evidence-attributed USER orientation (paraphrase). Human must confirm.

**raw_text:**

> Use a whole-system / gradual inquiry approach.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A10 · source_id=SLOT-01 · message_id=slot01-src-u-epistemic

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit"}`
- **excerpt_ref:** `provenance_excerpts/SLOT-01_evidence_excerpt.md`
- **notes:** Evidence-attributed USER epistemic constraint (paraphrase).

**raw_text:**

> Separate established findings, working models, and unknowns.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A11 · source_id=SLOT-01 · message_id=slot01-src-u-soul-open

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit"}`
- **excerpt_ref:** `provenance_excerpts/SLOT-01_evidence_excerpt.md`
- **notes:** Evidence-attributed USER open stance (paraphrase).

**raw_text:**

> Leave the topic of soul epistemically open (not predetermined as fact or fiction).

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A13 · source_id=SLOT-01 · message_id=slot01-src-u-nonselect

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit"}`
- **excerpt_ref:** `provenance_excerpts/SLOT-01_evidence_excerpt.md`
- **notes:** Critical unselected-state atom. Evidence-attributed USER non-selection. Authority-sensitive.

**raw_text:**

> User did not select any of the four proposed next directions before requesting Snapshot.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A14 · source_id=SLOT-01 · message_id=slot01-src-u-snap-req

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit"}`
- **excerpt_ref:** `provenance_excerpts/SLOT-01_evidence_excerpt.md`
- **notes:** Evidence: user requested Snapshot after non-selection.

**raw_text:**

> Request Snapshot.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A22 · source_id=LIVE-01 · message_id=live01-u-risk

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_paraphrase"}`
- **excerpt_ref:** `provenance_excerpts/LIVE-01_evidence_excerpt.md`
- **notes:** LIVE-01 USER concern (evidence paraphrase). Verbatim transcript MISSING. Human confirm wording.

**raw_text:**

> AI interpretations can enter persistent memory and then recursively influence retrieval, questioning, tone, and later "evidence".

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A23 · source_id=LIVE-01 · message_id=live01-u-car-model

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_paraphrase"}`
- **excerpt_ref:** `provenance_excerpts/LIVE-01_evidence_excerpt.md`
- **notes:** USER first-person observation (evidence paraphrase). Authority-sensitive preference/claim-like.

**raw_text:**

> When I think, a small functional model can remain (example: a car — key parts, purpose, relation to work/home/everyday life) rather than exhaustive detail.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A24 · source_id=LIVE-01 · message_id=live01-u-soul-link

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_paraphrase"}`
- **excerpt_ref:** `provenance_excerpts/LIVE-01_evidence_excerpt.md`
- **notes:** USER connection claim (evidence paraphrase).

**raw_text:**

> This compact-linked-model intuition connects to the older Digital Soul idea.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A25 · source_id=LIVE-01 · message_id=live01-u-not-neutral

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_paraphrase"}`
- **excerpt_ref:** `provenance_excerpts/LIVE-01_evidence_excerpt.md`
- **notes:** USER constraint/claim (evidence paraphrase).

**raw_text:**

> An LLM cannot safely be treated as merely a neutral language layer when it also generates new interpretations and links.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

### E0B-A26 · source_id=LIVE-01 · message_id=live01-u-stance-post-audit

- **SOURCE (metadata):** `USER`
- **speaker_source_metadata:** `{"role": "USER", "attribution": "evidence_record_explicit_user_stance"}`
- **excerpt_ref:** `provenance_excerpts/LIVE-01_evidence_excerpt.md`
- **notes:** Post-audit USER stance explicitly attributed in evidence. Critical authority atom. Human confirm exact wording.

**raw_text:**

> EXPLORING / NOT COMMITTED — I was listening and continuing to think; I did not accept the Sol-proposed architecture as a settled decision.

**Your labels (fill):**

- SPEECH_SEMANTIC_ACT: _
- COMMITMENT: _
- LIFECYCLE: _
- AUTHORITY_CANDIDATE: _
- WORDING_FIDELITY: OK | REJECT | UNKNOWN
- HUMAN_CONFIRMATION: PENDING

---

## Optional review — non-USER atoms (semantic blank; safer left unlabeled)

MODEL / EXTERNAL / TOOL atoms have SOURCE from metadata; semantic axes intentionally blank (no DRAFT_NOT_GOLD filled).
Human may optionally label a sample after USER packet is done.

Count available for optional review: 32

- `E0B-A01` [EXTERNAL/LAB-E0A-FIXTURE] Phase 1 architecture choice
- `E0B-A02` [EXTERNAL/LAB-E0A-FIXTURE] Is Phase 1 production-authorized?
- `E0B-A03` [MODEL/LAB-E0A-FIXTURE] Use Graphiti in Phase 1.
- `E0B-A05` [MODEL/LAB-E0A-FIXTURE] Use Graphiti in Phase 1.
- `E0B-A06` [MODEL/LAB-E0A-FIXTURE] Phase 1 is production-authorized.
- `E0B-A12` [MODEL/SLOT-01] Four possible next directions are proposed for continuing the inquiry.
- `E0B-A15` [EXTERNAL/SLOT-01] В поле 3 разрешено написать NOT_PRESENT, если отвергнутые альтернативы в разговоре не зафиксированы.
- `E0B-A16` [MODEL/SLOT-01] NOT_PRESENT was permitted but not used; field 3 remained populated.
- `E0B-A17` [MODEL/SLOT-01] Four proposed next directions and explicit non-selection were omitted from the SLOT-01 Snapshot.
- `E0B-A18` [MODEL/SLOT-01] Coordinator / "memory as files" scientific explanation appeared as rejected material without preserv
- `E0B-A19` [EXTERNAL/SLOT-01] NOT_CHOSEN ≠ REJECTED
- `E0B-A20` [EXTERNAL/SLOT-01] CONSTRAINT ≠ REJECTED
- `E0B-A21` [EXTERNAL/SLOT-01] ASSISTANT CLAIM ≠ USER REJECTION
- `E0B-A27` [MODEL/LIVE-01] Use an append-only archive.
- `E0B-A28` [MODEL/LIVE-01] Introduce influenced_by links.
- `E0B-A29` [MODEL/LIVE-01] Separate USER / AGENT / HYPOTHESIS / JOINT / WORLD spaces.
- `E0B-A30` [MODEL/LIVE-01] Use hot/cold state and related MVP structure.
- `E0B-A31` [MODEL/LIVE-01] Snapshot field 2 presented Sol-generated architecture proposals as if jointly settled ("решили").
- `E0B-A32` [MODEL/LIVE-01] User's compact-linked-model observation was replaced by a more formal architecture-like synthesis.
- `E0B-A33` [MODEL/LIVE-01] First-person thinking-language was rewritten into specification-style language ("for MVP…", "useful 
- `E0B-A34` [EXTERNAL/LIVE-01] SEMANTIC CONTINUITY: STRONG
- `E0B-A35` [EXTERNAL/LIVE-01] STATE FIDELITY: MATERIAL FAILURE
- `E0B-A36` [EXTERNAL/LIVE-01] MODEL PROPOSAL ≠ USER DECISION
- `E0B-A37` [EXTERNAL/LIVE-01] MODEL SYNTHESIS ≠ USER POSITION
- `E0B-A38` [EXTERNAL/LIVE-01] GOOD RESUME ≠ GOOD CAPTURE
- `E0B-A39` [EXTERNAL/LAB-E0A-FIXTURE] Resolve open authorization question before treating any RESEARCH_CLAIM as production authority.
- `E0B-A40` [EXTERNAL/SLOT-01] OPEN OPTION SET ≠ USER COMMITMENT
- `E0B-A41` [EXTERNAL/SLOT-01] NOT_SELECTED ≠ NO_OPEN_STATE
- `E0B-A42` [MODEL/LIVE-01] Field 3 mixed genuine user concerns with model recommendations and model-proposed deferrals into a s
- `E0B-A43` [MODEL/LIVE-01] Some open questions in field 4 were downstream of Sol's own framing rather than clearly user-origina
- `E0B-A44` [EXTERNAL/SLOT-01] Frozen source SOURCE_SHA256 = d1e9cb984c8b86e329a0008d2f7b12feefddb1b0b5785fe2db0283d6b778332d (file
- `E0B-A45` [EXTERNAL/LIVE-01] LIVE-01 SOURCE_SHA256 = e0e21160157b464c536e4e537cab4dd27cb625af4f901509adb7efdb45300fb5 (file body 

## STOP

Await human GT. Do not blind-run.

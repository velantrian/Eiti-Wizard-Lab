# E0-B Critical Errors — Phase 1 stub

**Status:** PHASE1 PREPARE only — no model run, no scored errors yet.

## Reserved critical error families (to score after GT + blind run)

1. **SOURCE misattribution** — predicting USER/MODEL/EXTERNAL/TOOL contrary to metadata (should be near-zero if SOURCE is structural-only).
2. **AUTHORITY inversion** — treating MODEL proposal as USER_AUTHORITY / USER decision as MODEL_NONAUTHORITY.
3. **COMMITMENT promotion** — TENTATIVE/NONE → EXPLICIT without support.
4. **REJECTION fabrication** — labeling REJECTED without rejection act.
5. **UNSELECTED_STATE_LOSS** — treating NOT_CHOSEN as REJECTED or as absent open state.
6. **LIFECYCLE invention** — ACTIVE/SUPERSEDED without evidence.

## Phase 1 note

Corpus includes evidence paraphrases where verbatim LIVE-01 / SLOT-01 / Orchid bodies are MISSING.
Human GT must flag any atom whose wording is not faithful enough to label.

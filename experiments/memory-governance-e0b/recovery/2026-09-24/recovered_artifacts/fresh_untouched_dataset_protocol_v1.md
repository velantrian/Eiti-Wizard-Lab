# E0-B Phase 1J — Fresh Untouched Dataset Protocol v1.1 (PATCHED)

Patched at: 2026-09-22T00:43:04.217576+02:00
Package reference (calibration): `745af6f39f2a2781553d8a289a7bd3a48d70773c27d9d74be04bbf975c3d9352`

## Purpose

Second dataset for cleaner generalization testing.
Current 22-span set remains `CALIBRATION_PROTOCOL_DEVELOPMENT` / `CANDIDATE_LABELS_SEEN`.

## Sampling rule (label-independent; preregistered)

**Do not cherry-pick messages by expected act class.**

Preregistered rule:

1. Choose a **contiguous / prospective** window of natural USER parent messages from a declared source stream (e.g. Labs agent transcript), ordered by timestamp ascending.
2. Inclusion criteria may use only **label-independent** filters: time range, stream id, sender=USER, non-empty text, language, length bounds.
3. Exclusion criteria (label-independent only): duplicates, empty/noise, media-only, already in calibration 22-span parent set.
4. Sample size N and window [T_start, T_end] / [msg_id_start, msg_id_end] must be written into the collection manifest **before** annotation begins.
5. After U0 annotation, report **naturally observed** class coverage. Sparse classes → `SPARSE / NOT_ESTIMABLE`. Do not fabricate examples to balance classes.

## Annotation order (1J PATCH)

### Stage U0 — parent-first human segmentation (before any A1 spans)

Present for each sampled item:
- **whole raw USER parent message only**
- genuinely structural provenance/context (message id, timestamp, sender_actor, hashes)

Human independently marks, **without** model segmentation or candidate labels:
- number of semantic acts
- exact act boundaries (Unicode offsets into parent)
- PRIMARY_ACT / SECONDARY_ACTS per act

Then:
- Freeze/hash **`HUMAN_SEGMENTATION_REFERENCE`**
- No A1 inputs may be derived before this freeze

### Stage U1 — derive A1 spans only AFTER U0 freeze

- Materialize presegmented spans strictly from frozen U0 boundaries.
- Optional `COMMUNICATIVE_GOAL` and `RETROSPECTIVE_USER_SELF_REPORT` remain **separate** surfaces (not forced equal to SPEECH_ACT).

### Forbidden during U0/U1 annotation

- model segmentation overlays
- candidate label sheets
- marker baselines as suggestions
- model-mediated interview summaries
- calibration candidate mappings

## Evaluation conditions (reuse)

- A0 RAW (on parent messages)
- A1 PRESEGMENTED RAW (from U0 freeze only)
- B AUGMENTED (provenance-tagged fields only)

## Status

| Item | Status |
|------|--------|
| Fresh sampling frame | see `fresh_collection_manifest_template_v1.json` |
| U0 started | NOT_YET (collection begins after 1J STOP) |
| HUMAN_SEGMENTATION_REFERENCE | NOT_CREATED |
| Fresh HUMAN_GOLD (generalization) | NOT_CREATED |
| Blind | NOT_RUN |

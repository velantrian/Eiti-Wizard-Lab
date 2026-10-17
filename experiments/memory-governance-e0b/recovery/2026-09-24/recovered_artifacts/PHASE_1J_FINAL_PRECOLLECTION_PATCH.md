# E0-B Phase 1J — Final Pre-Collection Patch

Patched at: 2026-09-22T00:43:04.217576+02:00
Calibration package: `745af6f39f2a2781553d8a289a7bd3a48d70773c27d9d74be04bbf975c3d9352`

## Corrections applied

1. Provenance split: exact span raw text = `SOURCE_TEXT`; IDs/hashes/offsets = `PURE_STRUCTURAL`.
2. `relation.target_atom_id` = `MODEL_INFERRED`, `FEEDBACK_RISK=YES`; excluded from A0/A1; B only with tag.
3. Fresh annotation order: **U0** parent-first human segmentation → freeze/hash `HUMAN_SEGMENTATION_REFERENCE` → **U1** derive A1 spans. Optional COMMUNICATIVE_GOAL / RETROSPECTIVE_USER_SELF_REPORT remain separate.
4. Fresh sampling: contiguous/prospective natural messages; no act-class cherry-picking; post-hoc natural coverage; sparse → `SPARSE / NOT_ESTIMABLE`.
5. A0 matching: character-level IoU; deterministic one-to-one maximum-overlap; threshold IoU ≥ 0.5.

## Patched / emitted files

- `input_field_provenance_audit_v1.md` (v1.1 content)
- `input_field_provenance_audit_v1_1_PATCH.md`
- `classifier_input_A0_raw_v1.json`
- `classifier_input_A1_presegmented_raw_v1.json`
- `classifier_input_B_augmented_v1.json`
- `classifier_input_contract_v1.json` (if present)
- `segmentation_evaluation_contract_v1.md` (v1.1)
- `fresh_untouched_dataset_protocol_v1.md` (v1.1)
- `fresh_collection_manifest_template_v1.json`
- `PHASE_1J_FINAL_PRECOLLECTION_PATCH.md`

## Explicit non-actions

- A0/A1/B **not** run
- generalization HUMAN_GOLD **not** created
- No further protocol redesign unless blocking defect

## Next

BEGIN FRESH UNTOUCHED COLLECTION using `fresh_collection_manifest_template_v1.json`.

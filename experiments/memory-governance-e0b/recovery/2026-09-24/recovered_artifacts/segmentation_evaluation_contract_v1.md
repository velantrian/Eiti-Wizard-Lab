# E0-B Phase 1J — Segmentation Evaluation Contract v1.1 (PATCHED)

Package SHA256: `745af6f39f2a2781553d8a289a7bd3a48d70773c27d9d74be04bbf975c3d9352`
Patched at: 2026-09-22T00:43:04.217576+02:00
Applies to: **CONDITION A0 — END-TO-END RAW**

## Principle

Segmentation metrics are **separate** from label/typing accuracy.
Do **not** hide missed acts by evaluating only detected spans.

## Overlap definition (frozen)

- **Character-level IoU** over Unicode code-point spans (same offset basis as `exact_span`).
- IoU(a,b) = |a∩b| / |a∪b|.

## Matching rule (1J PATCH — deterministic one-to-one)

Replace order-dependent greedy matching with:

1. Compute IoU for every predicted↔gold pair.
2. Discard pairs with IoU **< 0.5**.
3. Perform **deterministic one-to-one maximum-overlap assignment**:
   - Sort candidate pairs by (IoU DESC, gold_start ASC, pred_start ASC, gold_id ASC, pred_id ASC).
   - Greedily accept pairs in that total order while both sides remain unmatched.
   - Equivalent to a stable maximum-weight matching under the frozen sort key when weights are IoUs and each node degree ≤ 1.
4. Prefer documenting Hungarian/MWBM on IoU weights if implementation is available; the sort-key one-to-one rule above is the **normative fallback** and must be deterministic across runs.

Threshold remains **IoU ≥ 0.5** unless a contract bump changes it.

## Metrics (unchanged list)

| Metric | Definition |
|--------|------------|
| act detection recall | TP / (TP+FN) over gold acts |
| act detection precision | TP / (TP+FP) over predicted acts |
| boundary / span overlap | character IoU on matched pairs |
| missed-act rate | FN / N_gold |
| over-segmentation rate | gold acts split into >1 preds / N_gold |
| under-segmentation rate | gold acts merged into one pred / N_gold |

## Reporting

1. Always report detection + segmentation **before** typing for A0.
2. Typing only on matched pairs; FN remain visible via recall / missed-act rate.
3. Sparse classes → `SPARSE / NOT_ESTIMABLE`.

## Out of scope

- Generalization claims from calibration set
- Creating HUMAN_GOLD

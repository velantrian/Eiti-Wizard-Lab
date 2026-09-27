# U0b Exposure Provenance — Recovery Checkpoint 2026-09-24

This document records model-assisted exposure status for FRESH-U0 items as known at recovery time. It is a **provenance checkpoint**, not a completion or bias analysis.

## Exposure record (exact)

- **FRESH-U0-01** `MODEL_ASSISTED_BOUNDARY_EXPOSURE` = **YES**
- **FRESH-U0-02** `MODEL_ASSISTED_CONTEXT_EXPOSURE` = **YES**; `BOUNDARY_STATUS` = **UNRESOLVED**
- **FRESH-U0-03** `MODEL_ASSISTED_BOUNDARY_EXPOSURE` = **YES**
- **FRESH-U0-04** `MODEL_ASSISTED_BOUNDARY_EXPOSURE` = **YES**
- **FRESH-U0-05** `MODEL_ASSISTED_BOUNDARY_EXPOSURE` = **YES**
- **FRESH-U0-05** `HUMAN_CONFIRMATION` = **FULL_PARENT**; `GROK_RECORD_STATUS` = **NOT_VERIFIED_BEFORE_RECOVERY_COMMIT**

## Definitions / caveats

- `ASSISTED_HUMAN_BOUNDARY` **!=** `STRICT_BLIND_HUMAN_GOLD`
- No claims are made here about bias magnitude or direction.
- U0b checkpoint file recovered as `HUMAN_BOUNDARY_REFERENCE_U0b.in_progress.json` with SHA-256 `9bcc60e86e67f3a739894f4d499c6c0a3a9bdbd7f144cb5b6e7fcbde9b56e039` is labeled **`U0B_WORKING_CHECKPOINT_PRE_CONTINUATION`**.
- This checkpoint is **NOT** final gold.
- **U0b is not complete.**
- Do **not** alter unresolved **FRESH-U0-02** in this recovery commit.
- Do **not** add or modify **FRESH-U0-05** content in this recovery commit.
- This recovery does not freeze U0b, create HUMAN_GOLD, or run A0/A1/B.

## Recovery surface only

Writes are confined to `experiments/memory-governance-e0b/recovery/2026-09-24/`. Frozen Human U0 artifacts remain unchanged.

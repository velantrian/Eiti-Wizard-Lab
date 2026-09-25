# crystal_like_admission — REFERENCE

| Field | Value |
|-------|-------|
| Lab name | `crystal_like_admission` |
| Reference owner | Crystal (`velantrian/velantrim-exocortex-crystal`) |
| Pinned HEAD | `3ed3a53ee9b8445a5f2ebf16046f782a3095555e` |
| Exact sources (RO) | `core/ingest.py`; `docs/architecture/STAGED_WORKING_MEMORY_ADMISSION.md`; `core/conflict_decision.py` |

## Reproduces (lab)
- Outcome space ACCEPT / HOLD / REJECT for fixture-typed E0-A events
- Rejected/held retention (no silent drop)

## Does NOT reproduce
- Guardian→TruthGate→Canon pipeline
- Staged admission (doc-only upstream)
- Crystal ESM / curator product semantics

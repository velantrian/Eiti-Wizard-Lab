# E0-B — Typing Reliability Probe (Phase 1A SOURCE INTEGRITY REPAIR)

Isolated experiment under `experiments/memory-governance-e0b/`.

## Status

**PHASE1A SOURCE INTEGRITY REPAIR complete · STOP**

- Primary corpus = **VERBATIM ONLY**
- `GROUND_TRUTH_STATUS = PENDING`
- Blind classification: **NOT_RUN**
- Orchid / LIVE-01 / SLOT-01 frozen transcripts: **MISSING**

## Corpus (Phase 1A)

| Metric | Value |
|--------|-------|
| Verbatim atoms | 7 |
| Source distribution | {'LAB-E0A-FIXTURE': 7} |
| SOURCE-axis distribution | {'EXTERNAL': 2, 'MODEL': 3, 'USER': 2} |
| Excluded (not verbatim) | 38 |
| Human-label required (USER) | 2 |
| Provenance coverage | 15.56% (7/45) |
| Target shortfall | 23 (integrity > size) |

## Layout

```
README.md
PROTOCOL.md
RESULT.md
SOURCE_INTEGRITY_REPORT.md
corpus_manifest.json
atoms_phase1.json          # primary = verbatim
atoms_verbatim.json        # same
atoms_excluded.json        # EXCLUDE_SOURCE_NOT_VERBATIM ledger
human_label_packet.md
blind_inputs.jsonl
model_outputs.jsonl        # NOT_RUN placeholder
metrics.json
confusion_matrix.csv
critical_errors.md
provenance_excerpts/
```

## Next human action

1. Recover frozen Orchid / LIVE-01 / SLOT-01 transcript files (paths + SHA256s in provenance excerpts) **or** accept fixture-only corpus
2. Open `human_label_packet.md` and label USER atoms
3. Only then authorize Phase 2 blind run

Prepared: 2026-09-21T18:35:03+02:00 (Europe/Berlin)

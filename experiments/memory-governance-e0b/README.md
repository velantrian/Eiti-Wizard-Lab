# E0-B — Typing Reliability Probe (Phase 1 PREPARE)

Isolated experiment under `experiments/memory-governance-e0b/`.

## Status

**PHASE1 PREPARE complete · STOP awaiting human GT**

- `GROUND_TRUTH_STATUS = PENDING`
- Blind classification: **NOT_RUN**

## Purpose

Probe reliability of independent typing axes (SOURCE / SPEECH-ACT / COMMITMENT / LIFECYCLE / AUTHORITY) on atomic statements — without promoting architecture or running blind classification until human gold is confirmed.

## Corpus (Phase 1)

| Metric | Value |
|--------|-------|
| Atoms | 45 |
| Source distribution | {'LAB-E0A-FIXTURE': 8, 'SLOT-01': 17, 'LIVE-01': 20} |
| SOURCE-axis distribution | {'EXTERNAL': 16, 'MODEL': 16, 'USER': 13} |
| Human-label required (USER) | 13 |

### Source availability

| Source | Status |
|--------|--------|
| Orchid | **MISSING** |
| LIVE-01 | PARTIAL — evidence paraphrases only; verbatim MISSING |
| SLOT-01 | PARTIAL — evidence paraphrases + condition notes; verbatim MISSING |
| LAB-E0A-FIXTURE | PRESENT (Lab-local read-only copy) |

## Layout

```
README.md
PROTOCOL.md
RESULT.md
corpus_manifest.json
atoms_phase1.json
human_label_packet.md
blind_inputs.jsonl
model_outputs.jsonl      # NOT_RUN placeholder
metrics.json             # NOT_RUN / GROUND_TRUTH_PENDING
confusion_matrix.csv     # stub header
critical_errors.md       # Phase1 stub
provenance_excerpts/     # copies + MISSING notes
```

## Next human action

1. Open `human_label_packet.md`
2. Confirm / edit labels for all USER atoms (and WORDING_FIDELITY)
3. Only then authorize Phase 2 blind run

Prepared: 2026-09-21T18:27:42+02:00 (Europe/Berlin)

# E0-B — Typing Reliability Probe (Phase 1B prospective verbatim)

Isolated experiment under `experiments/memory-governance-e0b/`.

## Status

**PHASE1B PROSPECTIVE VERBATIM CORPUS CAPTURE complete · STOP**

- Primary corpus = **VERBATIM ONLY**
- `GROUND_TRUTH_STATUS = PENDING`
- Blind classification: **NOT_RUN**
- New stream: **AGENT_CHAT** (prospective)
- Orchid / LIVE-01 / SLOT-01 frozen transcripts: **STILL MISSING**

## Corpus (Phase 1B)

| Metric | Value |
|--------|-------|
| Verbatim atoms | 42 |
| SOURCE-axis distribution | {'EXTERNAL': 2, 'MODEL': 30, 'USER': 10} |
| Source distribution | {'LAB-E0A-FIXTURE': 7, 'AGENT_CHAT:Labs': 35} |
| Excluded (not verbatim, prior) | 7 |
| Human-label required (USER) | 10 |
| Provenance coverage (primary) | 100% |

## Layout

```
README.md
PROTOCOL.md
RESULT.md
SOURCE_INTEGRITY_REPORT.md
PHASE_1B_CAPTURE_REPORT.md
corpus_manifest.json
raw_messages.json
atoms_phase1.json / atoms_verbatim.json
atoms_excluded.json
human_label_packet.md
blind_inputs.jsonl
provenance_excerpts/
```

## Next human action

1. Open `human_label_packet.md` and label USER atoms
2. Only then authorize Phase 2 blind run

Prepared: 2026-09-21T19:05:47+02:00 (Europe/Berlin)

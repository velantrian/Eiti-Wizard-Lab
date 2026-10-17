# E0-B PHASE 1C — ATOMICITY REPAIR REPORT

- Base HEAD: `e803e06906d2d00a8ff51c3b1c6f79aa9dd37128`
- Old USER atom count: **10**
- New atomic USER span count: **20**
- Old corpus total: **42**
- New corpus total: **52**
- Provenance coverage (primary verbatim): **100%** (spans reconstruct parents; parents archived)
- HUMAN_GOLD: NOT_CREATED
- BLIND_RUN: NOT_RUN

## Parent → child mapping

- `E0B-V08` → `E0B-V08.1`, `E0B-V08.2`
- `E0B-V17` → `E0B-V17.1`, `E0B-V17.2`
- `E0B-V18` → `E0B-V18.1`, `E0B-V18.2`, `E0B-V18.3`, `E0B-V18.4`
- `E0B-V21` → `E0B-V21.1`, `E0B-V21.2`
- `E0B-V31` → `E0B-V31.1`, `E0B-V31.2`
- `E0B-V34` → `E0B-V34.1`, `E0B-V34.2`
- `E0B-V38` → `E0B-V38.1`, `E0B-V38.2`, `E0B-V38.3`

## Kept atomic (unchanged)
- `E0B-V04`
- `E0B-V07`
- `E0B-V13`

## Ambiguous / soft boundaries
- **E0B-V08** (E0B-V08.1): Span .1 includes computer-access scaffolding before accuracy constraint; kept with question-family span per QUESTION+CONSTRAINT finding (not further split).
- **E0B-V18** (E0B-V18.1, E0B-V18.3): Two proposal-shaped contiguous spans (Ladybug/Kuzu vs SQLite/PostgreSQL); framing clause stays on .1.
- **E0B-V21** (E0B-V21.2): Span .2 mixes stack constraints with no-touch-main-repo constraint in one contiguous block.
- **E0B-V38** (E0B-V38.2, E0B-V38.3): Boundary at «если например» is soft; U+FFFC preserved inside .2.
- **E0B-V13** (E0B-V13): Left unsplit: single primary interrogative with brief setup; not in multi-act finding list.

## SOURCE counts (repaired primary)
- EXTERNAL: 2
- MODEL: 30
- USER: 20

## Files touched
- `atoms_verbatim.json` — primary corpus with atomic USER spans
- `atoms_parent_messages.json` — archived full parent USER messages (verbatim)
- `human_label_packet.md` — regenerated empty label packet
- `ATOMICITY_REPAIR_REPORT.md` / `.json` — this report

STOP. No HUMAN_GOLD. No blind run.

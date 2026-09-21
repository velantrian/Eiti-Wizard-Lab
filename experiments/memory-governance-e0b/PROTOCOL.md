# E0-B PROTOCOL — Typing Reliability Probe

**Phase 1 / 1A (this package):** prepare corpus + human label packet; Phase 1A repairs source integrity to VERBATIM-only. STOP.

**Integrity rule:** primary blind corpus admits only atoms with source_artifact + location + speaker + VERBATIM=YES exact text. Paraphrases → `atoms_excluded.json`.

## Objective

Measure typing reliability of five **independent** axes on atomic statements drawn from frozen transcripts / Lab fixtures.

## Axes (independent)

| Axis | Allowed values | Fill rule |
|------|----------------|-----------|
| SOURCE | USER \| MODEL \| EXTERNAL \| TOOL | **Metadata only** — never LLM-guessed |
| SPEECH/SEMANTIC_ACT | DECISION \| CONSTRAINT \| PROPOSAL \| CLAIM \| QUESTION \| HYPOTHESIS \| RESULT \| PREFERENCE \| UNKNOWN | Human GT for authority-sensitive USER; else blank until GT |
| COMMITMENT | EXPLICIT \| TENTATIVE \| NONE \| UNKNOWN | same |
| LIFECYCLE | OPEN \| ACTIVE \| REJECTED \| SUPERSEDED \| UNKNOWN | same |
| AUTHORITY_CANDIDATE | USER_AUTHORITY \| MODEL_NONAUTHORITY \| EXTERNAL_EVIDENCE \| UNKNOWN | same |

## Phase plan

1. **Phase 1 (THIS):** Build corpus (~30–50 atoms), `human_label_packet.md`, blind inputs without gold. `GROUND_TRUTH_STATUS=PENDING`. **No blind run.**
2. **Phase 2 (NOT AUTHORIZED HERE):** After human GT → blind model classification → metrics / confusion / critical errors.

## Hard exclusions

- No PST-01
- No Graphiti / Kuzu / FalkorDB
- No new controller / organ / architecture promotion
- No writes to owner repos (Crystal, Native Kernel, Continuum, Mentaury*, Titan)
- No mutation of `experiments/memory-governance-e0a/**` except reading
- No inferred gold for authority-sensitive USER statements

## Atom schema

See `atoms_phase1.json` and `blind_inputs.jsonl`.

## Prepared / Phase 1A repaired

2026-09-21T18:35:03+02:00 Europe/Berlin

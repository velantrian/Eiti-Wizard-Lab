# E0-A — Ownership & Governance Conformance Probe

Isolated experiment under `experiments/memory-governance-e0a/`.

## Purpose

Probe whether MODEL_PROPOSAL / USER_DECISION / RESEARCH_CLAIM transition law can be enforced deterministically with append-only storage, retrievable rejected branches, and resume projection — **without** creating a new architecture organ and **without** mutating existing memory DBs.

## Constraints

- No LLM for event typing or commit (fixture types hardcoded)
- No Kuzu / FalkorDB / Graphiti
- No mutation of existing lab memory stores (IndexedDB / in-browser SQLite WASM)
- No PST-01 / E0-B / new organ / new repository

## Layout

```
README.md
OWNER_TRACE.md
schema.sql
fixture.json
runner.py
tests/test_e0a.py
logs/          # test_run.txt, snapshots
e0a.sqlite3    # generated after tests (inspectable)
RESULTS.md
```

## Run

```bash
cd experiments/memory-governance-e0a
python3 tests/test_e0a.py
```

## Tests (only)

| # | Claim |
|---|-------|
| 1 | MODEL_PROPOSAL ≠ USER_DECISION |
| 2 | no silent erasure |
| 5 | rejected branch remains retrievable |
| 11 | unsupported model claim does not enter authoritative state |
| 12 | resume recovers goal/state/rationale/open loop/next action |

## Transition law (deterministic)

- **MODEL_PROPOSAL** → store event; non-ACTIVE PROPOSED state; never ACTIVE alone; re-assert without USER_DECISION → REJECTED vs current ACTIVE
- **USER_DECISION** → ACTIVE; prior proposals REJECTED via relation; never delete rows
- **RESEARCH_CLAIM** → HELD/observed; not authoritative ACTIVE
- **resume** → goal, ACTIVE state, rationale, rejected Graphiti branch, open authorization question, next action

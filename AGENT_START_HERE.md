# Start Here — Eiti-Wizard-Lab

Any new agent connected to this repository should start here.

1. Read this file.
2. Read [docs/research/EXPERIMENT_EVIDENCE_INDEX.md](docs/research/EXPERIMENT_EVIDENCE_INDEX.md).
3. Inspect `experiments/ruslan-experimental-memory/` only when the task explicitly authorizes that separate memory-continuity scope. As of 2026-10-06, that folder exists only on [OPEN/DRAFT PR #28](https://github.com/velantrian/Eiti-Wizard-Lab/pull/28) at head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`; it is not on `main`.
4. Identify the relevant experiment line, follow its references to primary evidence, and verify important claims at the exact source.
5. For Drive reconciliation, use index sections B and C.1. Keep owner-verified accessibility separate from local content review; D03 is unresolved and the similar D06 ID is a distinct source, not a substitute.

**Keep the layers separate:** Ruslan Experimental Memory answers “Where did we stop, and what should the next session continue?” The Experiment Evidence Index answers “What has already been tested, what was observed, what remains open, and where is the evidence?” `MEMORY_CONTINUITY != RESEARCH_EVIDENCE_INDEX`.

- DO NOT assume every Registry claim is primary evidence.
- DO NOT repeat experiments already closed unless a new question requires it and the task authorizes that work.
- DO NOT promote `MODEL_SUMMARY` into `OWNER_ASSERTED`.
- DO NOT silently convert `UNKNOWN` into `FALSE` or `MATCH`.
- DO NOT treat research summaries or model output as Canon.
- DO NOT edit other PRs or branches as part of a gateway reconciliation; preserve the requested PR's state unless explicitly instructed otherwise.

## Runtime navigation — two planes (Working Memory read bridge v0.1, Gate B1)

```
DEFAULT_RUNTIME_MODE        = WORKING
WORKING_STATE_SOURCE        = Working Memory wm_*  (working-memory.js, NON_CANON)
RESEARCH_NAVIGATION_SOURCE  = docs/research/EXPERIMENT_EVIDENCE_INDEX.md
WORKING_MEMORY != RESEARCH_INDEX
RESEARCH_INDEX != RUNTIME_AUTHORITY
RESEARCH_RESULT != USER_DECISION
```

Fresh-agent sequence:

1. Read this file.
2. Initialize/query `wm_orientation` (bounded; archived excluded; research not loaded).
3. Continue the user's operational Working state from it (`wm_list`, `wm_get`, `wm_search`, `wm_related`, `wm_project_sources`).
4. Enter the Research Plane only when the user/task requires research (`research_route` with `card` or `query`, or the index directly). Its fields are verbatim index text; read the whole `STATUS` / `EXECUTION_VERDICT`, never a single token from it.
5. For research claims: Research Index → primary evidence.
6. Never promote research into Working state automatically (B1 has no agent write path at all).
7. Never treat a model summary as an owner decision or as evidence.

Routing: "where did we stop / what is in progress / blocked / next step" → Working Memory. "What experiments / what did TCE show / what is NOT_RUN / where is the evidence" → Research Plane. Mixed question → two labeled sections, `WORKING:` and `RESEARCH:`, never one merged state. A research candidate (e.g. `JST-CAUSAL-01` CANDIDATE / NOT_RUN) is not a working decision; a working `HYPOTHESIS` is not a research result. See `docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md`.

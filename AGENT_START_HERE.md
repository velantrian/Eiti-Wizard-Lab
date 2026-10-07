# Start Here — Eiti-Wizard-Lab

Any new agent connected to this repository should start here.

## Which agent are you?

- **In-app agent** — runs inside the Eiti Wizard PWA tool loop. It has the runtime tools `wm_orientation`, `wm_list`, `wm_get`, `wm_search`, `wm_related`, `wm_project_sources`, `wm_list_projects` and `research_route`. Working Memory is the user's browser database (`wm_*` tables in IndexedDB).
- **Repository agent** — Claude Code, Codex, a code reviewer, or anything that reads and edits this repository outside the PWA. It has **no** `wm_*` / `research_route` tools and **no** access to the user's browser Working Memory. Do not try to call those tools and do not invent working state: the task you were given is your working context.

## Canonical start sequence (one sequence for every agent)

1. Read this file.
2. Obtain the Working orientation **when runtime Working Memory is available**. In-app agent: call `wm_orientation` (default mode WORKING; bounded; archived excluded; research is not loaded). Repository agent: runtime Working Memory is not available to you, so take the working context from the task and the repository documents it names.
3. Continue the user's operational Working state (in-app: `wm_list`, `wm_get`, `wm_search`, `wm_related`, `wm_project_sources`; repository: the task).
4. Enter the Research Plane **only when the task requires research**. In-app agent: `research_route` (`card` = research card number, or `query`). Repository agent: read [docs/research/EXPERIMENT_EVIDENCE_INDEX.md](docs/research/EXPERIMENT_EVIDENCE_INDEX.md).
5. Verify research claims at primary evidence: identify the relevant experiment line, read its whole `STATUS` / `EXECUTION_VERDICT` together with the card's caveats (`CONSISTENCY`, `NOTES`, `LAST_VERIFIED`) — never a single token — then follow its references to the primary evidence and verify important claims at the exact source. If `research_route` returns `index_loaded: false`, research navigation is unavailable (fail-closed; `PARTIAL_INDEX_ACCEPTANCE = NOT_ALLOWED_IN_B1`): say so and do not answer research questions from memory.
6. Never promote research into Working state automatically (B1 has no agent write path at all), and never treat a model summary as an owner decision or as evidence.

Repository notes that apply to step 4–5 work:

- Inspect `experiments/ruslan-experimental-memory/` only when the task explicitly authorizes that separate memory-continuity scope. As of 2026-10-06, that folder exists only on [OPEN/DRAFT PR #28](https://github.com/velantrian/Eiti-Wizard-Lab/pull/28) at head `ec1a3b665cc0da29a7e10773a142aca45bda31b2`; it is not on `main`.
- For Drive reconciliation, use index sections B and C.1. Keep owner-verified accessibility separate from local content review; D03 is unresolved and the similar D06 ID is a distinct source, not a substitute.

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

Routing: "where did we stop / what is in progress / blocked / next step" → Working Memory. "What experiments / what did TCE show / what is NOT_RUN / where is the evidence" → Research Plane. Mixed question → two labeled sections, `WORKING:` and `RESEARCH:`, never one merged state. A research candidate (e.g. `JST-CAUSAL-01` CANDIDATE / NOT_RUN) is not a working decision; a working `HYPOTHESIS` is not a research result. See `docs/working-memory/WORKING_MEMORY_B1_AGENT_READ_BRIDGE.md`.

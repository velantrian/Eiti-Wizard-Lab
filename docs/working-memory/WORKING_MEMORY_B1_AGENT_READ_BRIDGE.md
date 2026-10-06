# Working Memory — Gate B1: Agent Read Bridge + Working/Research Separation

STATUS: `NON_CANON` · READ-ONLY from the agent perspective · baseline `72c5f7f06a254798accb2ccde77801cbb7b82aef` (Gate A).

## Two planes

| | Working Plane | Research Plane |
|---|---|---|
| Source | Working Memory `wm_*` | `docs/research/EXPERIMENT_EVIDENCE_INDEX.md` |
| Answers | where we stopped, what is open/blocked, next action, working sources | what was researched/observed, NOT_RUN, BLOCKED, candidates, evidence pointers |
| Authority | operational, NON_CANON | `RESEARCH_INDEX_ONLY CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO` |

`WORKING_STATE != RESEARCH_STATE`, `RESEARCH_RESULT != USER_DECISION`, `EXPERIMENT_PASS != WORKING_DECISION`, `MODEL_PROPOSAL != USER_DECISION`, `UNKNOWN != FALSE`, `NOT_RUN != FAIL`, `BLOCKED != FAIL`.

## Surface (all read-only)

- `wm-agent-read.js` — provider-neutral. Tools: `wm_orientation`, `wm_list_projects`, `wm_list`, `wm_get`, `wm_search`, `wm_related`, `wm_project_sources`, `research_route`; `routeIntent()` (deterministic keyword routing) and `GUIDANCE`.
- `working-memory.js` — only additive read accessors: `listProjects`, `listSources`, `listItemSources`, `listRelations`, and `type`/`priority`/`thread` filters in `listItems`. No schema change.
- `research-router.js` — parses the card fields of index §C verbatim and returns pointers (line, verbatim STATUS / EXECUTION_VERDICT / OPEN_FINDING / PRIMARY_EVIDENCE, index pointer). Absent field = `null`. Never rewrites or promotes a status.
- `index.html` — registers the tools in `AGENT_TOOLS_SPEC`, dispatches them, and appends `GUIDANCE` to the agent-loop system prompt.

`wm_orientation` returns `mode: "WORKING"`, `current`, `in_progress`, `open`, `blocked`, `unknown`, `next_actions`, `recent_completed`, `source_pointers`, and `research: { available: true, loaded: false, entrypoint }`, bounded (default 5 / max 10 per bucket, with totals and truncation flags). Unresolved is exactly `OPEN / IN_PROGRESS / BLOCKED / UNKNOWN`; `CURRENT` is not unresolved; `RESOLVED != COMPLETED`; archived excluded.

## Limits

- `MULTI_TAB_WRITES = NOT_SUPPORTED_IN_V0_1` (unchanged; B1 does no writes).
- `research_route` parses the current Markdown card layout; if the layout changes it degrades to `null` fields / pointer-only, never to invented claims. In the browser it needs the index to be fetchable over HTTP; otherwise it returns the entrypoint only (`index_loaded:false`).
- No agent write path, approval flow, capture, or promotion (Gate B2 scope, not implemented).
- `FRESH_MODEL_BEHAVIOR = NOT_RUN`, `CROSS_PROVIDER_RESUME = NOT_RUN` (no real model invocation performed).

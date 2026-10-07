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

- `wm-agent-read.js` — provider-neutral. Tools: `wm_orientation`, `wm_list_projects`, `wm_list`, `wm_get`, `wm_search`, `wm_related`, `wm_project_sources`, `research_route`; agent `GUIDANCE`. `routeIntent()` is **diagnostic only** (not called at runtime, not acceptance evidence); routing authority in B1 = tool descriptions + `GUIDANCE` + explicit `plane` labels on every result.
- `working-memory.js` — only additive read accessors: `listProjects`, `listSources`, `listItemSources`, `listRelations`, `type`/`priority`/`thread` filters in `listItems`, and an optional `project_id` scope in `searchItems` that is applied **before** ranking and LIMIT. No schema change.
- `research-router.js` — **independent of Working Memory.** Parses the card fields of index §C and returns them **verbatim** as pointers (`card_number`, `heading`, `STATUS`, `EXECUTION_VERDICT`, `OPEN_FINDING`, `PRIMARY_EVIDENCE`, …). No verdict/status is derived or normalised from prose (there is no `execution_verdict_token`). Absent field = `null`. `card` = research CARD number, **not** a file line (`line` is accepted only as an alias). `card` + `query` together is a `VALIDATION` error. `query` is a case-insensitive substring match (every whitespace-separated term must occur) over title, name, QUESTION, STATUS, EXECUTION_VERDICT, OPEN_FINDING and PRIMARY_EVIDENCE — navigation over the current index, not an exhaustive scientific search. Minimal card contract: a recognised `### N. title` heading is a valid card only if `STATUS`, `EXECUTION_VERDICT` and `PRIMARY_EVIDENCE` are present and non-empty (other fields are optional and `null` when absent). A body that is not the Evidence Index, a zero-card parse, any malformed card, or a failed fetch returns `index_loaded:false` + `parse_status` (`NOT_AN_EVIDENCE_INDEX` / `NO_CARDS_PARSED` / `MALFORMED_CARDS` / `INDEX_UNAVAILABLE` / `FETCH_FAILED`) and the entrypoint only; `MALFORMED_CARDS` also lists the offending `card_number`s and their missing fields, and no card is served from that index. `index_source` is `NETWORK`, `OFFLINE_CACHE` or `UNKNOWN`.
- `index.html` — registers the tools in `AGENT_TOOLS_SPEC` and dispatches them. `research_route` never touches SQLite/`WmStore`; if Working Memory is unavailable (or its cached script is stale) the `wm_*` tools return `WORKING_MEMORY_UNAVAILABLE` while `research_route` keeps working. `GUIDANCE` is appended to the agent-loop system prompt.
- `sw.js` — `CACHE_NAME` bumped (`…-wm1`); install precaches with `cache:'reload'` (bypasses the HTTP cache so a bump cannot precache stale scripts); the exact path `docs/research/EXPERIMENT_EVIDENCE_INDEX.md` is network-first with a cache fallback marked `X-Eiti-Served-From: sw-offline-cache` (not precached, not runtime authority); everything else is unchanged.

`wm_orientation` returns `mode: "WORKING"`, `current`, `in_progress`, `open`, `blocked`, `unknown`, `next_actions`, `recent_completed` (updated_at DESC, never priority-first), `source_pointers: { items, total, truncated, omitted_project_ids, … }` (PRIMARY before NAVIGATION, per-project cap 3, total cap 15, `project_id` kept), and `research: { available: true, loaded: false, entrypoint }`, bounded (default 5 / max 10 per bucket, with totals and truncation flags). Unresolved is exactly `OPEN / IN_PROGRESS / BLOCKED / UNKNOWN`; `CURRENT` is not unresolved; `RESOLVED != COMPLETED`; archived excluded.

Agent-facing text is capped (title 200, summary 500, current_question/status_note/next_action 300, `body_md` in `wm_get` 4000); clipped fields are listed in `truncated_fields` (and `body_md_total_chars`). The database is never changed and source locators are never clipped.

## Limits

- `MULTI_TAB_WRITES = NOT_SUPPORTED_IN_V0_1` (unchanged; B1 does no writes).
- `research_route` parses the current Markdown card layout; if the layout changes it degrades to pointer-only (`index_loaded:false`), never to invented claims. The index is fetched over HTTP; it is not precached, so offline fallback exists only after one online fetch.
- During the first reload after an upgrade the old service worker may still serve a cached `working-memory.js`; the `wm_*` tools then report `WORKING_MEMORY_UNAVAILABLE` (stale script) until the new service worker has taken over and the page is reloaded.
- No agent write path, approval flow, capture, or promotion (Gate B2 scope, not implemented).
- B1 enforces **data/tool-plane** separation only (every tool result carries its `plane`; research and working data are never merged by the tools). The `WORKING:` / `RESEARCH:` labelling of a model's final free-text answer is guidance, not runtime-enforced: `FINAL_MODEL_MIXED_ANSWER_ENFORCEMENT = NOT_IMPLEMENTED`. It is to be validated in a separate fresh-model validation gate.
- `FRESH_MODEL_BEHAVIOR = NOT_RUN`, `CROSS_PROVIDER_RESUME = NOT_RUN` (no real model invocation performed).

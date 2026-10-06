# Working Memory MVP v0.1 — Gate A implementation record

**Branch:** `feat/working-memory-mvp-v0.1`
**Base SHA:** `c3e40b74fa9a2c2f029351ce33dd9ed655e1a31d`
**HEAD:** recorded as the final commit SHA in the Draft PR and completion record.
**Scope:** core data and persistence only; no UI, agent write tools, or user-data import.

## Data contract

Working Memory lives only in the additive `wm_*` namespace in the existing SQL.js database. The schema creates `wm_projects`, `wm_sources`, `wm_items`, `wm_item_sources`, `wm_relations`, `wm_changes`, and the derived FTS5 table `wm_items_fts`. It does not change Canon, the ledger, `wiz_ref_*`, Continuity Carrier, Experiment Registry, PR #28, or PR #30.

`wm_items` includes every requested field: `work_id`, `project_id`, `thread`, `type`, `status`, `priority`, `title`, `summary`, `body_md`, `current_question`, `status_note`, `next_action`, `provenance_class`, `tags_json`, `non_canon`, `created_at`, `updated_at`, `resolved_at`, and `archived_at`. SQLite and the module both enforce `non_canon = 1`. A blocked item needs a nonblank `status_note`; a resolved item needs a nonblank `status_note` and `resolved_at`. Items are not hard-deleted: `SUPERSEDED` retains the row, and archive sets `archived_at`.

The supporting columns are `wm_projects(project_id, name, description, created_at, updated_at)`, `wm_sources(source_id, title, source_type, locator, project_id, provenance_class, metadata_json, created_at, updated_at)`, `wm_item_sources(work_id, source_id, is_primary)`, `wm_relations(relation_id, from_work_id, to_work_id, relation_type, created_at)`, and `wm_changes(change_id, work_id, change_type, before_json, after_json, created_at)`. The derived FTS5 table indexes `work_id` (unindexed), `title`, `summary`, `body_md`, and `tags_json`.

The Gate A request did not enumerate item, status, priority, or provenance enums, so this implementation uses and exports these explicit values:

- `type`: `DECISION`, `QUESTION`, `TASK`, `NOTE`, `RISK`, `BLOCKER`, `INSIGHT`, `RESEARCH`
- `status`: `OPEN`, `IN_PROGRESS`, `BLOCKED`, `RESOLVED`, `SUPERSEDED`
- `priority`: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- `provenance_class`: `USER_STATED`, `SOURCE_DERIVED`, `AGENT_DERIVED`, `MIXED`, `UNKNOWN`
- relation types: `RELATED_TO`, `BLOCKED_BY`, `DEPENDS_ON`, `DERIVED_FROM`, `SUPERSEDES`

Relations require existing endpoints and reject self-relations. The module records only explicit edges; it does not infer graph relationships. Item-source links permit at most one primary source per item.

## Search and interchange

Search is deterministic and applies the requested precedence: exact work ID, exact title, title contains, exact tag, summary contains, then body contains. Ties are ordered by title and then `work_id`; the default limit is 20 and the maximum is 100. FTS5 is maintained as a derived index, while ranking uses explicit comparisons rather than relevance scores.

Export produces one JSON document in format `eiti-working-memory-export/1` with `projects`, `sources`, `items`, `item_sources`, `relations`, and `changes`. Import inserts new IDs, treats equivalent same-ID records as no-ops, and rejects different same-ID records as `IMPORT_CONFLICT`; imports are atomic and never overwrite a conflict.

## Persistence and limits

All module mutations are queued within the current page, executed in a SQLite transaction, committed, then persisted by awaiting `_wizSaveDBAsync()`. That existing routine writes the SQLite byte snapshot into IndexedDB and verifies read-back. A mutation is only returned as saved after it receives `verified: true`. On persistence failure, the module restores the prior WM namespace and tries to durably save that rollback; if it cannot verify restoration, it blocks further writes in that store instance until reload.

**`MULTI_TAB_WRITES = NOT_SUPPORTED_IN_V0_1`.** The app stores a whole SQLite snapshot in IndexedDB and has no cross-tab write coordinator. WM writes are serialized within one page only; simultaneous writes from multiple tabs are unsupported, and this gate does not add a coordination system. Use one app tab for WM writes.

No agent write tools, visible UI, bulk user-data import, or changes to other memory paths are included. This is the data/persistence gate only.

## Verification

- `node tests/working-memory/db.test.cjs` — SQL.js/WASM acceptance suite for schema idempotency, required fields, enum and lifecycle validation, sources/projects/items, IDs, links, relations, tags/search ranking and limits, unresolved/resolved lists, append-only changes, rollback, durable byte reload, versioned export/import, and conflict handling.
- `PUPPETEER_CORE=/path/to/puppeteer-core CHROME_PATH=/usr/bin/chromium node tests/working-memory/browser.test.mjs` — real browser and IndexedDB save/read-back/reload integration test.
- Existing reference-memory tests remain an independent regression check; their namespace and semantics are unchanged.

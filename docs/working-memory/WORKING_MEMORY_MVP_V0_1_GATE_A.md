# Working Memory MVP v0.1 — corrected contract

**Branch:** `feat/working-memory-mvp-v0.1` · **Base:** `c3e40b74fa9a2c2f029351ce33dd9ed655e1a31d` · **Reviewed starting HEAD:** `4983b81c6bc353e6760ace22edd792cf73524f4d`
**Scope:** isolated data and persistence layer only. No UI, agent write tools, real user data, FalkorDB, Canon integration, or `wiz_ref` changes.

## Data contract

Working Memory uses only the additive `wm_*` namespace in the existing SQL.js database. The tables are `wm_projects`, `wm_sources`, `wm_items`, `wm_item_sources`, `wm_relations`, `wm_changes`, and the derived FTS5 index `wm_items_fts`.

A project contains `project_id`, unique `code`, `name`, `summary`, `created_at`, and `updated_at`. Codes are normalized to uppercase alphanumeric characters with optional internal hyphens so they can be embedded safely in a WORK_ID. The optional `default_thread` field is not implemented.

A source contains `source_id`, required `project_id`, `surface`, `role`, `title`, `locator`, `revision`, `note`, `created_at`, and `updated_at`. Its `project_id` must reference an existing project. `surface` is exactly `GITHUB`, `NOTION`, `DRIVE`, `LOCAL`, `WEB`, `CHAT`, or `OTHER`; `role` is exactly `PRIMARY`, `EVIDENCE`, `CONTEXT`, `NAVIGATION`, or `REFERENCE`. A registered source must have a non-empty locator. These fields answer **where to look**; source navigation is not replaced by item provenance.

A work item includes `work_id`, required and immutable `project_id`, `thread`, `type`, `status`, `priority`, `title`, `summary`, `body_md`, `current_question`, `status_note`, `next_action`, `provenance_class`, `tags_json`, `non_canon`, `created_at`, `updated_at`, `resolved_at`, and `archived_at`. An absent thread is stored and exported as `""`, not null. Optional summary/body text remains compatible with Quick Capture and is normalized as null or text in exports. `project_id` immutability is enforced by the API and SQLite; `non_canon = 1` is also enforced by both.

The enums are exactly:

- `type`: `NOTE`, `QUOTE`, `VALUE`, `QUESTION`, `HYPOTHESIS`, `DECISION`, `MODEL_PROPOSAL`, `DONOR_CANDIDATE`, `EXPERIMENT`, `FINDING`, `SYSTEM`, `TASK`, `SOURCE_POINTER`.
- `status`: `CURRENT`, `OPEN`, `IN_PROGRESS`, `BLOCKED`, `UNKNOWN`, `RESOLVED`, `COMPLETED`, `REJECTED`, `SUPERSEDED`.
- `priority`: `P0`, `P1`, `P2`, `P3`, `TAIL`.
- `provenance_class`: `USER_NOTE`, `USER_DECISION`, `USER_QUOTE`, `MODEL_PROPOSAL`, `MODEL_SUMMARY`, `PROJECT_SOURCE`, `EXTERNAL_SOURCE`, `EXPERIMENT_RESULT`.

`MODEL_SUMMARY` and `MODEL_PROPOSAL` remain distinct from `USER_DECISION`. Item provenance does not stand in for a source's surface or role.

## IDs, lifecycle, and history

New items receive an automatic ID of the form `WRK-<PROJECT_CODE>-<YYYYMMDD>-<NNN>`, with the date in UTC; for example `WRK-EITI-20261006-001`. Generation runs inside the serialized SQLite mutation transaction, finds the next unused daily sequence for that project's code, and cannot be overridden through item creation or update. Because items cannot be hard-deleted, a generated ID is not reused. Same-page writes are serialized; `MULTI_TAB_WRITES = NOT_SUPPORTED_IN_V0_1` remains explicit.

The `UNRESOLVED` view contains exactly `OPEN`, `IN_PROGRESS`, `BLOCKED`, and `UNKNOWN`; `CURRENT` is excluded. The `RESOLVED` view contains only `RESOLVED`, and the `COMPLETED` view contains only `COMPLETED`. `COMPLETED` is not an alias for `RESOLVED`. `BLOCKED` requires `status_note`; `RESOLVED` requires `status_note` and `resolved_at`; `REJECTED` requires a reason in `status_note`. `SUPERSEDED` preserves the old item. Archiving sets `archived_at` without deleting the item or changing its status.

The change log is append-only. Each row retains `actor_class` and normalized `changed_fields_json`, with before/after JSON where useful. The store-level actor defaults to `SYSTEM` and can be configured; callers may specify an actor for an explicit appended change. This is a compact audit log, not full event sourcing.

## Search and interchange

Search uses deterministic precedence: exact WORK_ID, exact title, title contains, tag, summary, then body. Ties sort by title and WORK_ID; there is no LLM ranking. The default result limit is 20 and the maximum is 100.

JSON interchange remains `eiti-working-memory-export/1` and contains the six arrays `projects`, `sources`, `items`, `item_sources`, `relations`, and `changes`. Import validates the corrected schema and enum values, checks item IDs against project codes, and is atomic. Existing identical IDs are no-ops; conflicting same IDs fail closed with no silent overwrite. Summary/body and thread values are normalized consistently in exported records.

The existing durable-write design remains: mutations are serialized for the current page, applied in a SQLite transaction, followed by awaited IndexedDB persistence and read-back verification. On persistence failure, the WM namespace is restored; uncertain restoration blocks later writes until reload.

## Verification

- `node tests/working-memory/db.test.cjs` — schema, all corrected enums, work IDs, uniqueness, required project/source fields, lifecycle views, append-only actor history, search precedence, corrected export/import, fail-closed conflicts, transaction rollback, durability/reload, and forbidden-namespace checks.
- `PUPPETEER_CORE=/path/to/puppeteer-core CHROME_PATH=/usr/bin/chromium node tests/working-memory/browser.test.mjs` — real browser/IndexedDB durability and reload test using synthetic fixtures.
- Existing reference-memory DB and browser suites remain regression checks; they exercise the unchanged `wiz_ref_*` namespace.

Earlier draft Gate-A `wm_*` tables are not automatically migrated. Startup detects incompatible table columns and raises `WM_SCHEMA_MISMATCH` rather than silently running against the old contract. No old Working Memory records are rewritten or discarded by this change.

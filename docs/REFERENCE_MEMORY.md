# Reference memory (`wiz_ref_*`) — lab/sqlite-reference-memory

A **separate reference-knowledge namespace** inside the existing SQLite WASM memory of Eiti Wizard Lab.
It stores *source-bound* items (project roles/boundaries, invariants, implementation observations,
architecture positions, research results, hypotheses, open questions, routes, human vocabulary lenses,
historical notes …) **with their source, status, scope, time and provenance** — so retrieval does not
erase the distinctions between kinds of knowledge.

It is **not** a truth database, **not** Canon, **not** a new memory project, and **not** personal memory.

> **PRIVATE_CORPUS_STATUS = NOT_BUILT / SOURCE_ACCESS_REQUIRED.**
> This branch ships schema, importer, retrieval, tools, a public demo seed, a placeholder-only template
> and tests. No private corpus was built or read. A private import is a separate, later, bounded step
> that must be done from the actual sources (not from handoff descriptions).

## 1. Where it lives

| Thing | Location |
|---|---|
| Code | `wiz-ref-memory.js` (loaded by `index.html` right after `sql-wasm.js`) |
| Database | the same `window._wizDB` created by `wizInitSQLite()` |
| Persistence | same IndexedDB store `wiz_lab_mem_store` / key `wiz_lab_sqlite_db`, two write paths: **personal/legacy writes** use the unchanged fire-and-forget `_wizSaveDB()`; **reference-critical operations** (ref import, clear, backup restore) use the awaitable, verified `_wizSaveDBAsync()` (see §4b) |
| Schema hook | one guarded line in `_wizInitMemSchema()` calling `WizRef.initSchema(db)` |
| UI | Memory panel → card “📖 Reference memory (wiz_ref)”: Import JSONL · Export backup · Clear reference · search |
| Agent tools | `ref_search`, `ref_source`, `ref_project`, `ref_trace` (read-only; registered **alongside** `mem_*`) |

Personal memory (`wiz_facts`, `wiz_facts_fts`, `wiz_l2_digests`, `wiz_notes_fts`, `wizMem*`,
`wizConsolidateL2`, `wizDecayTick`, `mem_*` tools) is **unchanged**. Reference items:

* are never written to `wiz_facts`;
* never decay (`wizDecayTick()` only reads/updates `wiz_facts`; tested);
* can never become `Validated` through `mem_validate` (it only calls `wizMemSetState` → `UPDATE wiz_facts`; tested);
* are never injected into the chat context automatically — retrieval is explicit only.

## 2. Schema (schema_version 3)

```sql
wiz_ref_sources(source_id PK, title NOT NULL, surface NOT NULL, source_kind NOT NULL, authority_class,
                project_id, locator, revision, as_of, currentness, privacy DEFAULT 'private', content_hash,
                seed_id, first_seed_version, last_seed_version, record_hash, imported_at)
wiz_ref_items(item_id PK, source_id NOT NULL → wiz_ref_sources, project_id, item_type NOT NULL, claim NOT NULL,
              source_section, source_status, epistemic_state, authority_scope, validity, confidence, as_of,
              supersedes_item_id, created_at, provenance, lifecycle DEFAULT 'ACTIVE', superseded_by,
              record_hash, seed_id, first_seed_version, last_seed_version,
              -- v2: capture provenance (snapshot of the source record when this item content was captured)
              source_title_at_capture, source_surface_at_capture, source_kind_at_capture,
              source_authority_class_at_capture, source_revision_at_capture, source_as_of_at_capture,
              source_currentness_at_capture, source_content_hash_at_capture, capture_backfilled DEFAULT 0,
              -- v3: immutable item versions
              logical_item_id, version_id)          -- version_id = '<logical_item_id>@<record_hash>'
wiz_ref_relations(relation_id PK, from_item_id NOT NULL, to_item_id NOT NULL, relation_type NOT NULL,
                  epistemic_status NOT NULL, source_id, scope, rationale, seed_id, created_at,
                  record_hash,                          -- v2
                  from_version_id, to_version_id,       -- v3: endpoints pinned to immutable item versions
                  pin_backfilled DEFAULT 0)             -- v3: 1 = pin set by the v2→v3 migration
wiz_ref_items_fts USING fts5(item_id UNINDEXED, claim, project_id, item_type, tokenize='unicode61')
wiz_ref_meta(key PK, value)   -- schema_version, seed_id, seed_version, seed_as_of, seed_hash,
                              -- seed.<seed_id> (JSON), last_import_at
```

Optional `wiz_ref_chunks` is **not** implemented in this milestone.

Vocabularies (validated by the importer):

* `surface`: github · notion · drive · book · upload · demo · fixture · local
* `source_kind`: IMPLEMENTATION · ARCHITECTURE · RESEARCH · HANDOFF · NAVIGATION · HUMAN_REFERENCE · HISTORICAL_CHRONICLE · VALIDATION · BOOK_DONOR
* `authority_class`: IMPLEMENTATION_EVIDENCE · ARCHITECTURE_STATUS · RESEARCH_SYNTHESIS · NAVIGATION_ONLY · HUMAN_REFERENCE_ONLY · HISTORICAL_ONLY · VALIDATION_EVIDENCE · RESEARCH_DONOR · DEMO_ONLY
* `currentness`: CURRENT · DRAFT · RESEARCH · HISTORICAL · SUPERSEDED · UNKNOWN (non-standard values kept verbatim with a warning)
* `item_type`: PROJECT_ROLE · PROJECT_BOUNDARY · INVARIANT · IMPLEMENTATION_FACT · ARCHITECTURE_POSITION · RESEARCH_RESULT · HYPOTHESIS · OPEN_QUESTION · NEXT_ACTION · DECISION · REJECTED_BRANCH · HISTORICAL_NOTE · VALIDATION_RESULT · ROUTE · HUMAN_LENS · DONOR · UNKNOWN
* `relation_type`: OWNS · ROUTES_TO · DERIVED_FROM · SUPERSEDES · CONTRADICTS · SUPPORTS · COUNTEREVIDENCE · RELATED_TO · TESTED_BY · IMPLEMENTED_IN · DOCUMENTED_IN

### Migration

`WizRef.initSchema(db)` runs on every boot (from `_wizInitMemSchema`). It uses `CREATE … IF NOT EXISTS`,
adds any missing columns to pre-existing `wiz_ref_*` tables with `ALTER TABLE … ADD COLUMN` (additive only),
and writes `schema_version` into `wiz_ref_meta` if absent. It never touches personal-memory tables.
Running it any number of times on an existing DB is a no-op (tested).

v1 → v2 (audit revision 1): adds the `*_at_capture` columns and `capture_backfilled` on items and
`record_hash` on relations. Existing items are **backfilled** with the source record as it is at migration
time and marked `capture_backfilled=1` (retrieval shows “CAPTURE PROVENANCE BACKFILLED”); existing relations
get their `record_hash`; items missing from the FTS index are indexed; `migrated_from_schema_1` is recorded in
`wiz_ref_meta`.

v2 → v3 (audit revision 2): adds `logical_item_id`, `version_id` on items and `from_version_id`,
`to_version_id`, `pin_backfilled` on relations (+ indexes). Deterministic backfill:

* archived rows (`item_id` matching `<logical>@<14 hex>` and `lifecycle='SUPERSEDED'`) get
  `logical_item_id=<logical>`, `version_id=item_id`;
* every other row gets `logical_item_id=item_id`, `version_id=item_id@record_hash` (hash computed if missing);
* every relation without pins is pinned to the `version_id` of the row whose `item_id` equals its
  `from_item_id` / `to_item_id` **at migration time**, and marked `pin_backfilled=1` (a v2 DB had no
  version history for relations, so "the version current at migration time" is the only deterministic
  choice — this is documented as backfilled, not as original). An endpoint that cannot be resolved stays
  `NULL` (reported by `trace` as *unpinned*, by `resolveRelation` as `unresolved`);
* `migrated_from_schema_2` in `wiz_ref_meta` records `items_versioned` and `relations_pinned`.
  Re-running `initSchema` is a no-op (tested). A v1 DB migrates v1→v2→v3 in one boot.

### Item versions and relation pins (audit revision 2)

**Chosen model: RELATIONS POINT TO IMMUTABLE ITEM VERSIONS.**
ITEM VERSION CHANGED ≠ RELATION TARGET VERSION CHANGED; ITEM REVISION ≠ RETROACTIVE RELATION REBINDING.

* A logical item `X` has versions `X@<hash1>`, `X@<hash2>`, … (`version_id = <logical_item_id>@<record_hash>`,
  a 14-hex content hash). A version is immutable: its content never changes.
* The **current** version lives in the row `item_id = X` (the logical id is the current-item pointer).
  When `X` is revised (same `item_id`, different content) the old row is copied to an **archived row**
  `item_id = version_id = X@<old_hash>` (SUPERSEDED, `superseded_by = X`, own capture provenance), and the
  row `X` gets the new content and the new `version_id`.
* Relations store `from_version_id` / `to_version_id`, fixed when the relation is first stored.
  `from_item_id` / `to_item_id` stay as human-readable labels; **the pins decide what a relation refers to**.
  A relation created before a revision keeps pointing to the old version; a new relation to `X` points to
  the version current when it is imported. Nothing is ever re-pinned automatically.
* `WizRef.resolveRelation(db, relation_id)` returns both endpoints as
  `{version_id, logical_item_id, row_item_id, claim, lifecycle, is_current_version}` (or `{unresolved:true}`).
* Retrieval blocks show `version: X@… (current)` or `version: X@… (archived version of X)`.

**How an import bundle expresses a relation endpoint:**

1. `from_item_id` / `to_item_id` = a **logical id** `X` → resolves to the version of `X` that is current
   *after this bundle's items are applied* (if the same bundle revises `X`, that is the new version).
2. `from_item_id` / `to_item_id` = an **archived id** `X@<hash>` → exactly that version.
3. Optional **explicit** `from_version_id` / `to_version_id` → exactly that version; it must exist in the DB
   or be produced by the same bundle, otherwise the bundle is rejected ("not a known item version").
   Exports always write explicit pins, so backup/restore round-trips preserve them (tested).
4. An existing `relation_id` re-imported with the same content → *unchanged*, **keeps its original pins**
   (it is not rebound to the now-current version). Different content → rejected (as in revision 1);
   different explicit pins → rejected ("re-pinning is rejected; use a new relation_id").
5. An item record carrying a `version_id` that does not match its content is rejected.

**trace semantics:** `trace(db, X)` traces the **current** version of `X`; `trace(db, 'X@<hash>')` (an
archived id or any `version_id`) traces **that** version. `relations.outgoing` / `relations.incoming` contain
only relations pinned to exactly that version; `relations.unpinned` lists relations whose pin is `NULL`
(unresolvable after migration). The result also carries `version_id`, `logical_item_id`,
`is_current_version`, `versions[]` (all versions of the logical item, archived first, current last) and
`lineage`.

Alternatives considered: rewriting old relations to the archived id at revision time was rejected — it is an
implicit mutation of existing relation records; pins make the binding explicit and leave relations immutable.

### Capture provenance (why option B)

`wiz_ref_sources` keeps **one row per `source_id` = the current source record**. Each item stores a snapshot of
the source identity it was captured from (`*_at_capture`). Retrieval uses the **capture** values as the item's
source identity (title, surface, kind, authority, revision, as_of, currentness, content hash) — also for
`is_implementation_evidence` and for the `authority_class` / `source_kind` / `surface` /
`implementation_evidence_only` filters — and shows the current source record separately
(`source_current_*`, “source (current record)” line) with a “SOURCE CHANGED SINCE CAPTURE” warning when they
differ. So a newer source revision can never retroactively re-date or promote an older item. An item re-asserted
with identical content keeps its original capture; a content change re-captures from the current record while the
previous version is archived (`<item_id>@<hash>`, SUPERSEDED) with its own capture provenance.
Option B was chosen over immutable `source_id@revision` rows (option A) because it is purely additive: `source_id`
stays a stable key for items, relations, filters and exports, and no primary-key semantics change.

## 3. Import format (`wiz-ref-jsonl/1`)

One JSON object per line:

```jsonc
{"manifest":{"format":"wiz-ref-jsonl/1","seed_id":"<SEED_ID>","seed_version":"<SEED_VERSION>","seed_as_of":"<YYYY-MM-DD>","privacy":"private"}}  // optional, first line
{"source":{…},"item":{…}}   // an item bound to its source (the source may repeat on every line)
{"source":{…}}              // a source without items
{"relation":{…}}            // an explicit relation
```

See `reference-memory/velantrim_reference.private.template.jsonl` (placeholders only) and
`reference-memory/eiti_reference.demo.public.jsonl` (public demo).

Importer rules:

0. **Two-phase, all-or-nothing.** Phase 1 parses, normalises and validates the *whole* bundle read-only
   (record validity, intra-bundle conflicts, relation endpoints, relation revisions against the DB). Only if
   phase 1 finds **zero errors** does phase 2 write everything in one transaction (ROLLBACK on exception).
   Invariant: `errors.length > 0 ⇒ committed === false` and the database is unchanged (tested with full
   table hashes).
1. **Idempotent.** Records are keyed by `source_id` / `item_id` / `relation_id`; identical content → *unchanged*.
   Importing the same bundle twice creates zero duplicates (tested).
2. **Statuses preserved verbatim.** `source_status`, `epistemic_state`, `currentness`, `validity` are stored
   exactly as given. A missing `epistemic_state` defaults to the weakest reading, `SOURCE_ASSERTION`.
   The importer **never qualifies**: it never sets QUALIFIED/VERIFIED/VALIDATED/CANON; if a record itself
   carries such a word it is kept verbatim as *that source's assertion* and a warning is emitted.
3. **Supersession without deletion.**
   * `supersedes_item_id` marks the older item `lifecycle='SUPERSEDED'`, `superseded_by=<new>` and adds a
     `SUPERSEDES` relation; the old row stays.
   * Same `item_id` with different content (new seed revision) → the previous version is kept as the
     immutable archived version `<item_id>@<old_record_hash>` with `lifecycle='SUPERSEDED'`, then the current
     row is updated. Relations pinned to the old version keep referring to it (see “Item versions and
     relation pins”).
   * Items missing from a new revision of the same seed are **not deleted**; they are counted
     (`not_in_this_seed`) and keep their `last_seed_version`.
   * An import can never move an item back from SUPERSEDED to ACTIVE.
4. **Seed bookkeeping.** `seed_version`, `seed_as_of`, `seed_hash` (SHA-256 of the file) and
   `seed.<seed_id>` are written to `wiz_ref_meta`.
5. **Guards.** `HUMAN_REFERENCE_ONLY` sources may only carry `HUMAN_LENS` items and `HUMAN_LENS` items require
   such a source; `BOOK_DONOR` sources must be `RESEARCH_DONOR`; unknown `item_type` / `source_kind` /
   `relation_type` are rejected. The whole import runs in one transaction.
6. **Relations.** `record_hash` covers relation_type, from/to, epistemic_status, source_id, scope, rationale.
   Same `relation_id` + same content → unchanged. Same `relation_id` + different content → **rejected**
   (validation error → nothing is written); a changed relation must use a new `relation_id`. Both endpoints
   must exist in the DB or in the same bundle; external/dangling references are rejected. Endpoints are
   pinned to item versions (rules in §2 “Item versions and relation pins”); the pins are not part of
   `record_hash`, but a re-import with different explicit pins is rejected.

## 4. Retrieval (explicit only)

| JS (browser globals, over `window._wizDB`) | Pure (`WizRef.*`, db-first) | Agent tool |
|---|---|---|
| `wizRefSearch(query, filters)` | `WizRef.search(db, query, filters)` | `ref_search` |
| `wizRefGetSource(sourceId)` | `WizRef.getSource(db, sourceId)` | `ref_source` |
| `wizRefProject(projectId)` | `WizRef.project(db, projectId)` | `ref_project` |
| `wizRefTrace(itemId)` | `WizRef.trace(db, itemId)` (logical id → current version; `X@hash` → that version) | `ref_trace` |
| — | `WizRef.resolveRelation(db, relationId)` (pinned endpoint versions + claims) | — |

Filters: `project_id`, `item_type`, `authority_class`, `source_kind`, `surface`, `source_id`,
`include_superseded` (default false), `implementation_evidence_only`, `limit`.

Every result carries: `claim, project_id, item_type, epistemic_state, source_status, authority_class,
source_kind, source_title, source_id, source_surface, as_of, source_revision, provenance, lifecycle` plus
computed flags `is_implementation_evidence` (only `surface=github` + `IMPLEMENTATION_EVIDENCE`),
`is_live_state=false`, `is_main_state=false`, `is_draft_or_branch`, `is_system_primitive=false`,
`is_verified_truth=false`, `caveats[]` and a text `block`, e.g.:

```
[REFERENCE MEMORY] demo-project-x / IMPLEMENTATION_FACT / OBSERVATION / source_status=OPEN · DRAFT / currentness=CURRENT
source (at capture): [SYNTHETIC FIXTURE] … (fx:src:github-soul; github/IMPLEMENTATION; authority=IMPLEMENTATION_EVIDENCE; rev=abc1234)
as_of: 2026-09-25 · scope: demo-project-x branch feat/relations (unmerged)
claim (source-bound, not verified truth): Fixture: PR #202 was OPEN/DRAFT at source snapshot.
⚠ CACHED STATE as-of 2026-09-25 — not live repo state; verify live on GitHub (IMPLEMENTED ≠ ACTIVATED)
⚠ DRAFT/BRANCH STATE — not a main-branch fact
```

`ref_search` never returns a bare claim. `mem_search` (personal) and `ref_search` (reference) query
different tables and return disjoint datasets.

## 4b. Persistence acknowledgement

Both paths write the same SQLite export into IndexedDB `wiz_lab_mem_store` / key `wiz_lab_sqlite_db`:

| Path | Used by | Guarantee |
|---|---|---|
| `_wizSaveDB()` — **unchanged** from `main` | normal / personal-memory legacy writes (`wizMem*`, decay, L2, …) | **fire-and-forget**: exports the DB, opens IndexedDB and `put`s; no completion signal, no read-back |
| `_wizSaveDBAsync()` — added in this PR | **reference-critical operations only**: ref import (`wizRefImportJSONL`), clear (`wizRefClearAll`), backup restore (importing an export) | **awaitable and verified**, see below |

`_wizSaveDBAsync()` resolves only after **all** of:

1. the IndexedDB `readwrite` transaction fired `oncomplete` (it rejects on `onerror` / `onabort` / `onblocked`);
2. an **exact byte read-back** in a new transaction: the stored bytes are byte-for-byte equal to the exported bytes;
3. **SHA-256 confirmation**: `SHA-256(exported) === SHA-256(read-back)` via `crypto.subtle`. If `crypto.subtle`
   is unavailable, byte equality alone is the confirmation (`method: 'byte-equality'`, `sha256: null`).

It resolves `{bytes, sha256, verified: true, method}`; any difference rejects with
`IndexedDB read-back mismatch (…)`. **Only then** does `wizRefImportJSONL()` return `persisted: true`, and the
UI shows `IMPORT_PERSISTED = TRUE — IndexedDB write confirmed (N bytes read back, byte-identical,
sha256 <hex>). The local file can be deleted now`, sets `data-persisted="true"` on `#wizRefResult` and
`window.WIZ_REF_IMPORT_PERSISTED = true`. In every other case (rejection, mismatch, no awaitable save) it shows
`⚠ IMPORT_PERSISTED = FALSE … KEEP your local file` and never says the file can be deleted. A same-length but
different read-back yields `IMPORT_PERSISTED = FALSE` (tested with a stubbed IndexedDB `get`). A rejected
(invalid) bundle writes nothing.

Residual risk (pre-existing in the fire-and-forget path, not changed here): `_wizSaveDB()` takes its export
**when it is called** and `put`s it later, after its own `indexedDB.open` succeeds. If a personal-memory save was
called **before** a reference import and its `readwrite` transaction only starts **after** the verified
`_wizSaveDBAsync()` write, it overwrites the stored bytes with that older export (without the new reference
rows), even though the UI already showed `IMPORT_PERSISTED = TRUE`. The ack confirms the stored bytes at ack
time only. Any later `_wizSaveDB()` call exports the current in-memory DB, which already contains the
reference rows, and so repairs the stored copy. The window is narrow (a pending `open` from an earlier
fire-and-forget save), but if in doubt keep the file or an `Export backup` until after a reload shows the rows.

## 4c. Service worker update strategy

`sw.js` caches `wiz-ref-memory.js` as a static asset (cache-first). **Any change to `wiz-ref-memory.js` (or
any other cached static asset) must bump `CACHE_NAME` in `sw.js`** (current: `eiti-wizard-lab-v1.8.9-refmem2`
→ next e.g. `…-refmem3`), otherwise installed clients keep the old file. The old cache is deleted on activate.
A static test checks that the asset is listed and that `CACHE_NAME` differs from `main`.

## 5. Epistemic contract

Never: document text → fact; “source says X” → X is true; three documents repeat X → verified;
“a page says implemented” → runtime exists; “a GitHub file exists” → active runtime; human-lens term → system primitive.

Keep OBSERVATION ≠ SOURCE_ASSERTION ≠ CANDIDATE ≠ QUALIFIED CLAIM. Guards: RETRIEVED ≠ EVIDENCE,
EVIDENCE ≠ BELIEF, BELIEF ≠ TRUTH, IMPLEMENTED ≠ ACTIVATED, TESTED ≠ AUTHORIZED, MODEL OUTPUT ≠ CANON,
JUDGE OUTPUT ≠ AUTHORITY, UNKNOWN ≠ FALSE, TERM ≠ MECHANISM/MODULE/OWNER, OWNER ROLE ≠ IMPLEMENTED CAPABILITY,
LEXICAL SALIENCE ≠ SCIENTIFIC VALIDITY ≠ ARCHITECTURAL NEED, BOOK ≠ CANON, HANDOFF DESCRIPTION ≠ SOURCE CONTENT.
Cached implementation state is always reported as “cached state as-of X — verify live on GitHub”.
Authority is scoped, not global; nothing in this layer grants runtime, architecture or canon authority.

## 6. Public / private boundary

* The public repo contains only: schema, importer, retrieval, tools, docs, tests, synthetic fixtures,
  a placeholder-only template and a public demo seed (demo-labelled items, plus a few observations of this
  repo's own code at an exact commit).
* Private corpora (from private documents) are built **locally** as `*.private.jsonl`, imported through the
  UI into the browser (SQLite → IndexedDB via the verified `_wizSaveDBAsync()`, §4b) and never committed. The
  source file can be deleted only after the UI shows `IMPORT_PERSISTED = TRUE`; the SQLite copy persists. `Export backup` downloads a `*.private.jsonl` file.
* `.gitignore` covers `*.private.jsonl`, `*.private.sqlite`, `velantrim-reference-private*`, `private-memory/*`.
* `tests/refmem/scan-private.sh` scans the branch diff, every commit reachable from HEAD, branch commit
  messages and all tracked files for private-surface URLs, Notion-style IDs and (with local, uncommitted
  pattern files) exact private IDs/titles.

## 7. Tests

See `tests/refmem/README.md`.

## 8. Non-goals of this milestone

No automatic context injection, no embeddings/vector DB, no graph layer, no cloud or Notion/Drive sync,
no Canon promotion, no global authority owner, no autonomous memory admission, no changes to `wiz_facts`,
no private corpus.

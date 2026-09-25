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
| Persistence | the **existing** path: `_wizSaveDB()` → IndexedDB `wiz_lab_mem_store` / key `wiz_lab_sqlite_db` |
| Schema hook | one guarded line in `_wizInitMemSchema()` calling `WizRef.initSchema(db)` |
| UI | Memory panel → card “📖 Reference memory (wiz_ref)”: Import JSONL · Export backup · Clear reference · search |
| Agent tools | `ref_search`, `ref_source`, `ref_project`, `ref_trace` (read-only; registered **alongside** `mem_*`) |

Personal memory (`wiz_facts`, `wiz_facts_fts`, `wiz_l2_digests`, `wiz_notes_fts`, `wizMem*`,
`wizConsolidateL2`, `wizDecayTick`, `mem_*` tools) is **unchanged**. Reference items:

* are never written to `wiz_facts`;
* never decay (`wizDecayTick()` only reads/updates `wiz_facts`; tested);
* can never become `Validated` through `mem_validate` (it only calls `wizMemSetState` → `UPDATE wiz_facts`; tested);
* are never injected into the chat context automatically — retrieval is explicit only.

## 2. Schema (schema_version 1)

```sql
wiz_ref_sources(source_id PK, title NOT NULL, surface NOT NULL, source_kind NOT NULL, authority_class,
                project_id, locator, revision, as_of, currentness, privacy DEFAULT 'private', content_hash,
                seed_id, first_seed_version, last_seed_version, record_hash, imported_at)
wiz_ref_items(item_id PK, source_id NOT NULL → wiz_ref_sources, project_id, item_type NOT NULL, claim NOT NULL,
              source_section, source_status, epistemic_state, authority_scope, validity, confidence, as_of,
              supersedes_item_id, created_at, provenance, lifecycle DEFAULT 'ACTIVE', superseded_by,
              record_hash, seed_id, first_seed_version, last_seed_version)
wiz_ref_relations(relation_id PK, from_item_id NOT NULL, to_item_id NOT NULL, relation_type NOT NULL,
                  epistemic_status NOT NULL, source_id, scope, rationale, seed_id, created_at)
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

1. **Idempotent.** Records are keyed by `source_id` / `item_id` / `relation_id`; identical content → *unchanged*.
   Importing the same bundle twice creates zero duplicates (tested).
2. **Statuses preserved verbatim.** `source_status`, `epistemic_state`, `currentness`, `validity` are stored
   exactly as given. A missing `epistemic_state` defaults to the weakest reading, `SOURCE_ASSERTION`.
   The importer **never qualifies**: it never sets QUALIFIED/VERIFIED/VALIDATED/CANON; if a record itself
   carries such a word it is kept verbatim as *that source's assertion* and a warning is emitted.
3. **Supersession without deletion.**
   * `supersedes_item_id` marks the older item `lifecycle='SUPERSEDED'`, `superseded_by=<new>` and adds a
     `SUPERSEDES` relation; the old row stays.
   * Same `item_id` with different content (new seed revision) → the previous version is kept as
     `<item_id>@<old_record_hash>` with `lifecycle='SUPERSEDED'`, then the current row is updated.
   * Items missing from a new revision of the same seed are **not deleted**; they are counted
     (`not_in_this_seed`) and keep their `last_seed_version`.
   * An import can never move an item back from SUPERSEDED to ACTIVE.
4. **Seed bookkeeping.** `seed_version`, `seed_as_of`, `seed_hash` (SHA-256 of the file) and
   `seed.<seed_id>` are written to `wiz_ref_meta`.
5. **Guards.** `HUMAN_REFERENCE_ONLY` sources may only carry `HUMAN_LENS` items and `HUMAN_LENS` items require
   such a source; `BOOK_DONOR` sources must be `RESEARCH_DONOR`; unknown `item_type` / `source_kind` /
   `relation_type` are rejected. The whole import runs in one transaction.

## 4. Retrieval (explicit only)

| JS (browser globals, over `window._wizDB`) | Pure (`WizRef.*`, db-first) | Agent tool |
|---|---|---|
| `wizRefSearch(query, filters)` | `WizRef.search(db, query, filters)` | `ref_search` |
| `wizRefGetSource(sourceId)` | `WizRef.getSource(db, sourceId)` | `ref_source` |
| `wizRefProject(projectId)` | `WizRef.project(db, projectId)` | `ref_project` |
| `wizRefTrace(itemId)` | `WizRef.trace(db, itemId)` | `ref_trace` |

Filters: `project_id`, `item_type`, `authority_class`, `source_kind`, `surface`, `source_id`,
`include_superseded` (default false), `implementation_evidence_only`, `limit`.

Every result carries: `claim, project_id, item_type, epistemic_state, source_status, authority_class,
source_kind, source_title, source_id, source_surface, as_of, source_revision, provenance, lifecycle` plus
computed flags `is_implementation_evidence` (only `surface=github` + `IMPLEMENTATION_EVIDENCE`),
`is_live_state=false`, `is_main_state=false`, `is_draft_or_branch`, `is_system_primitive=false`,
`is_verified_truth=false`, `caveats[]` and a text `block`, e.g.:

```
[REFERENCE MEMORY] demo-project-x / IMPLEMENTATION_FACT / OBSERVATION / source_status=OPEN · DRAFT / currentness=CURRENT
source: [SYNTHETIC FIXTURE] … (fx:src:github-soul; github/IMPLEMENTATION; authority=IMPLEMENTATION_EVIDENCE; rev=abc1234)
as_of: 2026-09-25 · scope: demo-project-x branch feat/relations (unmerged)
claim (source-bound, not verified truth): Fixture: PR #202 was OPEN/DRAFT at source snapshot.
⚠ CACHED STATE as-of 2026-09-25 — not live repo state; verify live on GitHub (IMPLEMENTED ≠ ACTIVATED)
⚠ DRAFT/BRANCH STATE — not a main-branch fact
```

`ref_search` never returns a bare claim. `mem_search` (personal) and `ref_search` (reference) query
different tables and return disjoint datasets.

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
  UI into the browser (SQLite → IndexedDB) and never committed. The source file can be deleted after import;
  the SQLite copy persists. `Export backup` downloads a `*.private.jsonl` file.
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

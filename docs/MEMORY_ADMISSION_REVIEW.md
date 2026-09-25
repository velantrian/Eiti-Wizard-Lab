# Memory Admission Controller v0.1 — REVIEW MODE FIRST (lab, step 1 of 2)

> **Status: RESEARCH / LAB.** NOT CANON · NOT RUNTIME AUTHORIZATION · NOT A GLOBAL MEMORY OWNER ·
> NOT AN AUTOMATIC MEMORY WRITER · NOT AN E0-A REPLACEMENT. It claims no semantic authority, is no
> TruthGate, and decides nothing: it **proposes** and **waits for an explicit user decision**.
>
> **This build is step 1 of 2.** It prepares and stages review packets. `apply()` / `dismiss()` do not
> exist yet (step 2). Nothing in this build writes Reference Memory (`wiz_ref_*`) or personal memory.

LLM OUTPUT ≠ MEMORY DECISION · SIMILARITY ≠ IDENTITY ≠ DUPLICATE ≠ SUPERSESSION · NEW INFORMATION ≠ NEW MEMORY

## 1. What it is

A review layer over the merged SQLite Reference Memory (`wiz_ref_*`, see `REFERENCE_MEMORY.md`). Given an
incoming information object (a **memory passport**) it:

1. validates the passport (CAPTURE → NORMALIZE → PROVENANCE CHECK),
2. retrieves potentially related `wiz_ref` records through the existing `WizRef.search` / `WizRef.trace`
   (CANDIDATE RETRIEVAL — similarity only ranks),
3. applies deterministic HARD RULES, then derives a proposal only from **deterministic** bases
   (exact identity/content, explicit typed inputs) — otherwise `UNCERTAIN`,
4. builds a transparent REVIEW PACKET (what came, from where, what is nearby, proposed outcome, why,
   affected records, epistemic/status effect, exact write plan) and
5. stages it in the lab-only table `wiz_admission_reviews` with `review_state = 'AWAITING_REVIEW'`.

It does **not** implement a second reference store. The later apply step (step 2) will go through the existing
`WizRef.importJSONL`. No consolidation, engrafting, vector DB, graph engine, embeddings or LLM retrieval
injection. E0-A (PR #6) is only a donor of invariant-test ideas; its Python is not a dependency and its
ACCEPT/HOLD/REJECT enum belongs to a different layer.

Files: `wiz-memory-admission.js` (module + staging schema + browser glue), this document,
`tests/admission/{db.test.cjs, browser.test.mjs, fixtures/synthetic.*, README.md}`.
`index.html`: one `<script>` tag, one guarded schema-hook line, the `🧠 Admission review` card, one render call.
`sw.js`: asset line + `CACHE_NAME` bump.

## 2. Mode

`ADMISSION_MODE = 'REVIEW'` is mandatory and the only mode. A passport `MODE` or `opts.mode` other than
`REVIEW` is rejected (no AUTO / AUTONOMOUS / BACKGROUND_ADMIT / AUTO_PROMOTE / AUTO_MERGE). Even
deterministic cases (e.g. an exact DUPLICATE) go to review. There is no “auto approve” control. The staging
table enforces `CHECK (mode = 'REVIEW')`.

## 3. Closed outcome enum (exactly 8, frozen)

```js
const OUTCOMES = Object.freeze(['DUPLICATE', 'REFINEMENT', 'NEW_EVIDENCE', 'CONTRADICTION',
  'NEW_RELATED_ITEM', 'STATUS_CHANGE', 'OUT_OF_SCOPE', 'UNCERTAIN']);
```

Mirrored by `CHECK (proposed_outcome IN (…))` in the staging table (tested). NEW / UPDATE / SUPERSEDE /
CONFLICT / RELATE / REJECT / HOLD are not outcomes.

| Outcome | Proposed by step 1 only when | Write plan (declarative, not executed) |
|---|---|---|
| `DUPLICATE` | hard deterministic match: exact normalized content key with a **current** version (optionally + same `ITEM_ID`), or `EQUIVALENT_TO` pre-declared by typed external input (`declared_by` USER / EXTERNAL_SYSTEM, with `basis`). Similarity alone **never**. | `writes: []` (no ref mutation) |
| `REFINEMENT` | typed `REFINES: <exact current version_id>`, same TYPE, SCOPE and STATUS (no status transition) | `ADD_ITEM_VERSION` of the same logical item |
| `NEW_EVIDENCE` | one typed `RELATIONS` entry `SUPPORTS` / `COUNTEREVIDENCE` (= direction) to an exact version + `SOURCE` + `RATIONALE` | `ADD_ITEM` + `ADD_RELATION` (direction); status never changes |
| `CONTRADICTION` | one typed `RELATIONS` entry `CONTRADICTS` to an exact version | `ADD_ITEM` + `ADD_RELATION CONTRADICTS → target_version_id`; no winner, no status change |
| `NEW_RELATED_ITEM` | one typed `RELATIONS` entry with an allowed contract type (`RELATED_TO, DERIVED_FROM, ROUTES_TO, OWNS, TESTED_BY, IMPLEMENTED_IN, DOCUMENTED_IN`) to an exact version | `ADD_ITEM` + `ADD_RELATION` |
| `STATUS_CHANGE` | typed `PROPOSED_STATUS_CHANGE` with target_version_id, from_status (= current), to_status, authority, evidence, rationale; not hard-blocked | `ADD_ITEM_VERSION` (status) — relations to the old version stay pinned |
| `OUT_OF_SCOPE` | `opts.review_scope.project_ids` is set and does not contain the passport `SCOPE` | `writes: []` |
| `UNCERTAIN` | everything else — first-class normal result (≠ error): no deterministic basis, ambiguous candidates, ambiguous/invalid typed intent, hard-rule block, archived-only match, reference memory not initialised | `writes: []` |

## 4. Memory passport

Fields: `WHAT, SOURCE, WHO, WHEN, SCOPE, ENTITY, GOAL, TYPE, STATUS, RELATIONS, RATIONALE, EVIDENCE,
CONFIDENCE, VALIDITY, SUPERSEDES, EXPIRY, PROVENANCE` (keys are case-insensitive, normalized to upper case).
**Required:** `WHAT, SOURCE, WHO, WHEN, SCOPE, TYPE, STATUS, PROVENANCE`. A passport missing any of them (or with
`TYPE` outside the Reference Memory `item_type` vocabulary, `WHEN` not ISO, `SOURCE` without `source_id` or
title+surface) is rejected: `prepare()` returns `{ok:false, errors}` and **writes nothing at all** (not even a
staging row). Unknown keys are ignored with a warning.

Typed extension inputs (explicit, external — never inferred from similarity): `MODE`, `ITEM_ID`,
`REFINES` (exact version id), `EQUIVALENT_TO` `{version_id, declared_by, basis}`,
`PROPOSED_STATUS_CHANGE` `{target_version_id, from_status, to_status, authority, evidence, rationale}`, and
the passport's own `RELATIONS` `[{relation_type, target_version_id}]`. At most **one** intent
(REFINES / one RELATIONS entry / PROPOSED_STATUS_CHANGE) — more → `UNCERTAIN` (ambiguous). Targets must be
**exact version ids** (`<logical>@<hash>`); a logical id or unknown version → `UNCERTAIN`.

## 5. Decision procedure (deterministic, first match wins)

1. **Scope** → `OUT_OF_SCOPE` (no retrieval, no write plan).
2. Reference memory not initialised → `UNCERTAIN` (the controller never creates `wiz_ref_*` tables).
3. **Hard rules on the incoming status** → `UNCERTAIN` (blocked).
4. **Deterministic DUPLICATE**: declared equivalence (accepted declarers only) → exact content key vs.
   current versions → match with an archived version only ⇒ `UNCERTAIN` (SUPERSEDED ≠ ERASED).
5. **Typed intent** (exactly one) → STATUS_CHANGE / REFINEMENT / CONTRADICTION / NEW_EVIDENCE /
   NEW_RELATED_ITEM, each with its own preconditions (else `UNCERTAIN`).
6. Otherwise `UNCERTAIN` — with a reason naming whether there were 0, 1 or several similar candidates.

**Exact content key** (the DUPLICATE basis):
`JSON.stringify([normText(claim), item_type, scope/project_id, source_id, status])` where
`normText` = trim + Unicode NFC + collapse whitespace. Case, punctuation and wording differences are **not**
normalized away (so a reworded claim is never a duplicate). Equality is computed on both sides with the same
function; the FTS index is only used to find rows that contain the claim terms (plus a type/scope list lookup),
never to decide equality. A same claim from a **different source** is not a duplicate (possible evidence —
reviewer decides).

## 6. Candidate retrieval

`WizRef.search(db, WHAT, {project_id: SCOPE, limit})` (current versions) — each candidate carries `item_id,
logical_item_id, version_id, is_current_version, claim, item_type, epistemic_state, source_status, lifecycle,
source {source_id, title, surface, kind, authority_class, revision, as_of}, provenance, caveats, block` (the
full Reference Memory provenance block — never a bare claim) and relation context from `WizRef.trace`
(pinned outgoing/incoming relations). `similarity` = `{method: 'FTS5/BM25 via WizRef.search', match_mode, note:
'RANK ONLY'}`; `deterministic` = `{exact_content_key, same_logical_item}`. Candidates are **not evidence**
(RETRIEVED ≠ EVIDENCE) and are never used as an implicit relation target.

## 7. Review packet (produced before any mutation)

```jsonc
{ "mode": "REVIEW", "admission_version": "0.1-step1", "review_id": "adm-review:…", "created_at": 0,
  "incoming": { /* normalized passport */ },
  "candidate_matches": [ /* §6 */ ],
  "proposed_outcome": "UNCERTAIN",            // one of the 8
  "reason": "…",                              // mandatory
  "decision_basis": "EXACT_CONTENT_KEY | EXACT_IDENTITY_AND_CONTENT | DECLARED_EQUIVALENCE | TYPED_* | SCOPE_MISMATCH | NONE (no deterministic basis)",
  "affected_records": [ {"version_id", "logical_item_id", "item_id", "claim", "epistemic_state", "is_current_version"} ],  // mandatory
  "proposed_relations": [], "proposed_status_effect": {"changes": [], "note": "…"},
  "provenance": {"passport", "source", "who", "when", "content_key_sha256"},   // mandatory
  "hard_rules_triggered": [], "warnings": [],
  "write_plan": {"executes": false, "note": "PROPOSAL ONLY …", "writes": [ /* e.g. {op:'ADD_ITEM',…}, {op:'ADD_RELATION', relation_type:'CONTRADICTS', target_version_id} */ ]},
  "ref_fingerprint": {"before": "sha256:…", "after": "sha256:…", "unchanged": true},
  "state": "AWAITING_REVIEW" }
```

## 8. Staging storage (lab-only, additive)

```sql
CREATE TABLE IF NOT EXISTS wiz_admission_reviews (
  review_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'REVIEW' CHECK (mode = 'REVIEW'),
  incoming_json TEXT NOT NULL,
  candidate_json TEXT NOT NULL,
  proposed_outcome TEXT NOT NULL CHECK (proposed_outcome IN ('DUPLICATE','REFINEMENT','NEW_EVIDENCE','CONTRADICTION','NEW_RELATED_ITEM','STATUS_CHANGE','OUT_OF_SCOPE','UNCERTAIN')),
  rationale TEXT NOT NULL,
  affected_records_json TEXT NOT NULL,
  write_plan_json TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'AWAITING_REVIEW' CHECK (review_state IN ('AWAITING_REVIEW','APPLIED','DISMISSED')),
  reviewed_at INTEGER,
  packet_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wiz_admission_reviews_state ON wiz_admission_reviews(review_state, created_at);
```

Created by `WizAdmission.initSchema(db)` from the guarded hook in `_wizInitMemSchema()` (and lazily by
`prepare()`); purely additive, idempotent, never alters `wiz_ref_*` or personal-memory tables (tested on a DB
created by `main`). `packet_json` (the full packet, incl. warnings / proposed relations / status effect) is an
addition to the spec's column list so a staged packet can be shown exactly as prepared. `review_state` is a
**workflow** state, never an epistemic status (no VERIFIED / ACTIVE / CANON). Step 1 only writes
`AWAITING_REVIEW`; `APPLIED` / `DISMISSED` are reserved for step 2. Staged reviews are **not** memory: they
never appear in `ref_search` / `mem_search` and are never injected into any context.

API: `WizAdmission.prepare(db, incoming, opts)` (async) · `getReview(db, id)` · `listPending(db)` ·
`initSchema(db)` · `refFingerprint(db)` · `formatPacket(packet)`. Browser: `wizAdmissionPrepare(incoming, opts)`
(prepare + verified persist) · `wizAdmissionGetReview(id)` · `wizAdmissionListPending()`.

## 9. Zero-write guarantee (step 1)

* `wiz-memory-admission.js` contains **no** SQL statement that writes `wiz_ref_*`, and calls only the read
  functions `WizRef.search`, `WizRef.trace` and `WizRef.sha256Hex` (static test `zw-static`). Its only
  `db.run` calls are the staging DDL, `BEGIN`/`COMMIT`/`ROLLBACK` and one `INSERT INTO wiz_admission_reviews`.
* `prepare()` computes a SHA-256 fingerprint of every `wiz_ref*` object (schema rows + all rows of all
  tables incl. FTS shadow tables) before retrieval, after the decision and again after the staging INSERT
  inside the transaction; any difference aborts (ROLLBACK, nothing staged). The fingerprints are in the packet.
* Tests compare an **independent** full dump of `wiz_ref*` (and of `wiz_facts`, `wiz_facts_fts`,
  `wiz_l2_digests`) before/after every prepare (DB suite) and in the real page (browser suite).
* If `wiz_ref_items` does not exist, the controller does not call WizRef at all (WizRef read functions
  would otherwise run `initSchema`).

## 10. Persistence

The staging INSERT is a write to the SQLite DB, but not to `wiz_ref_*`. The browser wrapper persists it with
the verified `_wizSaveDBAsync()` (IndexedDB `oncomplete` → exact byte read-back → SHA-256 confirmation, see
`REFERENCE_MEMORY.md` §4b); the UI shows `REVIEW_PERSISTED = TRUE` only after that ack. The pending review
survives reload (browser test B3). Same documented residual risk as Reference Memory: an older fire-and-forget
`_wizSaveDB()` write landing later can overwrite the stored bytes until the next save.

## 11. Hard rules

| Hard rule | Step 1 (prepare / packet) | Step 2 (apply) |
|---|---|---|
| MODEL_PROPOSAL ↛ USER_DECISION | incoming `STATUS: USER_DECISION` from a model-like `WHO`, or a status change to USER_DECISION with model-like WHO/authority → `UNCERTAIN` (blocked); pair (MODEL_PROPOSAL, USER_DECISION) hard-blocked | re-check before import |
| RESEARCH_RESULT ↛ PROD_AUTH | incoming RESEARCH_RESULT with PROD_AUTH, or status change to PROD_AUTH on a RESEARCH_RESULT / from RESEARCH_RESULT → blocked | re-check |
| CLAIM WITHOUT SOURCE ↛ VERIFIED | SOURCE + PROVENANCE required (else rejected); VERIFIED-like incoming STATUS → blocked; promotion needs authority + evidence + rationale, model authority → blocked; CANDIDATE → VERIFIED hard-blocked | re-check |
| UNKNOWN ↛ FALSE | status change UNKNOWN → FALSE hard-blocked | re-check |
| SUPERSEDED ≠ ERASED | match with an archived version only → `UNCERTAIN` (not DUPLICATE); write plans never delete | apply via versioned import (no deletion) |
| RETRIEVED ≠ EVIDENCE | candidates are never used as relation targets or evidence; only typed `RELATIONS` / `REFINES` / `PROPOSED_STATUS_CHANGE` with exact version ids | — |
| SIMILAR ≠ SAME | DUPLICATE only by exact content key / identity / declared equivalence; similarity only ranks (A2) | — |
| RELATION ≠ TRUTH | CONTRADICTION / NEW_EVIDENCE never change status (`proposed_status_effect.changes = []`) | apply adds relations only |
| USER SAID X ≠ X IS TRUE | `WHO: USER` does not raise status; the incoming STATUS is kept verbatim; VERIFIED-like incoming blocked | — |
| item version changed ≠ historical relation target changed | targets are exact version ids; REFINEMENT / STATUS_CHANGE are new versions (old relations stay pinned, P1-5 of Reference Memory) | enforced by `WizRef.importJSONL` version pinning |

## 12. UI

Memory panel → separate card **🧠 Admission review** (below 📖 Reference memory, not mixed with it or with
personal memory): passport textarea, review-scope field, `Example` and `Prepare review` buttons, the pending
list and the full packet (incoming, provenance, candidates, proposed outcome, rationale, affected records,
exact write plan, warnings). Rendered with `textContent` only. **No Apply / Dismiss / Auto-approve controls
in step 1.** No agent tool is registered and nothing is injected into chat context.

## 13. Not in step 1 (step 2)

`apply()` / `dismiss()` through `WizRef.importJSONL` (DUPLICATE apply = no ref mutation; REFINEMENT = same
item_id new version; NEW_EVIDENCE = separate item + SUPPORTS/COUNTEREVIDENCE only with explicit direction;
CONTRADICTION = new item + CONTRADICTS to the exact version; STATUS_CHANGE guarded), `reviewed_at`,
tests A4–A9, A12, A14, A15, the apply half of A3, browser apply/reload tests.

## 14. Judgment calls (flagged)

* A passport missing a required field is **rejected** (`ok:false`, nothing staged) rather than staged as
  `UNCERTAIN`: a packet without provenance could not be reviewed meaningfully.
* No-candidate + no-intent input → `UNCERTAIN` (the enum has no “new item” outcome; a standalone addition is
  a reviewer decision).
* `NEW_RELATED_ITEM` excludes `SUPERSEDES` (never proposed by v0.1), `CONTRADICTS` and
  `SUPPORTS`/`COUNTEREVIDENCE` (they have dedicated outcomes).
* Candidate retrieval is limited to the passport `SCOPE` (project) — the controller review scope.
* The DUPLICATE content key includes `source_id` and `STATUS`; wording/case are not normalized.
* Typed inputs `ITEM_ID`, `REFINES`, `EQUIVALENT_TO`, `PROPOSED_STATUS_CHANGE` extend the passport.
* Extra staging column `packet_json`; the PRIMARY KEY autoindex is SQLite's own.

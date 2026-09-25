# Memory Admission Controller v0.1 — REVIEW MODE FIRST (lab, step 1 of 2)

> **Status: RESEARCH / LAB.** NOT CANON · NOT RUNTIME AUTHORIZATION · NOT A GLOBAL MEMORY OWNER ·
> NOT AN AUTOMATIC MEMORY WRITER · NOT AN E0-A REPLACEMENT. It claims no semantic authority, is no
> TruthGate, and decides nothing: it **proposes** and **waits for an explicit user decision**.
>
> **This build is step 1 of 2.** It prepares and stages review packets. `apply()` / `dismiss()` do not
> exist yet (step 2). Nothing in this build writes Reference Memory (`wiz_ref_*`) or personal memory.
>
> **Audit revision 1** (see §15): read-only retrieval (no WizRef db function is called — they all run
> `WizRef.initSchema`), strict DUPLICATE identity rule, and trusted caller context for authority claims.

LLM OUTPUT ≠ MEMORY DECISION · SIMILARITY ≠ IDENTITY ≠ DUPLICATE ≠ SUPERSESSION · NEW INFORMATION ≠ NEW MEMORY

## 1. What it is

A review layer over the merged SQLite Reference Memory (`wiz_ref_*`, see `REFERENCE_MEMORY.md`). Given an
incoming information object (a **memory passport**) it:

1. validates the passport (CAPTURE → NORMALIZE → PROVENANCE CHECK),
2. retrieves potentially related `wiz_ref` records **read-only** with its own SELECT statements over the
   Reference Memory v3 tables and FTS index (CANDIDATE RETRIEVAL — similarity only ranks; §6, §9),
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
| `DUPLICATE` | (a) `ITEM_ID` = an existing logical item **and** compatible exact content with its **current** version (all `DUPLICATE_MATCH_FIELDS`, §5), or (b) `EQUIVALENT_TO` `{version_id, declared_by, basis}` where `declared_by` ∈ USER / EXTERNAL_SYSTEM **matches a trusted caller context** and `WHO` is not model-like (§5a). Identical text without identity → `UNCERTAIN`. Similarity alone **never**. | `writes: []` (no ref mutation) |
| `REFINEMENT` | typed `REFINES: <exact current version_id>`, same TYPE, SCOPE and STATUS (no status transition) | `ADD_ITEM_VERSION` of the same logical item |
| `NEW_EVIDENCE` | one typed `RELATIONS` entry `SUPPORTS` / `COUNTEREVIDENCE` (= direction) to an exact version + `SOURCE` + `RATIONALE` | `ADD_ITEM` + `ADD_RELATION` (direction); status never changes |
| `CONTRADICTION` | one typed `RELATIONS` entry `CONTRADICTS` to an exact version | `ADD_ITEM` + `ADD_RELATION CONTRADICTS → target_version_id`; no winner, no status change |
| `NEW_RELATED_ITEM` | one typed `RELATIONS` entry with an allowed contract type (`RELATED_TO, DERIVED_FROM, ROUTES_TO, OWNS, TESTED_BY, IMPLEMENTED_IN, DOCUMENTED_IN`) to an exact version | `ADD_ITEM` + `ADD_RELATION` |
| `STATUS_CHANGE` | typed `PROPOSED_STATUS_CHANGE` with target_version_id, from_status (= current), to_status, authority, evidence, rationale; not hard-blocked; `authority` ∈ USER / EXTERNAL_SYSTEM **proven by a matching trusted caller context** (§5a) | `ADD_ITEM_VERSION` (status) — relations to the old version stay pinned |
| `OUT_OF_SCOPE` | `opts.review_scope.project_ids` is set and does not contain the passport `SCOPE` | `writes: []` |
| `UNCERTAIN` | everything else — first-class normal result (≠ error): no deterministic basis, ambiguous candidates, identical text without identity, ambiguous/invalid typed intent, hard-rule block, unproven authority, archived-only match, reference memory absent / needing migration or repair | `writes: []` |

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
2. **Reference memory readiness** (read-only, §9): `ABSENT` → `UNCERTAIN` (the controller never creates
   `wiz_ref_*` tables); `NEEDS_MIGRATION` (schema_version ≠ 3, tables/columns missing) → `UNCERTAIN`, nothing
   read; `NEEDS_REPAIR` (v3 but rows `WizRef.initSchema` would backfill/repair: no version_id, no capture
   provenance, missing FTS row, relation without record_hash / pins) → `UNCERTAIN`, readable records shown.
   Warning: `reference memory needs migration/repair (…); retrieval is read-only — nothing was migrated or repaired`.
3. **Hard rules on the incoming status** → `UNCERTAIN` (blocked). `STATUS: USER_DECISION` additionally needs a
   trusted USER caller context.
4. **Deterministic DUPLICATE** (hard identity only):
   a. `EQUIVALENT_TO` → `DUPLICATE` only with a trusted caller context matching `declared_by` (§5a) + `basis`
      + exact existing version; otherwise `UNCERTAIN` (+ hard rule `LLM OUTPUT ≠ MEMORY DECISION`).
   b. `ITEM_ID` names an existing logical item and the incoming is compatible with its **current** version on
      every `DUPLICATE_MATCH_FIELDS` field → `DUPLICATE` (`EXACT_IDENTITY_AND_CONTENT`); compatible only with an
      archived version → `UNCERTAIN` (SUPERSEDED ≠ ERASED); otherwise a warning names the differing fields
      (`NOT a duplicate`) and the procedure continues.
   c. No identity but an identical (normalized) claim text exists in scope/type → `UNCERTAIN`
      (IDENTICAL TEXT ≠ SAME ITEM).
5. **Typed intent** (exactly one) → STATUS_CHANGE / REFINEMENT / CONTRADICTION / NEW_EVIDENCE /
   NEW_RELATED_ITEM, each with its own preconditions (else `UNCERTAIN`). An `ADD_ITEM` intent with an
   `ITEM_ID` that already exists → `UNCERTAIN` (it would silently become a new version of that item).
6. Otherwise `UNCERTAIN` — with a reason naming whether there were 0, 1 or several similar candidates.

**DUPLICATE_MATCH_FIELDS** (all must be equal; the stored side is the version's **capture** provenance, never
the current source record):

| field | incoming | stored version |
|---|---|---|
| `claim` | `normText(WHAT)` | `normText(claim)` |
| `item_type` | `TYPE` | `item_type` |
| `scope` | `SCOPE` | `project_id` |
| `source_id` | `SOURCE.source_id` | `source_id` |
| `status` | `STATUS` | `epistemic_state` |
| `when` | `WHEN` (string-equal) | `as_of` |
| `provenance` | canonical JSON of `PROVENANCE` (sorted keys) | canonical JSON of `provenance` (JSON text parsed; plain text normalized) |
| `source_revision` | `SOURCE.revision` | `source_revision_at_capture` |
| `source_as_of` | `SOURCE.as_of` | `source_as_of_at_capture` |
| `source_content_hash` | `SOURCE.content_hash` | `source_content_hash_at_capture` |

Absent = empty on both sides (absent vs. present ⇒ mismatch). A version whose capture provenance was
**backfilled** at migration (`capture_backfilled = 1`) never qualifies. `normText` = trim + Unicode NFC +
collapse whitespace; case, punctuation and wording are **not** normalized.

**Proposed id of a new item:** `ITEM_ID` if given (and not already existing), else
`adm:<created_at base36><12 random hex>` — review-derived and random, **never derived from content**
(`write_plan.proposed_new_logical_item_id`). Step 2 may still assign the final id at apply time.

### 5a. Trusted caller context (authority is never taken from the passport)

`prepare(db, incoming, { caller })` — `caller` counts only if it is an **unforgeable token minted inside the
module** (module-private `WeakSet`); anything else (plain object, string, a `CALLER` passport key, a look-alike
frozen object) is ignored → `{kind: 'UNTRUSTED'}` (the default). Tokens are minted:

* **Browser:** only in the click handler of `#wizAdmPrepareBtn` from a **genuine user event** — `isTrusted`
  read via the brand-checked getter captured at load time, `type === 'click'`, target = the button. Script
  calls of `wizAdmUiPrepare()`, prototype-forged events and `dispatchEvent(new MouseEvent('click'))` are
  untrusted (browser test B5). `window.wizAdmissionPrepare(incoming, opts)` always drops `opts.caller`.
  `hostCallerContext` is **not** exported in the browser. No agent tool exists; none can reach the token.
* **Non-DOM host** (node tests / a future host integration): `WizAdmission.hostCallerContext('USER' |
  'EXTERNAL_SYSTEM')`. `MODEL` or any other kind throws.

Rules (conservative): `EQUIVALENT_TO.declared_by = X` and `PROPOSED_STATUS_CHANGE.authority = X` are accepted
only if X ∈ {USER, EXTERNAL_SYSTEM}, the trusted caller kind **equals** X, and `WHO` is not model-like.
Otherwise → `UNCERTAIN` + hard rule `LLM OUTPUT ≠ MEMORY DECISION` (+ `AUTHORITY_NOT_PROVEN` warning for status
changes). The packet records `caller: {kind, via, trusted}` and, for STATUS_CHANGE, `authority_proof`.

## 6. Candidate retrieval

Own read-only SQL (audit rev 1): FTS5 `MATCH` over `wiz_ref_items_fts` joined to `wiz_ref_items` /
`wiz_ref_sources`, filtered to `project_id = SCOPE` and non-superseded rows, ranked by `bm25` (all terms first,
any-term fallback), `limit` 8 (max 25). Only FTS query-syntax errors are tolerated; any other error (e.g. a
refused write) aborts. Each candidate carries `item_id, logical_item_id, version_id, is_current_version, claim,
item_type, epistemic_state, source_status, lifecycle, project_id, as_of, provenance, capture_backfilled,
source {source_id, title, surface, kind, authority_class, revision, as_of, content_hash (at capture),
current_revision, current_as_of}, caveats, block` (a provenance block `[REFERENCE MEMORY · read-only admission
view] …` — never a bare claim) and pinned relation context `{outgoing, incoming}` read from
`wiz_ref_relations` by version id. `similarity` = `{method: 'FTS5/BM25 (read-only SELECT)', match_mode, note:
'RANK ONLY'}`; `deterministic` = `{same_logical_item, identical_claim_text}` (informational). Candidates are
**not evidence** (RETRIEVED ≠ EVIDENCE) and are never used as an implicit relation target. The same SQL layer
provides exact version lookup (`version_id = ?`), all versions of a logical id, and the identical-text scan.

## 7. Review packet (produced before any mutation)

```jsonc
{ "mode": "REVIEW", "admission_version": "0.1-step1", "review_id": "adm-review:…", "created_at": 0,
  "incoming": { /* normalized passport */ },
  "caller": {"kind": "USER | EXTERNAL_SYSTEM | UNTRUSTED", "via": "…", "trusted": true},
  "reference_memory": {"state": "READY | NEEDS_REPAIR | NEEDS_MIGRATION | ABSENT", "readable": true, "schema_version": "3", "issues": [], "access": "READ_ONLY (…)"},
  "candidate_matches": [ /* §6 */ ],
  "proposed_outcome": "UNCERTAIN",            // one of the 8
  "reason": "…",                              // mandatory
  "decision_basis": "EXACT_IDENTITY_AND_CONTENT | DECLARED_EQUIVALENCE | TYPED_* | SCOPE_MISMATCH | NONE (no deterministic basis)",
  "affected_records": [ {"version_id", "logical_item_id", "item_id", "claim", "epistemic_state", "is_current_version"} ],  // mandatory
  "proposed_relations": [], "proposed_status_effect": {"changes": [], "note": "…"},
  "provenance": {"passport", "source", "who", "when"},   // mandatory
  "hard_rules_triggered": [], "warnings": [],
  "write_plan": {"executes": false, "note": "PROPOSAL ONLY …", "proposed_new_logical_item_id": "adm:… | null", "writes": [ /* e.g. {op:'ADD_ITEM',…}, {op:'ADD_RELATION', relation_type:'CONTRADICTS', target_version_id} */ ]},
  "ref_fingerprint": {"before": "sha256:… | null (no wiz_ref_*)", "after": "…", "unchanged": true},
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

API: `WizAdmission.prepare(db, incoming, opts)` (async; `opts.review_scope`, `opts.caller` = trusted token, §5a) ·
`getReview(db, id)` · `listPending(db)` · `initSchema(db)` · `refReadiness(db)` · `refSnapshot(db)` ·
`refFingerprint(db)` · `formatPacket(packet)` · node-only `hostCallerContext(kind)`. Browser:
`wizAdmissionPrepare(incoming, opts)` (prepare + verified persist; always untrusted) · `wizAdmissionGetReview(id)`
· `wizAdmissionListPending()`.

## 9. Zero-write guarantee (step 1, audit rev 1)

Why the earlier version was insufficient: every WizRef function that takes a `db` (`search`, `trace`,
`getSource`, `project`, `resolveRelation`, `stats`, `exportJSONL`, …) first runs `WizRef.initSchema(db)`, which
can ALTER tables, backfill capture provenance, re-index FTS, hash relations, pin relation endpoints and bump
`schema_version`. On a legacy or repair-needing DB a "read" through WizRef is therefore a write (tests
`ro-legacy` / `ro-fts` show it with a control on a copy).

Chosen design — **genuinely read-only retrieval, plus two independent guards** (more robust than a rolled-back
savepoint alone, because nothing is written in the first place and a legacy DB is never "repaired inside a
savepoint"):

1. **No WizRef db function is called.** Retrieval is this module's own `SELECT` SQL (§6). WizRef is used only
   for constants (`ENUMS.item_type`, `SCHEMA_VERSION`) and the pure hash helper `sha256Hex` (no db argument).
   Readiness is checked read-only (§5 step 2); nothing is migrated or repaired → `UNCERTAIN` + warning.
2. **Engine-enforced read-only phase.** Snapshot → readiness → candidates → decision → snapshot run
   synchronously under `PRAGMA query_only=ON` inside `SAVEPOINT wiz_adm_readonly`, which is **always** rolled
   back and released; `query_only` is then restored. Any write attempt fails in SQLite and aborts `prepare()`
   (`ZERO-WRITE GUARD`), nothing staged. The phase is synchronous, so no other app code can run while
   `query_only` is on.
3. **Snapshot verification.** A full snapshot of every `wiz_ref*` object (sqlite_master rows + every row of
   every table incl. `wiz_ref_meta` / `schema_version`, relation pins and FTS shadow tables) is compared before,
   after the decision, after the savepoint rollback and again inside the staging transaction right before
   `COMMIT`. Any difference throws `ZERO-WRITE VIOLATION` and nothing is staged (ROLLBACK).

Tests: `zw-static` (no wiz_ref write statement; no call of any WizRef db function — the list is derived from
`wiz-ref-memory.js` itself; `db.run` whitelist; `sha256Hex` does not touch the db), `zw-trace` (runtime: every
SQL statement during prepare is SELECT / PRAGMA / savepoint control except the staging INSERT; WizRef is replaced
by a trap that throws on any db-function access), `ro-legacy` (v2 DB unchanged), `ro-fts` (missing FTS row not
repaired), `ro-inject` (injected write during retrieval → throws, no staged row, DB unchanged — both via
`query_only` refusal and via a hook that disables `query_only`, caught by rollback + snapshot), plus independent
dumps of `wiz_ref*` and personal memory around every prepare (DB + browser suites).

## 10. Persistence

The staging INSERT is a write to the SQLite DB, but not to `wiz_ref_*`. The browser wrapper persists it with
the verified `_wizSaveDBAsync()` (IndexedDB `oncomplete` → exact byte read-back → SHA-256 confirmation, see
`REFERENCE_MEMORY.md` §4b); the UI shows `REVIEW_PERSISTED = TRUE` only after that ack. The pending review
survives reload (browser test B3). Same documented residual risk as Reference Memory: an older fire-and-forget
`_wizSaveDB()` write landing later can overwrite the stored bytes until the next save.

## 11. Hard rules

| Hard rule | Step 1 (prepare / packet) | Step 2 (apply) |
|---|---|---|
| MODEL_PROPOSAL ↛ USER_DECISION | incoming `STATUS: USER_DECISION` from a model-like `WHO` or without trusted USER caller context, or a status change to USER_DECISION with model-like WHO/authority → `UNCERTAIN` (blocked); pair (MODEL_PROPOSAL, USER_DECISION) hard-blocked; authority / declared_by strings never self-authorise (§5a) | re-check before import |
| RESEARCH_RESULT ↛ PROD_AUTH | incoming RESEARCH_RESULT with PROD_AUTH, or status change to PROD_AUTH on a RESEARCH_RESULT / from RESEARCH_RESULT → blocked | re-check |
| CLAIM WITHOUT SOURCE ↛ VERIFIED | SOURCE + PROVENANCE required (else rejected); VERIFIED-like incoming STATUS → blocked; any status change needs authority proven by trusted caller context + evidence + rationale; CANDIDATE → VERIFIED hard-blocked | re-check |
| UNKNOWN ↛ FALSE | status change UNKNOWN → FALSE hard-blocked | re-check |
| SUPERSEDED ≠ ERASED | match with an archived version only → `UNCERTAIN` (not DUPLICATE); write plans never delete | apply via versioned import (no deletion) |
| RETRIEVED ≠ EVIDENCE | candidates are never used as relation targets or evidence; only typed `RELATIONS` / `REFINES` / `PROPOSED_STATUS_CHANGE` with exact version ids | — |
| SIMILAR ≠ SAME | DUPLICATE only by exact ITEM_ID + compatible content, or trusted declared equivalence; identical text without identity → UNCERTAIN; similarity only ranks (A2, A3) | — |
| RELATION ≠ TRUTH | CONTRADICTION / NEW_EVIDENCE never change status (`proposed_status_effect.changes = []`) | apply adds relations only |
| USER SAID X ≠ X IS TRUE | `WHO: USER` does not raise status; the incoming STATUS is kept verbatim; VERIFIED-like incoming blocked | — |
| item version changed ≠ historical relation target changed | targets are exact version ids; REFINEMENT / STATUS_CHANGE are new versions (old relations stay pinned, P1-5 of Reference Memory) | enforced by `WizRef.importJSONL` version pinning |

## 12. UI

Memory panel → separate card **🧠 Admission review** (below 📖 Reference memory, not mixed with it or with
personal memory): passport textarea, review-scope field, `Example` and `Prepare review` buttons, the pending
list and the full packet (incoming, caller context, reference-memory readiness, provenance, candidates, proposed
outcome, rationale, affected records, exact write plan, warnings). A genuine click on `Prepare review` supplies
the trusted USER caller context (§5a). Rendered with `textContent` only. **No Apply / Dismiss / Auto-approve controls
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
* DUPLICATE requires `ITEM_ID` (or trusted declared equivalence); `DUPLICATE_MATCH_FIELDS` include `source_id`,
  `STATUS`, `WHEN` (= stored `as_of`), `PROVENANCE` and capture revision/as_of/content_hash; wording/case are not
  normalized; backfilled capture provenance never qualifies.
* Any `PROPOSED_STATUS_CHANGE` (not only promotions) needs authority proven by a trusted caller context;
  `STATUS: USER_DECISION` in a passport needs trusted USER context. Deliberately conservative.
* `NEEDS_REPAIR` (v3 but repair-needing) → always `UNCERTAIN`, even if the readable part would allow a decision.
* Browser trust relies on `Event.isTrusted`; external browser automation (e.g. CDP, as the tests use) produces
  trusted input by design — that is equivalent to a user at the keyboard and is outside the app's agent tools.
* Typed inputs `ITEM_ID`, `REFINES`, `EQUIVALENT_TO`, `PROPOSED_STATUS_CHANGE` extend the passport.
* Extra staging column `packet_json`; the PRIMARY KEY autoindex is SQLite's own.

## 15. Audit revision 1 (PR #10 @ 0342c93)

* **P1-1 indirect write via WizRef.search/trace** — fixed: own read-only SQL, no WizRef db function called;
  `PRAGMA query_only` + always-rolled-back savepoint + snapshot checks; legacy / repair-needing DBs are never
  migrated or repaired (→ `UNCERTAIN` + warning). Tests `zw-static`, `zw-trace`, `ro-legacy`, `ro-fts`,
  `ro-inject`.
* **P1-2 DUPLICATE too weak** — fixed: DUPLICATE only on exact `ITEM_ID` + compatible exact content
  (`DUPLICATE_MATCH_FIELDS`, capture provenance) or trusted declared equivalence; identical text without
  identity → `UNCERTAIN`; new-item id is review-derived/random, never content-derived. Test `A3` rewritten
  (positive + WHEN / PROVENANCE / revision / as_of / content_hash / source / status negatives), `WP` extended.
* **P1-3 authority spoof** — fixed: trusted caller context (module-minted token; browser only from a genuine
  click; node host via `hostCallerContext`); `declared_by` / `authority` must match it and `WHO` must not be
  model-like. Tests `P1-3`, `HR`, browser `B5`.
* Still step 1 of 2: **no `apply()` / `dismiss()`**, no Apply / Dismiss buttons.

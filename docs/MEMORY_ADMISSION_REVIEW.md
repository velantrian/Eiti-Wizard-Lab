# Memory Admission Controller v0.1 — REVIEW MODE FIRST (lab; step 1 Prepare + step 2 Apply/Dismiss)

> **Status: RESEARCH / LAB.** NOT CANON · NOT RUNTIME AUTHORIZATION · NOT A GLOBAL MEMORY OWNER ·
> NOT AN AUTOMATIC MEMORY WRITER · NOT AN E0-A REPLACEMENT. It claims no semantic authority, is no
> TruthGate, and decides nothing: it **proposes** and **waits for an explicit user decision**.
>
> **Step 1** prepares and stages review packets (zero writes to `wiz_ref_*`). **Step 2** (§17) adds exactly two
> explicit, human-gated review actions: **Apply** (executes exactly the prepared and shown write plan through
> the existing `WizRef.importJSONL`, after an integrity + stale-plan check; SQLite-atomic, and persisted with the
> guarantee stated precisely in §17.4 / §18) and **Dismiss** (zero
> writes to `wiz_ref_*`). There is no automatic admission of any kind; `ADMISSION_MODE` stays `REVIEW`. Nothing
> writes personal memory (`wiz_facts`).
>
> **Audit revision 1** (see §15): read-only retrieval (no WizRef db function is called — they all run
> `WizRef.initSchema`), strict DUPLICATE identity rule, and trusted caller context for authority claims.

> **Frozen checkpoint:** [Memory Admission Controller v0.1 — bounded lab result](checkpoints/MEMORY_ADMISSION_CONTROLLER_v0.1.md)
> (describes code at `e286c50`).

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

It does **not** implement a second reference store. The apply step (step 2, §17) goes through the existing
`WizRef.importJSONL` (unchanged). No consolidation, engrafting, vector DB, graph engine, embeddings or LLM retrieval
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

### 5a. Caller context — semantic authority vs. user interaction (authority is never taken from the passport)

**USER_INTERACTION ≠ USER_AUTHORITY · PREPARE_REVIEW ≠ CONFIRM_EQUIVALENCE ≠ AUTHORIZE_STATUS_CHANGE** (audit rev 2).

Two structurally separate, unforgeable token kinds, each in its own module-private `WeakSet`:

* **Authority token** — `prepare(db, incoming, { caller })`. The only thing the authority checks accept. Minted
  **only** by `WizAdmission.hostCallerContext('USER' | 'EXTERNAL_SYSTEM')`, which exists **only in a non-DOM host**
  (node tests / a future host integration); `MODEL` or any other kind throws. Anything else passed as `caller`
  (plain object, string, a `CALLER` passport key, a look-alike frozen object, an interaction token) is ignored →
  `{kind: 'UNTRUSTED', trusted: false}` (the default).
* **Interaction token** — `prepare(db, incoming, { interaction })`. Audit/UI only: "a user clicked *Prepare
  review*". It has no `kind`, is never added to the authority set and is never read by the authority checks.
  In the browser it is minted only in the click handler of `#wizAdmPrepareBtn` from a **genuine user event**
  (`isTrusted` via the brand-checked getter captured at load time, `type === 'click'`, target = the button).
  Script calls of `wizAdmUiPrepare()`, prototype-forged events and `dispatchEvent(new MouseEvent('click'))` get
  no interaction token (browser test B5). Node test seam: `hostInteractionContext()`.

**Browser mode has NO positive semantic-authority path in step 1.** The browser glue never mints an authority
token and never sets `opts.caller`; `window.wizAdmissionPrepare(incoming, opts)` drops both `caller` and
`interaction`; `hostCallerContext` / `hostInteractionContext` are not exported in the browser. So a pasted
`EQUIVALENT_TO.declared_by = USER`, `STATUS: USER_DECISION` or `PROPOSED_STATUS_CHANGE.authority = USER` stays
`UNCERTAIN` even after a genuine click. There is no confirmation UI.

**Host seam — the module does not authenticate the host.** `hostCallerContext('USER')` is a test / host
integration seam. Any code that can call it must already be trusted; a future real host owns the authority
boundary. Future trusted USER authority may come only from (1) a separately verified user-authored event supplied
by the host, or (2) a dedicated explicit confirmation action whose semantics name exactly what is confirmed
(e.g. "confirm equivalence of X with version V"). Neither is implemented in step 1.

Rules (conservative): `EQUIVALENT_TO.declared_by = X` and `PROPOSED_STATUS_CHANGE.authority = X` are accepted
only if X ∈ {USER, EXTERNAL_SYSTEM}, a trusted **authority** token of kind **equal** to X is present, and `WHO` is
not model-like. Otherwise → `UNCERTAIN` + hard rule `LLM OUTPUT ≠ MEMORY DECISION` (+ `AUTHORITY_NOT_PROVEN`
warning for status changes; warnings note "user interaction ≠ user authority" when an interaction is present).
The packet records `caller: {kind, via, trusted, interaction, interaction_via}` and, for STATUS_CHANGE,
`authority_proof`. UI line: `CALLER CONTEXT: USER_INTERACTION (review initiated by user click; NOT semantic
authority) · semantic authority: NONE (…)`.

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
**workflow** state, never an epistemic status (no VERIFIED / ACTIVE / CANON). Prepare writes
`AWAITING_REVIEW`; only an explicit Apply / Dismiss (§17) sets `APPLIED` / `DISMISSED`. Step 2 adds the column
`packet_sha256` (seal) and the table `wiz_admission_actions` (§17.6). Staged reviews are **not** memory: they
never appear in `ref_search` / `mem_search` and are never injected into any context.

API: `WizAdmission.prepare(db, incoming, opts)` (async; `opts.review_scope`, `opts.caller` = authority token, `opts.interaction` = interaction token, §5a) ·
`getReview(db, id)` · `listPending(db)` · `initSchema(db)` · `refReadiness(db)` · `refSnapshot(db)` ·
`refFingerprint(db)` · `formatPacket(packet)` · node-only `hostCallerContext(kind)` / `hostInteractionContext()`. Browser:
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
outcome, rationale, affected records, exact write plan, warnings). A genuine click on `Prepare review` is recorded
as `USER_INTERACTION` only — it is **not** semantic authority (§5a). Rendered with `textContent` only. Step 2 adds
a pending-review selector, **Apply shown plan**, **Dismiss** (+ optional reason) and an action-result area (§17.8).
There is **no Auto-approve / Apply-all control**. No agent tool is registered and nothing is injected into chat
context.

## 13. Not in step 1 (step 2) — implemented in §17

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
* The browser interaction marker relies on `Event.isTrusted`; external browser automation (e.g. CDP, as the tests
  use) produces trusted input by design. Since audit rev 2 this only affects the audit marker, never authority.
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
* At that revision still step 1 of 2 (historical): **no `apply()` / `dismiss()`**, no Apply / Dismiss buttons.

## 16. Audit revision 2 (PR #10 @ a434561) — P1-3b

* **Prepare click ≠ USER semantic authority** — fixed: a genuine *Prepare review* click now mints only a
  `USER_INTERACTION` token (separate field `opts.interaction`, separate `WeakSet`, no `kind`), which the
  authority checks never read. The browser has no path to an authority token; `hostCallerContext` stays a
  non-DOM host seam and is documented as unauthenticated (§5a). UI shows `USER_INTERACTION (review initiated by
  user click; NOT semantic authority)`. `CACHE_NAME` → `…-admission3`.
* Tests: DB `P1-3b` (interaction never satisfies authority, as `interaction` or as `caller`; static: browser glue
  mints interaction only, `_mintAuthority` reachable only from the non-DOM seam); browser `B5` rewritten (genuine
  click + EQUIVALENT_TO declared_by=USER / STATUS USER_DECISION / PROPOSED_STATUS_CHANGE.authority=USER → all
  `UNCERTAIN`; forged / script / dispatched / wrapper negatives kept); `B2` expects the new caller text.
* At that revision still step 1 of 2 (historical): **no `apply()` / `dismiss()`**, no Apply / Dismiss / confirmation controls.

## 17. Step 2 — Apply / Dismiss (bounded; PR #10)

Workflow: `PREPARE → AWAITING_REVIEW → APPLY | DISMISS` (terminal: `APPLIED` / `DISMISSED`). Nothing else was added:
no automatic admission, background memory, meaning extraction, relevance scoring, retrieval controller, context
injection or consolidation. `wiz-ref-memory.js` and `wiz_facts` are unchanged.

### 17.1 The write plan is executable data, fixed at prepare

`prepare()` now builds, inside the read-only phase, a complete plan (`write_plan`):
`import_bundle` (the EXACT `wiz-ref-jsonl/1` records Apply will import, seed `wiz-admission`, seed_version =
review id), `preconditions` (reference fingerprint, targets with version id / logical id / must-be-current /
epistemic state, ids that must stay absent, source records with their `record_hash`), `expected_effect` (items
added / revised, archived versions, relations added with exact pins, sources added), `requires_authority`,
`resolved` / `unresolved`. The packet is sealed: `packet_sha256 = sha256(packet_json)` is stored with it.
UNCERTAIN / OUT_OF_SCOPE (and anything not deterministically resolvable) yields `resolved: false`.

Per outcome: DUPLICATE → no records (Apply records the decision, zero reference writes) · REFINEMENT → one item
record with the SAME logical item id → the importer creates a new immutable version, the old one stays as an
archived row (`item@hash`, SUPERSEDED), relations stay pinned to it · STATUS_CHANGE → same, `epistemic_state` =
the proposed status, capture provenance carried verbatim, requires the host USER authority token · CONTRADICTION /
NEW_EVIDENCE / NEW_RELATED_ITEM → one new item + exactly the declared relation(s) with explicit `to_version_id` =
the typed target version (candidates from similarity are never used). Existing sources are only referenced (a
passport whose SOURCE fields differ from the stored source → unresolved); a new source needs title/surface/kind.

### 17.2 APPLY semantics (`apply` / `applyPersisted`)

In order (`_applyTx`):
1. review missing → `REFUSED NOT_FOUND`; review not `AWAITING_REVIEW` → `REFUSED ALREADY_TERMINAL` (no write, not
   even an action row; terminal states are never reversed or re-applied).
2. **Integrity (tamper) check**: `sha256(packet_json) == packet_sha256`; `write_plan_json`, `proposed_outcome`,
   `incoming_json` equal the sealed packet; id / mode; plan has the step-2 fields; if the UI passes
   `expected_packet_sha256` (the packet it showed) it must equal the stored seal → else `INTEGRITY_FAILED`
   + `REPREPARE_REQUIRED`.
3. UNCERTAIN / OUT_OF_SCOPE / unresolved → `REFUSED NO_EXECUTABLE_PLAN`.
4. Plan needs semantic authority (`requires_authority`: DECLARED_EQUIVALENCE, TYPED_STATUS_CHANGE, a
   USER_DECISION record) → only a matching **host authority token** (`opts.caller`, §5a) satisfies it, else
   `REFUSED AUTHORITY_NOT_PROVEN`. VERIFIED-like statuses, or USER_DECISION without a required authority →
   `REFUSED EPISTEMIC_PROMOTION_BLOCKED`.
5. **Stale-plan guard** (§17.3) → `STALE_REVIEW` + `REPREPARE_REQUIRED`.
6. **Atomic write** (§17.4): exactly one call `W.importJSONL(bundle of the stored plan)` → exact-effect
   verification → `review_state='APPLIED'`, `reviewed_at` → action row with the exact operation result
   (`applied.items[]` / `archived_versions` / `relations[]` / `sources`, importer counts, fingerprint before/after,
   `authority_used`).

Apply never recomputes a plan: the bundle is read from the sealed packet. New meaning = new Prepare.

### 17.3 Stale-plan guard (`_staleCheck`, read-only)

Reference Memory must be `READY`; every target version still exists; `must_be_current` targets are still current
(if not, also reports whether the current status differs → "from_status no longer matches"); the target's
epistemic state equals the one recorded at prepare; every proposed new logical item id and relation id is still
absent; every referenced source still has the same `record_hash` and no planned new source appeared; and the
**full reference fingerprint** (`sha256(refSnapshot)`: schema + every `wiz_ref*` row incl. meta, pins and FTS)
equals the one sealed at prepare. Any difference aborts before any write; the review stays `AWAITING_REVIEW` and
the attempt is recorded as an action row `STALE_REVIEW`.

### 17.4 Atomicity (SQLite + persistence)

* **SQLite level** — outer `SAVEPOINT wiz_adm_apply`. `importJSONL` runs its own `BEGIN/COMMIT/ROLLBACK`; it is
  called with `_nestedTxDb(db)`, a Proxy that maps exactly those three statements to `SAVEPOINT / RELEASE /
  ROLLBACK TO wiz_ref_import` (any other transaction statement throws). The importer code is unchanged. Import +
  exact-effect check (`_verifyEffect`: only the planned rows added/changed, no existing relation or pin changed,
  sources/meta/FTS as planned, new version ids really new, archived versions verbatim) + review UPDATE (must
  modify exactly 1 row) + action INSERT either all `RELEASE` together or all `ROLLBACK TO wiz_adm_apply` →
  `FAILED` (`rolled_back`, `reference_unchanged` reported). Importer validation failures write nothing (its
  phase 1 is read-only).
* **Persistence level** (`applyPersisted` / `dismissPersisted`, used by the UI) — **revised in step 2 rev 1 (§18)**:
  the candidate database stays isolated until it is durable and becomes live only in a synchronous
  check-and-swap; concurrent writes are carried into a rebuilt candidate, never dropped. The step-2 version
  (swap first, then save, swap back on failure) could lose or leave unsaved an unrelated write (P1-S2-PERSIST-RACE)
  and is gone.
* A module-level lock makes the browser Prepare (incl. its save), Apply and Dismiss mutually exclusive
  (`REFUSED BUSY` / "in progress").

### 17.5 DISMISS semantics

Only from `AWAITING_REVIEW`. Inside `SAVEPOINT wiz_adm_dismiss`: `review_state='DISMISSED'`, `reviewed_at`, action
row with the optional reason (≤ 2000 chars). WizRef is never called; the `wiz_ref*` snapshot must be identical
before/after (else rollback). Terminal → `REFUSED ALREADY_TERMINAL`, no write.

### 17.6 Review record / history

The prepared packet (`packet_json`, `write_plan_json`, `incoming_json`, seal) is **never rewritten** — it shows what
was proposed THEN. What happened NOW is in `wiz_admission_actions` (`action_id, review_id, action APPLY|DISMISS,
requested_at, result APPLIED|DISMISSED|REFUSED|STALE_REVIEW|INTEGRITY_FAILED|FAILED, review_state_after,
result_json`) plus `review_state` / `reviewed_at` on the review row. Failed / stale / refused non-terminal attempts
are recorded; terminal-state refusals and UI-gate refusals write nothing. `getReview()` returns `actions` and
`last_action`.

### 17.7 Authority boundary (closed invariant, unchanged)

USER_INTERACTION ≠ USER_AUTHORITY · PREPARE ≠ APPLY · APPLY ≠ AUTHORSHIP · APPLY ≠ USER_DECISION · APPLY ≠
VERIFIED. An Apply / Dismiss click mints only a `USER_INTERACTION` token (`via: ui-click:#wizAdmApplyBtn` /
`#wizAdmDismissBtn`); in the browser it is the **human gate** (script calls, dispatched clicks, direct
`WizAdmission.apply/dismiss` without a genuine click → `REFUSED USER_INTERACTION_REQUIRED`), never authority. The
browser has no path to an authority token (`hostCallerContext` is node-only). Apply keeps the incoming
`epistemic_state` verbatim and never writes USER_DECISION / VERIFIED on its own. `authority_used` in the result is
`NONE — Apply executes the shown plan only` unless a plan-required host token was presented.

### 17.8 UI

`#wizAdmPendingSelect` (show a stored review), `#wizAdmApplyBtn` "Apply shown plan", `#wizAdmDismissBtn`
"Dismiss" + `#wizAdmDismissReason`, `#wizAdmActionResult`. Apply acts on the review currently shown and passes its
`packet_sha256`. `CACHE_NAME` → `…-admission4`.

### 17.9 Every place Apply can write `wiz_ref_*`

Single path: `apply()` / `applyPersisted()` → `_applyTx()` → `W.importJSONL(_nestedTxDb(db), …)` (the only
`importJSONL` call site in the module; test `zw-static` enforces exactly one, inside `_applyTx`). The proxy only
forwards the importer's statements. `applyPersisted` additionally swaps the whole DB object (`host.setDb`) and
persists it — since §18: `host.persistBytes` (candidate bytes → IndexedDB) before `host.setDb(work)`, then
`host.persist` (= `_wizSaveDBAsync`, saves the live DB). These move the already-imported copy; they create no new
`wiz_ref` content. The module contains no `INSERT/UPDATE/DELETE/ALTER … wiz_ref*` statement.

### 17.10 Tests (step 2)

DB: `S2-A` (valid ADD_ITEM via NEW_RELATED_ITEM) · `S2-B` A5 REFINEMENT · `S2-C` A8 STATUS_CHANGE · `S2-D` A6/A7
CONTRADICTION / NEW_EVIDENCE / NEW_RELATED_ITEM · `S2-E` A4 DUPLICATE · `S2-F` OUT_OF_SCOPE / UNCERTAIN refused ·
`S2-G` A9 Dismiss zero-write · `S2-H` A12 stale plan · `S2-I` tamper · `S2-J` A14 terminal states / double
invocation · `S2-K` A15 atomicity (importer / review-update / persistence failure) · `S2-L` authority boundary.
Browser: `B6` gate + authority · `B7` genuine Apply + reload + independent reads · `B8` Dismiss + reload · `B9`
stale in the page.

### 17.11 Judgment calls (step 2, flagged)

* SPEC.md lists A4–A9 / A12 / A14 / A15 without definitions; the mapping above is inferred.
* `_nestedTxDb` remaps the importer's own BEGIN/COMMIT/ROLLBACK to a nested savepoint (importer code unchanged);
  needed so import + review update commit together.
* The fingerprint precondition is strict and global: applying (or any import) makes every other pending review
  stale → re-prepare. Conservative by design.
* The importer updates its bookkeeping meta keys (`seed_id`, `seed_version`, `seed.wiz-admission`,
  `last_import_at`, …) — allowed and checked explicitly.
* The enum has no standalone ADD_ITEM outcome (UNCERTAIN since step 1), so "Apply valid ADD_ITEM" is tested with
  NEW_RELATED_ITEM (ADD_ITEM + ADD_RELATION).
* The seal detects inconsistency / tampering of the staged row, not an attacker with full DB write access (who
  could recompute it).
* In the browser Apply/Dismiss require a genuine click (a node host may call them directly — it owns that
  boundary).
* (Superseded by §18) the step-2 copy-then-swap persistence had a race with unrelated writes; fixed in step 2
  rev 1.
* Existing sources are never revised by admission; a status-change version carries the base version's capture
  provenance.
* Relation / target deletion can't be exercised: Reference Memory never deletes; "target missing" is covered by
  the check code and by collision / non-current / fingerprint cases.

## 18. Step 2 revision 1 (PR #10 @ 2b70ed4) — P1-S2-PERSIST-RACE

**Finding.** In the step-2 `_durable()` the applied copy became `window._wizDB` *before* it was durable
(`setDb(work)` → `await persist()` → swap back on failure). `_wizSaveDBAsync()` exports at call start and then
awaits IndexedDB, so an unrelated write could (A) land after the export and be live but not in the saved image, or
(B) land in the copy and be dropped by the swap back. Required invariant: **no unrelated DB write may be lost or
become live-but-not-durable because of an admission Apply/Dismiss.**

### 18.1 How the app writes and saves (investigated before changing anything)

* Every app writer is **synchronous** on `window._wizDB`, read at call time: `wizMemAdd / wizMemDelete /
  wizMemSetState / wizMemAccess / wizConsolidateL2 / wizDecayTick / wizNotesReindex / _wizInitMemSchema`
  (`index.html`), followed by the fire-and-forget `_wizSaveDB()` (export at call → `_wizIDBSet` put). Reference
  Memory (`wizRefImportJSONL`, `wizRefClearAll`) writes synchronously (the importer's BEGIN…COMMIT contains no
  await) and saves with the awaitable `_wizSaveDBAsync()`. Admission Prepare's staging transaction is synchronous
  too. No app code keeps a transaction open across an `await` (grep: BEGIN/COMMIT in index.html, the importer and
  this module).
* All saves write the whole image under one IndexedDB key (`wiz_lab_mem_store` / `kv` / `wiz_lab_sqlite_db`).
  IndexedDB processes open requests for one database in order and runs overlapping read-write transactions in
  creation order, so a save requested later commits later.
* Consequence: a correct fix does **not** need an application-wide persistence redesign and does not change any
  app writer or save function. `index.html` and `wiz-ref-memory.js` are unchanged by this revision.

### 18.2 The mechanism (`_durable`, `persistBytes`)

1. `base = live.export()`; `work = copy(base)`; the action (`_applyTx` / `_dismissTx`, unchanged) runs on `work`.
   `live` is never touched by the action and keeps receiving app writes.
2. If `live` changed during the action (byte comparison with `base`) → discard `work`, **rebase** (start again from
   the current live; the stale guard re-runs, so a concurrent `wiz_ref` change turns into `STALE_REVIEW`).
3. `host.persistBytes(work.export(), stillValid)` writes the **candidate** to IndexedDB without touching
   `window._wizDB`. In the put's success callback it runs `stillValid()` (live still identical to `base`) and
   **aborts the IndexedDB transaction** if not (`CONCURRENT_ABORT`, nothing stored) → rebase. After `oncomplete`
   the stored bytes are read back byte-for-byte (`VERIFY_FAILED` otherwise).
4. After the verified write, in one synchronous step (no `await` between — asserted by a static test):
   `stillValid()` → `setDb(work)` → close the old object. Because JS is single-threaded, no write can land between
   the check and the swap; every write before the check is in `base` and therefore in the stored candidate; every
   write after the swap goes to the new live DB and is saved by the writer's own save. Then one more ordinary
   `host.persist()` of the new live DB is requested; being requested last it commits last, superseding any save
   that was requested during the window with pre-swap bytes.
   If live changed after the candidate committed but before the swap → **rebase**: the next candidate is built on
   the new live DB (it carries the concurrent write) and overwrites the stored one.
5. Candidate write fails, or the DB keeps changing for `DURABLE_MAX_ATTEMPTS` (4) attempts → `work` discarded; the
   failure is recorded on the **live** DB and the live DB is saved (`host.persist`), which also overwrites a
   candidate stored by an earlier attempt. Result `FAILED PERSIST_FAILED` / `CONCURRENT_WRITES`, review stays
   `AWAITING_REVIEW`, `durable_state = LIVE_SAVED`.
6. The old live object is **closed** after the swap: a writer still holding it fails loudly ("database closed")
   instead of writing into a detached DB that would silently never be saved.
7. The module lock covers browser Prepare+save, Apply and Dismiss (Prepare holds `window._wizDB` across awaits).

Results carry `attempts` (e.g. `CONCURRENT_WRITE_DURING_PERSIST → DURABLE_THEN_LIVE`), `durable_state`
(`CANDIDATE_DURABLE_AND_LIVE` / `LIVE_SAVED` / `PREVIOUS_SAVED_STATE` / `UNKNOWN_CANDIDATE_MAY_BE_DURABLE`) and
`post_swap_save`. Exactly-once: attempts never touch `live`; only the successful attempt's database becomes live;
after it the review is terminal, and a retry is `ALREADY_TERMINAL`.

### 18.3 What it covers — and what it does not

Covered: every writer that mutates `window._wizDB` read at call time and synchronously — all app memory functions,
notes FTS, Reference Memory import/clear, admission Prepare — whether it saves with `_wizSaveDB`,
`_wizSaveDBAsync`, or not at all (a non-saving write present at the swap is in the candidate and thus stored).

Not covered / residual (reported, not hidden):
* A writer that captured the DB object *before* the swap and writes *after* it (only possible across an `await`;
  in current code: `wizRefImportJSONL` awaits a hash between capturing `db()` and writing). It now fails loudly on
  the closed object (the import promise rejects with "Database closed", nothing is written or persisted); it is
  not transparently redirected and must be retried (browser regression test `B13`, P2 cleanup).
* Code that replaces `window._wizDB` itself during the action → `FAILED DATABASE_REPLACED` (nothing applied).
* A candidate that was committed and then raced (live changed after the commit) is on disk until the next
  candidate or the live save overwrites it. If **every** later IndexedDB write fails, the stored image may keep the
  candidate (admission applied, without the unrelated write) while live has the write but not the admission: the
  result says `durable_state = UNKNOWN_CANDIDATE_MAY_BE_DURABLE` (test `S2-P5`). This needs an IndexedDB write
  failure directly after a successful one.
* A tab closed/crashed in the middle of steps 3–5 can leave either the previous image or the candidate on disk
  (each a consistent snapshot); the app's own fire-and-forget saves have the same exposure.
* The pre-existing `_wizSaveDB` behaviour (§10, `REFERENCE_MEMORY.md` §4b) is unchanged: a fire-and-forget save can
  still fail silently for its own write. That is not caused by admission and is out of scope.
* The candidate write duplicates the IndexedDB name/store/key constants of `index.html` (kept in sync by test).

### 18.4 Tests

DB (real app memory block, the app's `wizMemAdd` as the unrelated writer, injectable candidate-write host):
`S2-P1` success with an unrelated write during the async apply phase / while the candidate write is in flight /
after the candidate commit before the swap → rebased, APPLIED once, write kept, live ≡ stored image ≡ reload,
retry `ALREADY_TERMINAL`, old object closed · `S2-P2` failed candidate write (before commit / stored-then-verify
failure) + unrelated write → not applied anywhere, write kept, live ≡ stored ≡ reload, retry applies once ·
`S2-P3` continuous writes → `CONCURRENT_WRITES`, all writes kept, stored candidate overwritten by the live save ·
`S2-P4` Dismiss through the same path (race + failure) · `S2-P5` residual reported as
`UNKNOWN_CANDIDATE_MAY_BE_DURABLE`; lock → `BUSY`; static: no `await` between check and swap. Browser (real
IndexedDB; the hook runs `wizMemAdd` inside the admission's candidate put): `B10` race → rebased, APPLIED once, live
≡ IndexedDB image, reload · `B11` candidate write fails + race → `PERSIST_FAILED`, write kept, reload, retry applies
once · `B12` Dismiss + race. `CACHE_NAME` → `…-admission5`.


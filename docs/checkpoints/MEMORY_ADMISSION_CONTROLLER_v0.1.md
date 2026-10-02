# Memory Admission Controller v0.1 — bounded lab result

> **FROZEN CHECKPOINT.** This document describes the code at
> **`e286c50aed03a7cd1956d36fc5b216f2f15ea81d`** (branch `lab/memory-admission-review-v0.1`, PR #10, DRAFT, not
> merged). The commit that adds this file is **docs-only** (`git diff --stat e286c50..<checkpoint commit>` lists
> only `docs/` files). Later commits do not update this file; a new result gets a new checkpoint.
>
> **NOT CANON · NOT RUNTIME AUTHORIZATION · NOT AUTOMATIC ADMISSION · NOT A GLOBAL MEMORY OWNER · NOT THE
> SOLUTION TO MEANING / RELEVANCE / COGNITIVE STATE.** A bounded, human-gated review layer over the lab's SQLite
> Reference Memory. Synthetic fixtures only; no private content.

Base: `main@2bad54791b715636043da6725b1685774db1829b`. Untouched by this work: `main`, PR #6
(`exp/e0a-memory-governance@c36c5bc`), PR #7 (`exp/e0b-typing-reliability@0becc65`), `wiz-ref-memory.js`,
`wiz_facts`. Full design: [`../MEMORY_ADMISSION_REVIEW.md`](../MEMORY_ADMISSION_REVIEW.md).

## Audit history

| Stage | Head audited | Verdict (by the user's live audit) |
|---|---|---|
| Step 1 — Prepare (review packets, zero writes to `wiz_ref_*`) | audit rev 1 fixes after `0342c93`; rev 2 after `a434561`; accepted at `1641d1d` | **P1-1, P1-2, P1-3, P1-3b PASS / CLOSED**; Step 1 accepted |
| Step 2 — Apply / Dismiss | `2b70ed4` | SQLite level accepted; one P1 open: P1-S2-PERSIST-RACE → REVISE |
| Step 2 rev 1 — P1-S2-PERSIST-RACE | `fbdbf7d` | **P1-S2-PERSIST-RACE PASS / CLOSED**; **Step 2 accepted at code-audit level** |
| P2 cleanup (lock comment, ui/sw test text, stale-DB-writer regression `B13`) | `e286c50` (this checkpoint) | awaiting final audit |

## (a) What was implemented

* `wiz-memory-admission.js` (new module), `🧠 Admission review` card in `index.html` (one script tag, one guarded
  schema hook, card markup, one render call), `sw.js` asset + `CACHE_NAME …-admission5`, lab tables
  `wiz_admission_reviews` (+ `packet_sha256`) and `wiz_admission_actions`.
* **Prepare** (`prepare`): validates a memory passport (WHAT, SOURCE, WHO, WHEN, SCOPE, TYPE, STATUS, PROVENANCE;
  mode REVIEW only), retrieves candidates with its own read-only SQL (no WizRef db function is called), decides one
  of a closed, frozen enum of 8 outcomes deterministically (`DUPLICATE, REFINEMENT, NEW_EVIDENCE, CONTRADICTION,
  NEW_RELATED_ITEM, STATUS_CHANGE, OUT_OF_SCOPE, UNCERTAIN`; anything not deterministic → `UNCERTAIN`), builds a
  review packet with an executable write plan (exact import records, preconditions, expected effect, required
  authority), seals it (`packet_sha256`) and stages it as `AWAITING_REVIEW`. Read phase under `PRAGMA query_only`
  inside an always-rolled-back savepoint, with `wiz_ref*` snapshot checks.
* **Apply** (`apply` / `applyPersisted`): only from `AWAITING_REVIEW`; tamper check against the seal and the packet
  shown in the UI; refuses unresolved plans; plan-required semantic authority only from a host authority token;
  stale-plan guard; exactly one `WizRef.importJSONL` call with the stored records inside one outer savepoint (the
  importer's BEGIN/COMMIT/ROLLBACK mapped to a nested savepoint by a proxy); exact-effect verification; review →
  `APPLIED` + `reviewed_at` + action record, all committed or rolled back together.
* **Dismiss** (`dismiss` / `dismissPersisted`): only from `AWAITING_REVIEW`; zero writes to `wiz_ref_*`; review →
  `DISMISSED` + `reviewed_at` + optional reason in the action record.
* **Durable path** (browser): the action runs on an isolated copy; the candidate is written to IndexedDB first
  (the put aborts if the live DB changed before commit); after the verified write, check-and-swap is one
  synchronous step; any concurrent change → the candidate is rebuilt on the new live DB (max 4 attempts); on
  failure the live DB (with every unrelated write) is saved with the failure record; the old DB object is closed.
  A module lock makes browser Prepare(+save), Apply and Dismiss mutually exclusive.
* **UI**: passport field, `Prepare review`, pending-review selector, `Apply shown plan`, `Dismiss` (+ reason),
  packet and action-result views (`textContent` only). Apply/Dismiss in the browser require a genuine click on that
  button. No Auto-approve / Apply-all, no agent tool, no context injection.

## (b) What was tested (at `e286c50`, raw outputs kept outside the repo)

| Suite | Result at `e286c50` | Asserts |
|---|---|---|
| `tests/admission/db.test.cjs` | **38/38** | Step 1: `enum` (8 frozen outcomes = CHECK, REVIEW only, no auto APIs), `zw-static` (no `wiz_ref` write SQL; exactly one `importJSONL` call site, inside `_applyTx`), `zw-trace` (runtime SQL trace of prepare), `ro-legacy` / `ro-fts` / `ro-inject` (legacy / repair-needing DBs never touched, injected writes refused), `schema` (additive, idempotent migration), `A1` `A2` `A3` `A10` `A11` (prepare outcomes, SIMILAR ≠ DUPLICATE, strict DUPLICATE identity, scope, ambiguity), `P1-3` / `P1-3b` (authority spoof, interaction ≠ authority), `passport`, `HR` (hard rules), `WP` (write plans), `iso` (staging invisible to search), `persist`, `noref`. Step 2: `S2-A` ADD_ITEM (via NEW_RELATED_ITEM) exact write · `S2-B` REFINEMENT new immutable version, old preserved, pins kept · `S2-C` STATUS_CHANGE with host token, pins kept, refused without · `S2-D` CONTRADICTION / NEW_EVIDENCE / NEW_RELATED_ITEM exact relations only · `S2-E` DUPLICATE no write · `S2-F` OUT_OF_SCOPE / UNCERTAIN refused · `S2-G` Dismiss zero-write · `S2-H` stale plan (4 kinds) · `S2-I` tamper · `S2-J` terminal states / double invocation · `S2-K` injected importer / review-update / persistence failure → rollback, retry once · `S2-L` authority boundary. Rev 1: `S2-P1`…`S2-P5` unrelated app write (`wizMemAdd`) during apply phase / candidate write / after commit, failed candidate writes, continuous writes, Dismiss, residual reporting, lock, static no-await check-and-swap. `ui/sw` (asset cached, `CACHE_NAME` = admission5, rejects admission1–4). |
| `tests/admission/browser.test.mjs` | **13/13** | `B1` boot, 0 new page errors vs main · `B2`/`B3` genuine Prepare → persisted, reload, no leak · `B4` invalid passport, exact controls · `B5` interaction ≠ authority · `B6` Apply/Dismiss human gate; genuine click gives no USER authority · `B7` genuine Apply → APPLIED, reload, ref_search/ref_trace/IndexedDB · `B8` Dismiss + reload · `B9` stale in page · `B10` Apply + concurrent app write during candidate write → rebased, applied once, live ≡ IndexedDB, reload · `B11` failed candidate write + concurrent write → not applied, write kept, retry once · `B12` Dismiss + race · `B13` stale-DB writer: paused `wizRefImportJSONL` + genuine Apply → import rejects "Database closed", new live `wiz_ref_*` unchanged, IndexedDB ≡ post-Apply live, no import rows after reload, retry commits once. |
| `tests/refmem/db.test.cjs` | **36/36** | existing Reference Memory regression (unchanged suite) |
| `tests/refmem/browser.test.mjs` | **10/10** | existing Reference Memory browser regression (unchanged suite) |
| `tests/refmem/scan-private.sh` (+ PR body/title via `EXTRA_FILES`) | **PASS, 0 private hits** | private ids / titles / URLs across commits, messages, diff, tracked files |

## (c) What was only locally reported (not independently verified by the user's live audit or CI)

* All suite runs above were executed by the implementing agent on its own environment (Node 20.19.2,
  puppeteer-core 23.11.1, Google Chrome 151, headless, `python3 -m http.server`); there is no CI for this branch.
  Browser runs are timing-sensitive in principle; they were repeated (B10–B13 passed on 3+ consecutive runs locally).
* The "every `wiz_ref_*` write location" and "every locking/serialization location" lists are grep results reported
  by the agent (file:function:line at the audited heads), not tool-enforced beyond the `zw-static` test.
* The app-writer inventory behind the persistence fix (all app writers synchronous on `window._wizDB`, no
  transaction open across an `await`) is a code reading of `index.html`, `wiz-ref-memory.js` and this module.
* The ordering argument relies on the IndexedDB specification (opens for one database processed in order;
  overlapping read-write transactions run in creation order) as implemented by the tested Chrome; not verified on
  other browsers.
* The mapping of SPEC ids A4–A9 / A12 / A14 / A15 to tests is inferred (SPEC lists the ids without definitions).
* Private-scan results depend on the local private id/title lists, which are not in the repo.

## (d) Invariants established

MEMORY ≠ TRUTH · LLM OUTPUT ≠ MEMORY DECISION · NEW INFORMATION ≠ NEW MEMORY · SIMILAR ≠ SAME (similarity only
ranks; DUPLICATE needs exact identity or trusted declared equivalence) · RELATION ≠ TRUTH · USER SAID X ≠ X IS TRUE ·
USER_INTERACTION ≠ USER_AUTHORITY · PREPARE ≠ APPLY · APPLY ≠ AUTHORSHIP · APPLY ≠ USER_DECISION · APPLY ≠ VERIFIED
(an Apply click means only "execute exactly this shown write plan"; plan-required authority only via a host token;
no browser path to an authority token) · REVIEW mode only, no automatic admission · single reference write path
(`_applyTx` → one `WizRef.importJSONL`) · sealed packet (tamper → `INTEGRITY_FAILED`) · stale-plan guard (any
reference change since Prepare → `STALE_REVIEW` / re-prepare; Apply never recomputes) · immutable history (packet
never rewritten; actions in a separate table; versions immutable, historical relation pins never move) · terminal
states never reversed; exactly-once Apply · Dismiss writes nothing to `wiz_ref_*` · SQLite-atomic Apply · **no
unrelated DB write is lost or left live-but-not-saved because of an admission Apply/Dismiss** (for writers using
`window._wizDB` at call time; limits below).

## (e) Known residual limitations

* Change detection compares whole-database bytes (one export per check) — fine at lab sizes, not built to scale.
* Durable path gives up after 4 attempts under continuous writes (`CONCURRENT_WRITES`, nothing applied).
* IndexedDB name/store/key are duplicated from `index.html` (kept in sync by a test).
* A writer holding the old DB object across an `await` (currently `wizRefImportJSONL`) fails loudly ("Database
  closed") after an Apply swap and must be retried; it is not redirected (`B13`).
* If a stored candidate raced a write and every later IndexedDB write fails, the stored image may hold the candidate:
  reported as `durable_state = UNKNOWN_CANDIDATE_MAY_BE_DURABLE`, not prevented.
* A tab crash mid-commit leaves one consistent snapshot (previous image or candidate).
* The app's fire-and-forget `_wizSaveDB` can still fail silently for its own write (pre-existing, not caused by
  admission).
* `packet_sha256` detects inconsistency / tampering of the staged row, not an attacker with DB write access.
* The fingerprint precondition is strict and global: any apply or import makes other pending reviews stale.
* No standalone ADD_ITEM outcome (the enum has none; such input is `UNCERTAIN`).
* The host authority seam (`hostCallerContext`, non-DOM only) is unauthenticated; a real host must own that boundary.
* Existing sources are never revised by admission; a status-change version carries the base version's capture
  provenance.
* Relation/target deletion is untestable (Reference Memory never deletes).
* A4–A15 mapping inferred; all test evidence local (see (c)).
* Not addressed at all (out of scope): Meaning Extraction, relevance scoring, active-goal inference, forgetting,
  consolidation, Retrieval Controller, context injection, Cognitive State / Understanding layer, E0-A/E0-B merge.

## Boundary

```
ADMISSION_MODE = REVIEW
AUTO ADMISSION = NO
REFERENCE WRITES = ONLY BY EXPLICIT HUMAN APPLY OF THE SHOWN PLAN, VIA WizRef.importJSONL
APPLY = USER_INTERACTION ONLY (NOT USER_DECISION, NOT VERIFIED, NOT AUTHORITY)
LLM COMMIT AUTHORITY = NO
AUTO EPISTEMIC PROMOTION = NO
PRIVATE CORPUS BUILT = NO
PRIVATE SOURCES READ = NO
PRIVATE CONTENT COMMITTED = NO
PERSONAL MEMORY ALTERED = NO
wiz_facts ALTERED = NO
PR #6 ALTERED = NO
PR #7 ALTERED = NO
REFERENCE MEMORY BYPASSED = NO
AUTO CONTEXT INJECTION = NO
RUNTIME AUTHORITY CHANGE = NO
CANON CHANGE = NO
GLOBAL OWNER CLAIM = NO
```

**FROZEN** — describes code at `e286c50aed03a7cd1956d36fc5b216f2f15ea81d`.

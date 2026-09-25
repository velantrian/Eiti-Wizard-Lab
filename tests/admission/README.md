# Admission-review tests (Memory Admission Controller v0.1, REVIEW mode — step 1 Prepare + step 2 Apply/Dismiss)

All fixtures in `fixtures/` are **synthetic** (`[SYNTHETIC FIXTURE] …`, surface `fixture`, project
`demo-project-adm`). No private corpus, no Notion/Drive ids, no handoff text as source facts.

* `fixtures/synthetic.reference-base.fixture.jsonl` — a small Reference Memory bundle (imported through
  `WizRef.importJSONL` as test setup).
* `fixtures/synthetic.duplicate-target.fixture.jsonl` — one synthetic item with capture provenance
  (source revision/as_of, provenance JSON) used as the DUPLICATE identity target (audit rev 1).
* `fixtures/synthetic.incoming.fixture.json` — incoming memory passports (valid, similar, exact duplicate of the
  duplicate target, out of scope, ambiguous).

## Commands (from the repo root)

```bash
node tests/admission/db.test.cjs
git archive origin/main | (mkdir -p /tmp/adm-main && tar -x -C /tmp/adm-main)
PUPPETEER_CORE=/tmp/pup/node_modules/puppeteer-core CHROME_PATH=/usr/bin/google-chrome \
  ADM_PORT=18801 MAIN_ROOT=/tmp/adm-main node tests/admission/browser.test.mjs
# existing suites must keep passing
node tests/refmem/db.test.cjs
PUPPETEER_CORE=… MAIN_ROOT=/tmp/adm-main node tests/refmem/browser.test.mjs
PRIVATE_IDS=/local/ids.txt PRIVATE_TITLES=/local/titles.txt EXTRA_FILES=/local/pr-body.md BASE=origin/main \
  bash tests/refmem/scan-private.sh
```

Same tested environment as `tests/refmem/README.md` (Node 20, puppeteer-core 23.11.1, Chrome, python3).

## Test map

DB suite (`db.test.cjs`, real modules + memory block from `index.html` on the repo sql-wasm):
`enum` (exactly 8 frozen outcomes = staging CHECK; REVIEW only; apply/dismiss(+Persisted) only, no autoAdmit/applyAll/approve; action results = CHECK) · `zw-static` (no wiz_ref
write statement; exactly one `W.importJSONL` call site, inside `_applyTx`; prepare / dismiss / getReview / buildPlan call no WizRef db function; no call of ANY WizRef function that takes a db — they all reach `WizRef.initSchema`; `db.run`
whitelist) · `zw-trace` (runtime: all SQL during prepare is SELECT/PRAGMA/savepoint except the staging INSERT;
WizRef db functions trapped) · `ro-legacy` (P1-1a: v2 DB unchanged incl. schema_version/pins/FTS; UNCERTAIN +
needs-migration warning) · `ro-fts` (P1-1b: missing FTS row not repaired) · `ro-inject` (P1-1c: injected write →
throws, no staged row, DB unchanged) · `schema` (additive migration of a DB created by main, idempotent, CHECK
constraints) · **A1** (valid prepare: independent wiz_ref dump + fingerprint unchanged, AWAITING_REVIEW) · **A2**
(similar ≠ duplicate → UNCERTAIN) · **A3** (P1-2: exact ITEM_ID + compatible content → DUPLICATE; identical text
without ITEM_ID → UNCERTAIN; differing WHEN / PROVENANCE / source revision / as_of / content_hash / source / status
→ not DUPLICATE; apply half in `S2-E`) · `P1-3` (authority spoof: declared_by / authority need a
matching trusted caller context and non-model WHO) · `P1-3b` (USER_INTERACTION ≠ USER_AUTHORITY) · **A10** (scope → OUT_OF_SCOPE) · **A11** (ambiguous
candidates → UNCERTAIN, nothing added) · `passport` (invalid/non-REVIEW → nothing staged, DB byte-identical) ·
`HR` (hard rules block) · `WP` (declarative write plans; random, non-content-derived new-item id; existing ITEM_ID
+ ADD_ITEM → UNCERTAIN) · `iso` (staging invisible to ref_search/mem_search, wiz_facts unchanged) · `persist`
(staged review survives save → reload) · `noref` · `ui/sw` (asset cached, CACHE_NAME `…-admission4`, Prepare/Apply/Dismiss buttons pass event, no auto-approve).

Step 2 (DB): **S2-A** valid ADD_ITEM (NEW_RELATED_ITEM) → exactly +1 item +1 pinned relation, APPLIED, packet
immutable · **S2-B** (A5) REFINEMENT → new immutable version, old preserved, relation stays pinned to the old
version · **S2-C** (A8) STATUS_CHANGE with host USER token → new version, pins unchanged; without token refused ·
**S2-D** (A6/A7) CONTRADICTION / NEW_EVIDENCE / NEW_RELATED_ITEM → exact declared relations only · **S2-E** (A4)
DUPLICATE → no reference write · **S2-F** OUT_OF_SCOPE / UNCERTAIN → REFUSED NO_EXECUTABLE_PLAN · **S2-G** (A9)
Dismiss → wiz_ref_* identical, DISMISSED + reason · **S2-H** (A12) stale (unrelated import / target revised /
from_status changed / id collision) → STALE_REVIEW + REPREPARE_REQUIRED, no write; fresh prepare applies · **S2-I**
tampered packet / write_plan / missing seal / shown-packet mismatch → INTEGRITY_FAILED · **S2-J** (A14) double
apply / apply-after-dismiss / dismiss-after-apply / concurrent → no duplicates, no reversal · **S2-K** (A15)
injected importer failure / review-update failure / persistence failure → full rollback, not APPLIED, retry once
· **S2-L** USER_INTERACTION-only Apply never supplies USER authority. (A4–A15 mapping inferred — SPEC.md lists the
ids without definitions.)

Browser suite (`browser.test.mjs`): **B1** boot (0 new page errors vs main, REVIEW-only API) · **B2** genuine UI
activation of Prepare → `USER_INTERACTION` recorded, semantic authority NONE, packet (UNCERTAIN, AWAITING_REVIEW,
write plan), verified persist, wiz_ref_* + personal memory unchanged, independent IndexedDB read-back · **B3**
reload → pending review present, no ref item, Reference UI + ref_search + mem_add/mem_search work, no leak · **B4**
invalid passport rejected; controls exactly Prepare / Apply shown plan / Dismiss (no Auto-approve) · **B5** (P1-3/P1-3b) script call / forged event /
dispatched click / wrapper with caller → no interaction, UNTRUSTED; genuine activation → USER_INTERACTION but NOT
authority: EQUIVALENT_TO declared_by=USER, STATUS USER_DECISION, PROPOSED_STATUS_CHANGE.authority=USER all stay
UNCERTAIN; `hostCallerContext` / `hostInteractionContext` absent in the browser. **B6** Apply/Dismiss
gate: script / dispatched click / direct API (forged interaction, caller USER) → REFUSED USER_INTERACTION_REQUIRED;
genuine Apply click on a plan needing USER authority → REFUSED, interaction USER_INTERACTION, authority NONE ·
**B7** genuine Prepare + genuine Apply → APPLIED + persisted, exact +1/+1, double Apply refused; reload → APPLIED,
readable via ref_search / ref_trace / fresh IndexedDB read · **B8** genuine Dismiss (+reason) → DISMISSED, wiz_ref_*
identical, Apply/Dismiss after refused; survives reload · **B9** stale in the page → STALE_REVIEW, no write, survives
reload; fresh prepare applies.

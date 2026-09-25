# Admission-review tests (Memory Admission Controller v0.1, REVIEW mode — step 1 of 2)

All fixtures in `fixtures/` are **synthetic** (`[SYNTHETIC FIXTURE] …`, surface `fixture`, project
`demo-project-adm`). No private corpus, no Notion/Drive ids, no handoff text as source facts.

* `fixtures/synthetic.reference-base.fixture.jsonl` — a small Reference Memory bundle (imported through
  `WizRef.importJSONL` as test setup).
* `fixtures/synthetic.incoming.fixture.json` — incoming memory passports (valid, similar, exact duplicate,
  out of scope, ambiguous).

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
`enum` (exactly 8 frozen outcomes = staging CHECK; REVIEW only; no apply/dismiss) · `zw-static` (no wiz_ref
write statement, only WizRef.search/trace/sha256Hex used) · `schema` (additive migration of a DB created by main,
idempotent, CHECK constraints) · **A1** (valid prepare: independent wiz_ref dump + fingerprint unchanged,
AWAITING_REVIEW) · **A2** (similar ≠ duplicate → UNCERTAIN) · **A3** (exact identity/content → DUPLICATE; declared
equivalence by USER → DUPLICATE, by MODEL → not; *apply half deferred to step 2*) · **A10** (scope →
OUT_OF_SCOPE) · **A11** (ambiguous candidates → UNCERTAIN, nothing added) · `passport` (invalid/non-REVIEW → nothing
staged, DB byte-identical) · `HR` (hard rules block) · `WP` (declarative write plans) · `iso` (staging invisible to
ref_search/mem_search, wiz_facts unchanged) · `persist` (staged review survives save → reload) · `ui/sw`.

Browser suite (`browser.test.mjs`): **B1** boot (0 new page errors vs main, REVIEW-only API) · **B2** UI Prepare →
packet (UNCERTAIN, AWAITING_REVIEW, write plan), verified persist, wiz_ref_* + personal memory unchanged,
independent IndexedDB read-back · **B3** reload → pending review present, no ref item, Reference UI + ref_search +
mem_add/mem_search work, no leak · **B4** invalid passport rejected; no Apply/Dismiss/Auto-approve controls.

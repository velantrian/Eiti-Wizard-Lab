# Reference-memory tests (`wiz_ref_*`)

All fixtures in `fixtures/` (and records built inline in the tests) are **synthetic** (surface `fixture`,
titles `[SYNTHETIC FIXTURE] …`, projects `demo-project-*`). They are not Velantrim corpus.

## Tested environment (audit revisions 1–2)

| Component | Version / expectation |
|---|---|
| Node.js | v20.19.2 (≥ 18 needed: global `fetch`, `crypto.subtle`) |
| puppeteer-core | **23.11.1** (not vendored; install anywhere, e.g. `npm i --prefix /tmp/pup puppeteer-core@23.11.1`) |
| Chrome | Google Chrome **151.0.7922.169**, path via `CHROME_PATH` (default `/usr/bin/google-chrome`); any recent Chrome/Chromium with `--headless=new` should work |
| python3 | used as the static server (`python3 -m http.server`) |
| Port | `REFMEM_PORT` (default **18791**; the main baseline uses port+1) |

The app itself stays zero-dependency: there is no `package.json`.

## Commands (from the repo root)

```bash
# 1) DB-level suite — real wiz-ref-memory.js + memory block extracted from index.html, repo sql-wasm
node tests/refmem/db.test.cjs

# 2) Browser suite — real page, real IndexedDB, real UI (MAIN_ROOT optional: page-error baseline vs main)
git archive origin/main | (mkdir -p /tmp/refmem-main && tar -x -C /tmp/refmem-main)
PUPPETEER_CORE=/tmp/pup/node_modules/puppeteer-core CHROME_PATH=/usr/bin/google-chrome \
  REFMEM_PORT=18791 MAIN_ROOT=/tmp/refmem-main node tests/refmem/browser.test.mjs

# 3) Private-boundary scan (#14) — pattern files are LOCAL ONLY, never committed
PRIVATE_IDS=/local/private-ids.txt PRIVATE_TITLES=/local/private-titles.txt BASE=origin/main \
  bash tests/refmem/scan-private.sh
```

## Acceptance-test mapping (spec §18)

1 boot (db + browser) · 2 wiz_facts (db) · 3 memory UI (browser) · 4 mem_add/mem_search/mem_validate
(db static+runtime, browser tools) · 5 import ≠ wiz_facts (db) · 6 reload persistence (db bytes + browser
IndexedDB, awaited ack + independent read-back) · 7 idempotency (db) · 8 “UNKNOWN FALSE” (db) · 9 “Atlas
truth” (db) · 10 “synergy” (db) · 11 historical status (db) · 12 page claim ≠ implementation evidence (db) ·
13 draft ≠ main state (db) · 14 private scan (script) · 15 decay non-effect (db + browser) · 16 separate
datasets (db + browser tools) · 17 bundle deletion persistence (db + browser UI upload) · 18 backup
round-trip without promotion (db + browser UI export).

Audit revision 1: P1-1a/b (all-or-nothing import), P1-2a/b/c (capture provenance, no retroactive promotion,
v1→v2 backfill), P1-3s (awaitable save, db) + browser #6/#17/P1-3f (ack, read-back, abort path),
P1-4a/b/c (relation idempotency, revision rejection, dangling endpoints), P2-1 (service worker).

Audit revision 2: P1-5a (item revision never retargets existing relations: R stays on X-v1 “A is UNKNOWN”,
R2 on X-v2 “A is SUPPORTED”; trace per version; no rebinding on re-import; re-pin rejected; export round-trip
preserves pins), P1-5b (bundle endpoint expression: logical id / archived id / explicit version id; unknown
or tampered version rejected), P1-5c (v2→v3 migration: pins backfilled to the version current at migration,
`pin_backfilled=1`, idempotent, not moved by a later revision), P2-h (db static + browser: exact byte +
SHA-256 read-back verification; same-length different bytes → IMPORT_PERSISTED = FALSE; ack sha256 equals
SHA-256 of the stored bytes in browser #17). Browser #16 checks `ref_trace` shows pinned versions; #18 compares
versions and relation pins across profiles.

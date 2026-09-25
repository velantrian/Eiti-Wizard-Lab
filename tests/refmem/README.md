# Reference-memory tests (`wiz_ref_*`)

All fixtures in `fixtures/` (and records built inline in the tests) are **synthetic** (surface `fixture`,
titles `[SYNTHETIC FIXTURE] …`, projects `demo-project-*`). They are not Velantrim corpus.

## Tested environment (audit revision 1)

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

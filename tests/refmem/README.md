# Reference-memory tests (`wiz_ref_*`)

All fixtures in `fixtures/` are **synthetic** (surface `fixture`, titles `[SYNTHETIC FIXTURE] …`,
projects `demo-project-*`). They are not Velantrim corpus.

| Suite | Command | Needs |
|---|---|---|
| DB-level (real `wiz-ref-memory.js` + memory block extracted from `index.html`, repo `sql-wasm`) | `node tests/refmem/db.test.cjs` | Node ≥ 18 |
| Browser (real page, real IndexedDB, real UI) | `PUPPETEER_CORE=/path/node_modules/puppeteer-core CHROME_PATH=/usr/bin/google-chrome MAIN_ROOT=/path/to/main-checkout node tests/refmem/browser.test.mjs` | Chrome, puppeteer-core (not vendored), python3 |
| Private boundary (#14) | `PRIVATE_IDS=/local/ids.txt PRIVATE_TITLES=/local/titles.txt BASE=origin/main bash tests/refmem/scan-private.sh` | git; pattern files stay local |

Acceptance-test mapping (spec §18): 1 boot (db + browser) · 2 wiz_facts (db) · 3 memory UI (browser) ·
4 mem_add/mem_search/mem_validate (db static+runtime, browser tools) · 5 import ≠ wiz_facts (db) ·
6 reload persistence (db bytes + browser IndexedDB) · 7 idempotency (db) · 8 “UNKNOWN FALSE” (db) ·
9 “Atlas truth” (db) · 10 “synergy” (db) · 11 historical status (db) · 12 page claim ≠ implementation
evidence (db) · 13 draft ≠ main state (db) · 14 private scan (script) · 15 decay non-effect (db + browser) ·
16 separate datasets (db + browser tools) · 17 bundle deletion persistence (db + browser UI upload) ·
18 backup round-trip without promotion (db + browser UI export).

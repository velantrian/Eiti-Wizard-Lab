# B1-DEVICE-01 — native test harness (TEST ONLY, NON PRODUCTION)

Why: the Eruda / bookmarklet route of B1-DEVICE STEP 1 does not start reliably on Android (Samsung Internet / Chrome). This harness is the same
STEP 1 behaviour as an on-page screen that works with taps only. It is a **device-test aid**, not part of the product: nothing on it is Canon,
runtime authority, or an agent capability.

## How to open

`index.html?b1device=1` (for example `https://velantrian.github.io/Eiti-Wizard-Lab/index.html?b1device=1`). Without exactly `?b1device=1` the page is
the normal app: a four-line inert gate in `index.html` loads `b1-device-harness.js` only for that query, so no harness script, DOM or request exists
otherwise. The harness file is **not** precached and `sw.js` / `CACHE_NAME` are untouched; the gate adds `?h=<first 12 hex of SHA-256 of the
harness file>` so a new harness build is a new URL and the service worker's cache-first rule can never serve a stale one (a unit test keeps `h` in sync).

## Screen

`B1-DEVICE TEST — NON PRODUCTION`, three buttons, a verdict badge and a selectable report:

| Button | Writes? | What it does |
|---|---|---|
| CHECK ENVIRONMENT | no | `window.WmStore` (+ `exportData` / `importJSON`), `WorkingMemory.EXPORT_FORMAT`, fixture self-check (raw SHA, SEED_HASH, LOGICAL hash of the embedded fixture), whether `wm_*` is empty, APP_VERSION, SW cache name / control, user agent. Badge `ENV_OK` / `ENV_FAIL`. |
| IMPORT FROZEN FIXTURE | **only `WmStore.importJSON`** | Aborts (before any write, `WRITE_ATTEMPTED = NO`) unless every `wm_*` data table is empty and the embedded fixture verifies. Imports the exact frozen fixture, then verifies counts, LOGICAL_EXPORT_HASH and SEED_HASH. Badge `IMPORT_PASS` / `IMPORT_FAIL`; a failed `importJSON` is shown verbatim (`code`, `rolledBack`, `persistenceState`) and is never reported as PASS. |
| RUN FINGERPRINT | no | STEP 1 fingerprint: `PASS` / `FAIL`, APP_VERSION, SW cache, counts, `work_id + status`, LOGICAL_EXPORT_HASH, SEED_HASH (and the expected values). Run it after the import and again after closing and reopening the page. |

## Frozen checkpoints (three DIFFERENT hashes — never substitute one for another)

| Name | Definition | Value |
|---|---|---|
| SEED_HASH | SHA-256 of `JSON.stringify({projects:['FIRN','OTHER'], ids:<work_id by exact title>, description:'Deterministic synthetic FIRN + OTHER distractor; …'})` | `780bfac4bce6442f46f5fc9827b0d8cc25cba3f4c80ad7e54bc2e87dabba1ec0` |
| LOGICAL_EXPORT_HASH | SHA-256 of `JSON.stringify({format, projects, sources, items, item_sources, relations, changes})` of `WmStore.exportData()` | `9334861791b8f64db8575d802159ac7c2d197a17fad563920dfd154ea1114b2a` |
| Fixture raw file SHA-256 | SHA-256 of the fixture file bytes | `29b0e3d2e2025f1fab8979ae40169be78ce455549573617b57bd213e45eb73d4` |

Expected counts after import: projects 2, items 9, sources 3, relations 1, item_sources 1, changes 16 (32 rows).

## Safety boundaries

- The only write is `WmStore.importJSON` into an empty `wm_*` namespace with the exact fixture; nothing else is written (no Canon, `wiz_ref`, Continuity, ledger, registry, caches, storage).
- No network request, no external CDN, no model invocation, no console output.
- No API key / token access: the harness never touches `localStorage`, `sessionStorage`, `IndexedDB`, cookies or the app's settings; the screen shows counts, ids, statuses, hashes and version strings only.
- Re-running IMPORT on a non-empty store aborts. Use an isolated browser profile. If an import was written but failed verification the screen says so; it never cleans up on its own.

## Methodological boundary

The PWA does not embed its git SHA. `main` at `649c7fd7673aceb3abdefee2a3fa3d96cdf6935d` **cannot be called the tested device SHA** once this code
exists: the SHA to record for a device run is the head (or merge commit) that was actually deployed, and `HARNESS_BUILD` identifies the harness file.
On the very first visit of a brand-new profile the app's existing version reset can delete `eiti-wizard-lab-*` caches while the service worker installs,
so `SW_CACHE` may read `NONE` until the next load; the harness only reports what is observable.

## Tests

`tests/working-memory/b1-device-harness.test.cjs` (fixture identity and real `importJSON` round trip, static safety scan, gate sync / inertness) and
`tests/working-memory/b1-device-browser.test.mjs` (real Chromium, 360 px touch viewport: normal UI unchanged, phone screen, full device flow, fail-closed
paths, isolation of every non-`wm_*` table, zero harness network / storage access, service-worker mode).

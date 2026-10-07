# B1-DEVICE-01 — native test harness (TEST ONLY, NON PRODUCTION)

Why: the Eruda / bookmarklet route of B1-DEVICE STEP 1 does not start reliably on Android (Samsung Internet / Chrome). This harness is the same
STEP 1 behaviour as an on-page screen that works with taps only. It is a **device-test aid**, not part of the product: nothing on it is Canon,
runtime authority, or an agent capability.

## How to open — exact entry only

`https://<host>/Eiti-Wizard-Lab/index.html?b1device=1` or `https://<host>/Eiti-Wizard-Lab/?b1device=1` (both are the canonical page path on Pages).
The harness is activated **only** when the page was opened with:

- path exactly `/Eiti-Wizard-Lab/index.html` or `/Eiti-Wizard-Lab/`,
- query exactly `?b1device=1` — compared as a raw string, never decoded or parsed: `?b1device=1&x=1`, `?x=1&b1device=1`, `?b1device=1&b1device=1`,
  `?b1device=%31`, `?b1device=01`, `?b1device=true`, `?b1device=`, `?B1DEVICE=1`, any other query, and any other path (`/Eiti-Wizard-Lab-copy/…`,
  `index.htm`, `//`, case variants) are inert,
- no fragment, **except the app's own panel route** (`#chat`, `#settings`, … exactly the app's 11 panel ids). The app rewrites the hash itself on every
  load (`history.replaceState('#chat')`) and Android reloads / restores a tab with it, so that is not a variant of the entry condition; `#`, `#x`,
  `#b1device=1`, `#?b1device=1`, `#chat-x`, `#CHAT` are inert (a test keeps both route lists equal to the `id="panel-*"` set of `index.html`).

The condition is checked **twice**, with the same rules: by a small inert gate in `index.html` (which injects `b1-device-harness.js`), and again by the harness
itself against the *navigation entry* (the URL as it was opened — `location.hash` is already rewritten by the app by then) plus the current path / query.
So a stale page with an older, looser gate cannot activate it. If the navigation entry is unavailable the harness stays inert. Anywhere else nothing here is
loaded or shown and the normal UI is unchanged (`index.html` minus the gate is byte-identical to `main`).

## Device-run validity (stale harness / stale page) — no network, no `sw.js` change

The production `sw.js` serves `index.html` network-first with an offline fallback to its cache, and everything else cache-first, so an offline or flaky device can
be handed a cached page and / or a cached harness. The harness therefore proves, **before any button is enabled**, that:

1. **its own code is the build it claims to be** — `HARNESS_BUILD_ID` is the first 12 hex of SHA-256 of the harness function's own source text (read at runtime with
   `Function.prototype.toString`, the id literal masked); a modified, truncated or transformed file fails (`HARNESS_SELF_HASH_MISMATCH`);
2. **the page that loaded it expects exactly this build** — the gate passes the expected build in `data-expected-build` and `?h=`; a missing marker (an older
   page) or any difference is `PAGE_BUILD_MARKER_MISSING` / `PAGE_HARNESS_BUILD_MISMATCH` / `HARNESS_URL_BUILD_MISMATCH`;
3. **the browser is online** — an offline load can only come from caches, and cached copies cannot be shown to be current (`OFFLINE_FRESHNESS_UNVERIFIED`).

Any failure ⇒ `STALE_HARNESS` + `DEVICE_RUN_INVALID`: the banner says so, all three buttons are disabled, and each action also refuses on its own (a force-enabled
button still returns `DEVICE_RUN_INVALID`) — no CHECK `ENV_OK`, no import, no `FINGERPRINT_PASS`. Every valid report carries `DEVICE_RUN = VALID`, `HARNESS_BUILD`,
`HARNESS_BUILD_SELF_COMPUTED`, `PAGE_EXPECTED_BUILD`, `SCRIPT_URL_BUILD`, `BUILD_CHECK = OK`, `ONLINE = YES`.

**Residual limit (not claimable without a network probe or a service-worker change, both out of scope):** a cached page + cached harness that are mutually
consistent, served while the browser still reports `online`, cannot be told from current ones. Such a run is only as current as the printed `HARNESS_BUILD`:
compare it with the build id published for the PR head before accepting a device run.

## Screen

`B1-DEVICE TEST — NON PRODUCTION`, a build-verification line, three buttons, a verdict badge and a selectable report:

| Button | Writes? | What it does |
|---|---|---|
| CHECK ENVIRONMENT | no | `window.WmStore` (+ `exportData` / `importJSON`), `WorkingMemory.EXPORT_FORMAT`, fixture self-check (raw SHA, SEED_HASH, LOGICAL hash of the embedded fixture), whether `wm_*` is empty **logically and physically**, APP_VERSION, SW cache name / control, user agent. Badge `ENV_OK` / `ENV_FAIL`. |
| IMPORT FROZEN FIXTURE | **only `WmStore.importJSON`** | Aborts before any write (`WRITE_ATTEMPTED = NO`) unless every `wm_*` data table is empty, the physical guard passes and the embedded fixture verifies. Imports the exact frozen fixture, then verifies counts, LOGICAL_EXPORT_HASH and SEED_HASH. Badge `IMPORT_PASS` / `IMPORT_FAIL`; a failed `importJSON` is shown verbatim (`code`, `rolledBack`, `persistenceState`) and is never reported as PASS. |
| RUN FINGERPRINT | no | STEP 1 fingerprint: `PASS` / `FAIL`, APP_VERSION, SW cache, counts, `work_id + status`, LOGICAL_EXPORT_HASH, SEED_HASH (and the expected values). Run it after the import and again after closing and reopening the page. |

## Physical `wm_*` guard (before the import)

`WmStore.exportData()` shows only the six logical tables, so an orphan row in the FTS index or a contaminated shadow table is invisible to it. Before the import the
harness also reads, with fixed read-only `SELECT`s on the app's SQLite handle, **every** `wm_*` table in `sqlite_master`:

- the six data tables, `wm_items_fts`, `wm_items_fts_content`, `wm_items_fts_docsize`, `wm_items_fts_idx` and any other `wm_*` table: no rows;
- `wm_items_fts_data`: only the two structure rows of an empty FTS5 index (ids 1 and 10); `wm_items_fts_config`: only the `version` key;
- all six data tables and `wm_items_fts` must exist (an unreadable / missing namespace is `WM_PHYSICAL_UNVERIFIABLE`).

Any unexpected physical row ⇒ `WM_PHYSICAL_NOT_EMPTY`, import aborted before the write, **nothing is cleaned up** (use an isolated browser profile). CHECK ENVIRONMENT shows
`WM_PHYSICAL_EMPTY = YES / NO / UNVERIFIABLE` and the offending tables.

## Frozen checkpoints (three DIFFERENT hashes — never substitute one for another)

| Name | Definition | Value |
|---|---|---|
| SEED_HASH | SHA-256 of `JSON.stringify({projects:['FIRN','OTHER'], ids:<work_id by exact title>, description:'Deterministic synthetic FIRN + OTHER distractor; …'})` | `780bfac4bce6442f46f5fc9827b0d8cc25cba3f4c80ad7e54bc2e87dabba1ec0` |
| LOGICAL_EXPORT_HASH | SHA-256 of `JSON.stringify({format, projects, sources, items, item_sources, relations, changes})` of `WmStore.exportData()` | `9334861791b8f64db8575d802159ac7c2d197a17fad563920dfd154ea1114b2a` |
| Fixture raw file SHA-256 | SHA-256 of the fixture file bytes | `29b0e3d2e2025f1fab8979ae40169be78ce455549573617b57bd213e45eb73d4` |

Expected counts after import: projects 2, items 9, sources 3, relations 1, item_sources 1, changes 16 (32 rows).

## Safety boundaries

- The only write is `WmStore.importJSON` into an empty `wm_*` with the exact fixture; nothing else is written (no Canon, `wiz_ref`, Continuity, ledger, registry, caches, storage).
- The app SQLite handle is used for fixed read-only `SELECT`s on `wm_*` tables only (`sqlite_master` listing, `COUNT(*)`, two id / key listings); no `run`, `prepare`, `export`.
- No network request, no external CDN, no model invocation, no console output.
- No API key / token access: no `localStorage` / `sessionStorage` / `IndexedDB` / cookie access of its own; the screen shows counts, ids, statuses, hashes and version strings only.
- Re-running IMPORT on a non-empty store aborts. If an import was written but failed verification the screen says so; it never cleans up on its own.

## Methodological boundary

The PWA does not embed its git SHA. `main` at `649c7fd7673aceb3abdefee2a3fa3d96cdf6935d` **cannot be called the tested device SHA** once this code exists: the SHA to record
for a device run is the head (or merge commit) that was actually deployed, and `HARNESS_BUILD` identifies the harness file. On the very first visit of a brand-new
profile the app's existing version reset can delete `eiti-wizard-lab-*` caches while the service worker installs, so `SW_CACHE` may read `NONE` until the next load;
the harness only reports what is observable.

## Tests

`tests/working-memory/b1-device-harness.test.cjs` runs the real harness file in a `vm` with a tiny DOM stub against a **real sql.js database and the real WorkingMemory store**:
fixture identity and `importJSON` round trip, static safety scan, gate / build-id sync, the exact-URL table for the gate **and** the harness, the stale matrix (marker
missing, wrong build, URL build, older self-consistent build, tampered code, missing id, offline, no WebCrypto — all force-clicked), valid run, physical contamination
matrix (orphan FTS row and every shadow table) and its edges. `tests/working-memory/b1-device-browser.test.mjs` (real Chromium, 360 px touch viewport, fresh profiles) covers the
exact gate in a browser (incl. defense in depth against an old loose gate), normal-UI DOM equality, phone screen, the full device flow with call-stack-attributed spies,
stale page / older harness / tampered code, the **offline scenario through the real production `sw.js`**, physical contamination, and the fail-closed paths.

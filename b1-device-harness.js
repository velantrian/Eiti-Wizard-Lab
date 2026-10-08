/* B1-DEVICE-01 — native TEST-ONLY harness.  NON PRODUCTION.
 *
 * Why: the Eruda / bookmarklet route of B1-DEVICE STEP 1 does not start reliably on Android (Samsung Internet / Chrome). This file
 * reproduces the STEP 1 behaviour (import + fingerprint) as an on-page screen that works with taps only.
 *
 * Entry point: ONLY the exact URL `<canonical page path>?b1device=1` (path /Eiti-Wizard-Lab/index.html or /Eiti-Wizard-Lab/, query exactly
 * `?b1device=1`, no fragment other than the app's own panel route such as #chat) as it was OPENED. The gate in index.html injects this file under that exact condition, and this file checks the
 * SAME exact condition again (against the navigation entry, because the app itself rewrites the hash after start-up) before it does anything,
 * so a stale page with an older, looser gate cannot activate it either. Without it nothing here is ever loaded or shown, so the normal UI is
 * unchanged.
 *
 * Device-run validity (no network probe, no service-worker change). Before any button is enabled the harness checks
 *  - its own code is the build it claims to be (build id = SHA-256 of its own function source with the id literal masked),
 *  - the page that loaded it expects exactly this build (data-expected-build marker and ?h= in the script URL),
 *  - the browser does not report itself offline (navigator.onLine === false: cached copies cannot be shown to be current).
 * Every failure that IS observable is STALE_HARNESS + DEVICE_RUN_INVALID: every button is disabled and every action refuses (no import, no PASS).
 * What this does NOT prove: navigator.onLine is not a freshness oracle (Chromium can report true after an offline reload that the service worker
 * served entirely from its cache), and a cached page + cached harness that are mutually consistent cannot be told from the current deployment
 * without a network probe or a service-worker change (both out of scope). Such a run is only internally VALID and is NOT current-deployment
 * evidence: BEFORE IMPORT the human must compare the displayed HARNESS_BUILD with the build id published for the exact reviewed / deployed HEAD
 * (every report says FRESHNESS = NOT_PROVEN_BY_HARNESS).
 *
 * Boundaries (asserted by tests/working-memory/b1-device-harness.test.cjs and b1-device-browser.test.mjs):
 *  - the ONLY write is the existing WmStore.importJSON (wm_* namespace), ONLY when wm_* is empty both logically (exportData) and physically
 *    (every wm_* table incl. the FTS index and its shadow tables, read with fixed SELECT statements), ONLY the exact frozen fixture
 *  - unexpected physical wm_* rows are never cleaned up: the import aborts (WM_PHYSICAL_NOT_EMPTY)
 *  - nothing else is written: no Canon, wiz_ref, Continuity, ledger or registry access; no cache / storage writes
 *  - no network request, no model invocation, no external CDN
 *  - no API key / token access: no localStorage / sessionStorage / IndexedDB / cookie access of its own; the screen shows counts, ids,
 *    statuses, hashes and version strings only; no console output
 *  - nothing on this screen is Canon or runtime authority: it is a device-test aid
 */
(function B1DeviceHarness() {
  'use strict';
  // ── Exact entry condition (fail-closed): any other path / query / fragment => this file does nothing at all ───────────────────
  const ENTRY_PATHS = ['/Eiti-Wizard-Lab/index.html', '/Eiti-Wizard-Lab/'];
  const ENTRY_SEARCH = '?b1device=1';
  // The ONLY fragments accepted are the app's own panel routes: on every load the app rewrites the hash itself (history.replaceState '#chat', later
  // '#<panel>') and Android reloads / restores a tab with it, so '#chat' is not a variant of the entry condition. Anything else (#, #x, #b1device=1, ...) is.
  const APP_ROUTE = /^#(?:projects|chat|agent|settings|notes|memory|history|files|eiti-files|diary|board)$/;
  // The URL the user OPENED is read from the navigation entry (it keeps the URL exactly as navigated, fragment included, unlike location.hash which the
  // app has already rewritten by the time this runs). The current pathname / query must still be unchanged.
  function isExactEntry() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav || typeof nav.name !== 'string') return false;                                              // cannot prove the entry URL => inert
      return ENTRY_PATHS.some(p => { const base = location.origin + p + ENTRY_SEARCH; return nav.name === base || (nav.name.indexOf(base + '#') === 0 && APP_ROUTE.test(nav.name.slice(base.length))); }) &&
        ENTRY_PATHS.indexOf(location.pathname) !== -1 && location.search === ENTRY_SEARCH;
    } catch (_) { return false; }
  }
  if (!isExactEntry()) return;
  const ROOT_ID = 'b1device-root';
  if (document.getElementById(ROOT_ID)) return;                       // one instance only
  const SCRIPT = document.currentScript;                              // only valid while this file first executes

  // ── Build identity ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // HARNESS_BUILD_ID = first 12 hex of SHA-256(source text of this function with the next line's literal masked to '').
  const HARNESS_BUILD_ID = '45665e6b4bd6';

  // ── Frozen B1-DEVICE-01 checkpoints (three DIFFERENT hashes; never substitute one for another) ─────────────────────────────
  const EXPECTED_SEED = '780bfac4bce6442f46f5fc9827b0d8cc25cba3f4c80ad7e54bc2e87dabba1ec0';      // SEED_HASH (work-id mapping)
  const EXPECTED_LOGICAL = '9334861791b8f64db8575d802159ac7c2d197a17fad563920dfd154ea1114b2a';   // LOGICAL_EXPORT_HASH of WmStore.exportData()
  const FIXTURE_RAW_SHA256 = '29b0e3d2e2025f1fab8979ae40169be78ce455549573617b57bd213e45eb73d4'; // SHA-256 of the fixture file bytes
  const EXPECTED = { projects: 2, items: 9, sources: 3, relations: 1, item_sources: 1, changes: 16 };
  const EXPORT_FORMAT = 'eiti-working-memory-export/1';
  const LISTS = ['projects', 'sources', 'items', 'item_sources', 'relations', 'changes'];
  // The exact frozen fixture (file bytes, as one string).
  const FIXTURE_JSON = "{\"format\":\"eiti-working-memory-export/1\",\"projects\":[{\"project_id\":\"firn\",\"code\":\"FIRN\",\"name\":\"Project FIRN synthetic\",\"summary\":\"Deterministic FMB seed\",\"created_at\":\"2026-10-06T12:00:01.000Z\",\"updated_at\":\"2026-10-06T12:00:01.000Z\"},{\"project_id\":\"other\",\"code\":\"OTHER\",\"name\":\"Distractor OTHER\",\"summary\":\"Scope contamination bait\",\"created_at\":\"2026-10-06T12:00:03.000Z\",\"updated_at\":\"2026-10-06T12:00:03.000Z\"}],\"sources\":[{\"source_id\":\"src-firn-nav\",\"project_id\":\"firn\",\"surface\":\"NOTION\",\"role\":\"NAVIGATION\",\"title\":\"FIRN nav page\",\"locator\":\"notion://synthetic/firn-board\",\"revision\":null,\"note\":null,\"created_at\":\"2026-10-06T12:00:07.000Z\",\"updated_at\":\"2026-10-06T12:00:07.000Z\"},{\"source_id\":\"src-firn-primary\",\"project_id\":\"firn\",\"surface\":\"GITHUB\",\"role\":\"PRIMARY\",\"title\":\"FIRN primary repo\",\"locator\":\"github://synthetic/firn#main\",\"revision\":null,\"note\":null,\"created_at\":\"2026-10-06T12:00:05.000Z\",\"updated_at\":\"2026-10-06T12:00:05.000Z\"},{\"source_id\":\"src-other\",\"project_id\":\"other\",\"surface\":\"LOCAL\",\"role\":\"PRIMARY\",\"title\":\"OTHER local\",\"locator\":\"local://other/notes.md\",\"revision\":null,\"note\":null,\"created_at\":\"2026-10-06T12:00:09.000Z\",\"updated_at\":\"2026-10-06T12:00:09.000Z\"}],\"items\":[{\"work_id\":\"WRK-FIRN-20261006-001\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"NOTE\",\"status\":\"CURRENT\",\"priority\":\"P0\",\"title\":\"FIRN current focus: resume Gate B1 orientation\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":\"Confirm orientation with owner\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:12.000Z\",\"updated_at\":\"2026-10-06T12:00:12.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-002\",\"project_id\":\"firn\",\"thread\":\"parser\",\"type\":\"TASK\",\"status\":\"IN_PROGRESS\",\"priority\":\"P1\",\"title\":\"FIRN in-progress: polish parser adapters\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":\"Finish parser adapters\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:15.000Z\",\"updated_at\":\"2026-10-06T12:00:15.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-003\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"QUESTION\",\"status\":\"OPEN\",\"priority\":\"P1\",\"title\":\"FIRN open: clarify export scope\",\"summary\":null,\"body_md\":null,\"current_question\":\"What is in-scope for export?\",\"status_note\":null,\"next_action\":\"Ask owner about export scope\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:18.000Z\",\"updated_at\":\"2026-10-06T12:00:18.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-004\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"TASK\",\"status\":\"BLOCKED\",\"priority\":\"P2\",\"title\":\"FIRN blocked: waiting owner review\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":\"Waiting for owner review of protocol\",\"next_action\":null,\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:21.000Z\",\"updated_at\":\"2026-10-06T12:00:21.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-005\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"NOTE\",\"status\":\"UNKNOWN\",\"priority\":\"P3\",\"title\":\"FIRN unknown: unexplained latency spike\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:24.000Z\",\"updated_at\":\"2026-10-06T12:00:24.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-006\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"TASK\",\"status\":\"COMPLETED\",\"priority\":\"P2\",\"title\":\"FIRN completed: seed schema ready\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:27.000Z\",\"updated_at\":\"2026-10-06T12:00:27.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-007\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"HYPOTHESIS\",\"status\":\"OPEN\",\"priority\":\"P2\",\"title\":\"FIRN model proposal: try Graphiti donor\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"MODEL_PROPOSAL\",\"tags_json\":\"[\\\"graphiti\\\",\\\"proposal\\\"]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:30.000Z\",\"updated_at\":\"2026-10-06T12:00:30.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-008\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"DECISION\",\"status\":\"CURRENT\",\"priority\":\"P0\",\"title\":\"FIRN user decision: keep DEFAULT_MODE WORKING\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"USER_DECISION\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:33.000Z\",\"updated_at\":\"2026-10-06T12:00:33.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-OTHER-20261006-001\",\"project_id\":\"other\",\"thread\":\"\",\"type\":\"TASK\",\"status\":\"OPEN\",\"priority\":\"P0\",\"title\":\"OTHER distractor open: secret decoy task\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":\"Do not mix into FIRN\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:36.000Z\",\"updated_at\":\"2026-10-06T12:00:36.000Z\",\"resolved_at\":null,\"archived_at\":null}],\"item_sources\":[{\"work_id\":\"WRK-FIRN-20261006-002\",\"source_id\":\"src-firn-primary\",\"is_primary\":1}],\"relations\":[{\"relation_id\":\"wmr_000016\",\"from_work_id\":\"WRK-FIRN-20261006-004\",\"to_work_id\":\"WRK-FIRN-20261006-002\",\"relation_type\":\"BLOCKED_BY\",\"created_at\":\"2026-10-06T12:00:39.000Z\"}],\"changes\":[{\"change_id\":\"wmc_000001\",\"work_id\":null,\"change_type\":\"CREATE_PROJECT\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"code\\\",\\\"created_at\\\",\\\"name\\\",\\\"project_id\\\",\\\"summary\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"project_id\\\":\\\"firn\\\",\\\"code\\\":\\\"FIRN\\\",\\\"name\\\":\\\"Project FIRN synthetic\\\",\\\"summary\\\":\\\"Deterministic FMB seed\\\",\\\"created_at\\\":\\\"2026-10-06T12:00:01.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:01.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:02.000Z\"},{\"change_id\":\"wmc_000002\",\"work_id\":null,\"change_type\":\"CREATE_PROJECT\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"code\\\",\\\"created_at\\\",\\\"name\\\",\\\"project_id\\\",\\\"summary\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"project_id\\\":\\\"other\\\",\\\"code\\\":\\\"OTHER\\\",\\\"name\\\":\\\"Distractor OTHER\\\",\\\"summary\\\":\\\"Scope contamination bait\\\",\\\"created_at\\\":\\\"2026-10-06T12:00:03.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:03.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:04.000Z\"},{\"change_id\":\"wmc_000003\",\"work_id\":null,\"change_type\":\"CREATE_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"locator\\\",\\\"note\\\",\\\"project_id\\\",\\\"revision\\\",\\\"role\\\",\\\"source_id\\\",\\\"surface\\\",\\\"title\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"source_id\\\":\\\"src-firn-primary\\\",\\\"project_id\\\":\\\"firn\\\",\\\"surface\\\":\\\"GITHUB\\\",\\\"role\\\":\\\"PRIMARY\\\",\\\"title\\\":\\\"FIRN primary repo\\\",\\\"locator\\\":\\\"github://synthetic/firn#main\\\",\\\"revision\\\":null,\\\"note\\\":null,\\\"created_at\\\":\\\"2026-10-06T12:00:05.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:05.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:06.000Z\"},{\"change_id\":\"wmc_000004\",\"work_id\":null,\"change_type\":\"CREATE_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"locator\\\",\\\"note\\\",\\\"project_id\\\",\\\"revision\\\",\\\"role\\\",\\\"source_id\\\",\\\"surface\\\",\\\"title\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"source_id\\\":\\\"src-firn-nav\\\",\\\"project_id\\\":\\\"firn\\\",\\\"surface\\\":\\\"NOTION\\\",\\\"role\\\":\\\"NAVIGATION\\\",\\\"title\\\":\\\"FIRN nav page\\\",\\\"locator\\\":\\\"notion://synthetic/firn-board\\\",\\\"revision\\\":null,\\\"note\\\":null,\\\"created_at\\\":\\\"2026-10-06T12:00:07.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:07.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:08.000Z\"},{\"change_id\":\"wmc_000005\",\"work_id\":null,\"change_type\":\"CREATE_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"locator\\\",\\\"note\\\",\\\"project_id\\\",\\\"revision\\\",\\\"role\\\",\\\"source_id\\\",\\\"surface\\\",\\\"title\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"source_id\\\":\\\"src-other\\\",\\\"project_id\\\":\\\"other\\\",\\\"surface\\\":\\\"LOCAL\\\",\\\"role\\\":\\\"PRIMARY\\\",\\\"title\\\":\\\"OTHER local\\\",\\\"locator\\\":\\\"local://other/notes.md\\\",\\\"revision\\\":null,\\\"note\\\":null,\\\"created_at\\\":\\\"2026-10-06T12:00:09.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:09.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:10.000Z\"},{\"change_id\":\"wmc_000006\",\"work_id\":\"WRK-FIRN-20261006-001\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-001\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"NOTE\\\",\\\"status\\\":\\\"CURRENT\\\",\\\"priority\\\":\\\"P0\\\",\\\"title\\\":\\\"FIRN current focus: resume Gate B1 orientation\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":\\\"Confirm orientation with owner\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:12.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:12.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:13.000Z\"},{\"change_id\":\"wmc_000007\",\"work_id\":\"WRK-FIRN-20261006-002\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-002\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"parser\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"IN_PROGRESS\\\",\\\"priority\\\":\\\"P1\\\",\\\"title\\\":\\\"FIRN in-progress: polish parser adapters\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":\\\"Finish parser adapters\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:15.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:15.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:16.000Z\"},{\"change_id\":\"wmc_000008\",\"work_id\":\"WRK-FIRN-20261006-003\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-003\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"QUESTION\\\",\\\"status\\\":\\\"OPEN\\\",\\\"priority\\\":\\\"P1\\\",\\\"title\\\":\\\"FIRN open: clarify export scope\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":\\\"What is in-scope for export?\\\",\\\"status_note\\\":null,\\\"next_action\\\":\\\"Ask owner about export scope\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:18.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:18.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:19.000Z\"},{\"change_id\":\"wmc_000009\",\"work_id\":\"WRK-FIRN-20261006-004\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-004\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"BLOCKED\\\",\\\"priority\\\":\\\"P2\\\",\\\"title\\\":\\\"FIRN blocked: waiting owner review\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":\\\"Waiting for owner review of protocol\\\",\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:21.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:21.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:22.000Z\"},{\"change_id\":\"wmc_000010\",\"work_id\":\"WRK-FIRN-20261006-005\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-005\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"NOTE\\\",\\\"status\\\":\\\"UNKNOWN\\\",\\\"priority\\\":\\\"P3\\\",\\\"title\\\":\\\"FIRN unknown: unexplained latency spike\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:24.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:24.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:25.000Z\"},{\"change_id\":\"wmc_000011\",\"work_id\":\"WRK-FIRN-20261006-006\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-006\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"COMPLETED\\\",\\\"priority\\\":\\\"P2\\\",\\\"title\\\":\\\"FIRN completed: seed schema ready\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:27.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:27.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:28.000Z\"},{\"change_id\":\"wmc_000012\",\"work_id\":\"WRK-FIRN-20261006-007\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-007\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"HYPOTHESIS\\\",\\\"status\\\":\\\"OPEN\\\",\\\"priority\\\":\\\"P2\\\",\\\"title\\\":\\\"FIRN model proposal: try Graphiti donor\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"MODEL_PROPOSAL\\\",\\\"tags_json\\\":\\\"[\\\\\\\"graphiti\\\\\\\",\\\\\\\"proposal\\\\\\\"]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:30.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:30.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:31.000Z\"},{\"change_id\":\"wmc_000013\",\"work_id\":\"WRK-FIRN-20261006-008\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-008\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"DECISION\\\",\\\"status\\\":\\\"CURRENT\\\",\\\"priority\\\":\\\"P0\\\",\\\"title\\\":\\\"FIRN user decision: keep DEFAULT_MODE WORKING\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_DECISION\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:33.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:33.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:34.000Z\"},{\"change_id\":\"wmc_000014\",\"work_id\":\"WRK-OTHER-20261006-001\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-OTHER-20261006-001\\\",\\\"project_id\\\":\\\"other\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"OPEN\\\",\\\"priority\\\":\\\"P0\\\",\\\"title\\\":\\\"OTHER distractor open: secret decoy task\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":\\\"Do not mix into FIRN\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:36.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:36.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:37.000Z\"},{\"change_id\":\"wmc_000015\",\"work_id\":\"WRK-FIRN-20261006-002\",\"change_type\":\"LINK_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"is_primary\\\",\\\"source_id\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-002\\\",\\\"source_id\\\":\\\"src-firn-primary\\\",\\\"is_primary\\\":1}\",\"created_at\":\"2026-10-06T12:00:38.000Z\"},{\"change_id\":\"wmc_000017\",\"work_id\":\"WRK-FIRN-20261006-004\",\"change_type\":\"ADD_RELATION\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"from_work_id\\\",\\\"relation_id\\\",\\\"relation_type\\\",\\\"to_work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"relation_id\\\":\\\"wmr_000016\\\",\\\"from_work_id\\\":\\\"WRK-FIRN-20261006-004\\\",\\\"to_work_id\\\":\\\"WRK-FIRN-20261006-002\\\",\\\"relation_type\\\":\\\"BLOCKED_BY\\\",\\\"created_at\\\":\\\"2026-10-06T12:00:39.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:40.000Z\"}]}\n";

  // ── Hashes: identical definitions to the STEP 1 reference scripts ───────────────────────────────────────────────────────────
  async function sha256Hex(str) {
    if (!window.crypto || !window.crypto.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable — open the page over HTTPS');
    const ab = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(ab)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function logicalHash(d) {
    return sha256Hex(JSON.stringify({
      format: d.format, projects: d.projects, sources: d.sources, items: d.items,
      item_sources: d.item_sources, relations: d.relations, changes: d.changes
    }));
  }
  const BY_TITLE = {
    'FIRN current focus: resume Gate B1 orientation': 'cur',
    'FIRN in-progress: polish parser adapters': 'prog',
    'FIRN open: clarify export scope': 'open',
    'FIRN blocked: waiting owner review': 'blk',
    'FIRN unknown: unexplained latency spike': 'unk',
    'FIRN completed: seed schema ready': 'done',
    'FIRN model proposal: try Graphiti donor': 'hyp',
    'FIRN user decision: keep DEFAULT_MODE WORKING': 'dec',
    'OTHER distractor open: secret decoy task': 'oth',
  };
  function seedHashFromExport(d) {
    const ids = {};
    for (const it of d.items) {
      const k = BY_TITLE[it.title];
      if (k) ids[k] = it.work_id;
    }
    return sha256Hex(JSON.stringify({
      projects: ['FIRN', 'OTHER'],
      ids,
      description: 'Deterministic synthetic FIRN + OTHER distractor; statuses CURRENT/IN_PROGRESS/OPEN/BLOCKED/UNKNOWN/COMPLETED; MODEL_PROPOSAL; USER_DECISION; source+relation'
    }));
  }

  // ── Build / freshness verification (no network, no service-worker change) ───────────────────────────────────────────────────
  async function selfBuild() {
    const masked = B1DeviceHarness.toString().replace(/const HARNESS_BUILD_ID = '[0-9a-f]{12}';/, "const HARNESS_BUILD_ID = '';");
    return (await sha256Hex(masked)).slice(0, 12);
  }
  async function verifyBuild() {
    const v = { problems: [], self: '', pageExpected: null, urlBuild: null, online: null };
    v.self = await selfBuild();
    if (!/^[0-9a-f]{12}$/.test(HARNESS_BUILD_ID) || v.self !== HARNESS_BUILD_ID) v.problems.push('HARNESS_SELF_HASH_MISMATCH');
    try { v.pageExpected = SCRIPT.getAttribute('data-expected-build'); } catch (_) { v.pageExpected = null; }
    if (!v.pageExpected) v.problems.push('PAGE_BUILD_MARKER_MISSING');
    else if (v.pageExpected !== HARNESS_BUILD_ID) v.problems.push('PAGE_HARNESS_BUILD_MISMATCH');
    try { v.urlBuild = new URL(SCRIPT.src).searchParams.get('h'); } catch (_) { v.urlBuild = null; }
    if (v.urlBuild !== HARNESS_BUILD_ID) v.problems.push('HARNESS_URL_BUILD_MISMATCH');
    v.online = navigator.onLine;
    if (v.online === false) v.problems.push('OFFLINE_FRESHNESS_UNVERIFIED');
    return v;
  }
  let run = { state: 'VERIFYING', v: null };                          // VERIFYING | VALID | INVALID
  const isValid = () => run.state === 'VALID';
  function buildLines() {
    const v = run.v || { self: '', pageExpected: null, urlBuild: null, online: null };
    return [
      'HARNESS_BUILD = ' + HARNESS_BUILD_ID,
      'HARNESS_BUILD_SELF_COMPUTED = ' + (v.self || 'UNKNOWN'),
      'PAGE_EXPECTED_BUILD = ' + (v.pageExpected || 'MISSING'),
      'SCRIPT_URL_BUILD = ' + (v.urlBuild || 'MISSING'),
      'BUILD_CHECK = ' + (run.state === 'VALID' ? 'OK' : run.state === 'INVALID' ? 'MISMATCH' : 'PENDING'),
      'ONLINE_REPORTED = ' + (v.online === false ? 'NO' : v.online === true ? 'YES' : 'UNKNOWN') + ' (navigator.onLine; not a freshness proof)',
      'FRESHNESS = NOT_PROVEN_BY_HARNESS (a cached page + harness can look identical to the current deployment; BEFORE IMPORT compare HARNESS_BUILD with the build id published for the exact reviewed / deployed HEAD)',
    ];
  }
  function invalidResult() {
    const v = run.v || { problems: ['BUILD_NOT_VERIFIED'] };
    const buildProblems = v.problems.filter(p => p !== 'OFFLINE_FRESHNESS_UNVERIFIED');
    const L = ['DEVICE_RUN_INVALID',
      'STALE_HARNESS = ' + (run.state === 'VERIFYING' ? 'UNKNOWN (build verification has not finished)' : buildProblems.length ? 'YES' : 'POSSIBLE (offline: a cached page / harness cannot be shown to be current)'),
      'REASONS = ' + (v.problems.join(', ') || 'BUILD_NOT_VERIFIED')];
    L.push.apply(L, buildLines());
    L.push('No import, no fingerprint pass and no environment OK are possible in this state. Reload the exact URL over the network; compare HARNESS_BUILD with the build id published for the reviewed / deployed HEAD.');
    L.push('WRITES_PERFORMED = NO');
    return { verdict: 'DEVICE_RUN_INVALID', text: L.join('\n') };
  }
  const validHeader = () => 'DEVICE_RUN = VALID (internal consistency only: build ' + HARNESS_BUILD_ID + ' self-hash, page marker, script URL; no offline signal) — NOT current-deployment evidence until HARNESS_BUILD is compared with the expected build id BEFORE IMPORT';

  // ── Read-only helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  // The app creates WmStore asynchronously at start-up (undefined = not yet, null = schema init failed). We never create it.
  async function getStore() {
    const deadline = Date.now() + 15000;
    while (window.WmStore === undefined && Date.now() < deadline) await sleep(150);
    return window.WmStore;
  }
  function snapshotOf(store) {
    const d = store.exportData();
    if (!d || typeof d !== 'object' || LISTS.some(k => !Array.isArray(d[k]))) throw new Error('exportData() did not return the six Working Memory arrays');
    const counts = {};
    for (const k of LISTS) counts[k] = d[k].length;
    return { d, counts, total: LISTS.reduce((n, k) => n + counts[k], 0) };
  }
  const countsLine = c => LISTS.map(k => 'wm_' + k + ' = ' + c[k]).join('\n');
  const countsMatch = c => Object.keys(EXPECTED).every(k => c[k] === EXPECTED[k]);

  // The wm_* namespace is verified PHYSICALLY: the complete expected table set must be present, and then empty. Read-only: fixed SELECT statements
  // on table names taken from sqlite_master (validated wm_<identifier>); nothing is recreated, repaired or deleted.
  //   presence : all 12 tables of this exact WorkingMemory schema — the six data tables, the FTS5 index wm_items_fts and its five shadow tables.
  //              Any absent table => WM_PHYSICAL_UNVERIFIABLE (the namespace cannot be proven pristine), before anything else is read.
  //   rows     : data tables, wm_items_fts, _content, _docsize, _idx and any other wm_* table: no rows;
  //              wm_items_fts_data: only the two structure rows of an empty FTS5 index (ids 1 and 10);  wm_items_fts_config: only the 'version' key
  const PHYSICAL_REQUIRED = ['wm_projects', 'wm_sources', 'wm_items', 'wm_item_sources', 'wm_relations', 'wm_changes',
    'wm_items_fts', 'wm_items_fts_content', 'wm_items_fts_docsize', 'wm_items_fts_idx', 'wm_items_fts_data', 'wm_items_fts_config'];
  function physicalGuard(presenceOnly) {
    const db = window._wizDB;
    if (!db || typeof db.exec !== 'function') return { ok: false, code: 'WM_PHYSICAL_UNVERIFIABLE', lines: ['the app SQLite handle is not available'] };
    try {
      const first = r => (r && r[0] && r[0].values) || [];
      const names = first(db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")).map(v => String(v[0])).filter(n => n.indexOf('wm_') === 0).sort();
      const missing = PHYSICAL_REQUIRED.filter(n => names.indexOf(n) === -1);
      if (missing.length) return { ok: false, code: 'WM_PHYSICAL_UNVERIFIABLE', lines: ['missing expected wm_* table(s): ' + missing.join(', ')] };
      if (presenceOnly) return { ok: true, tables: names.length, lines: [] };
      const violations = [];
      for (const name of names) {
        if (!/^wm_[a-z0-9_]+$/.test(name)) { violations.push(name + ': unexpected table name'); continue; }
        if (name === 'wm_items_fts_data') {
          const extra = first(db.exec('SELECT id FROM "wm_items_fts_data"')).map(v => Number(v[0])).filter(id => id !== 1 && id !== 10);
          if (extra.length) violations.push(name + ': ' + extra.length + ' unexpected row(s) (ids ' + extra.slice(0, 5).join(',') + ')');
        } else if (name === 'wm_items_fts_config') {
          const extra = first(db.exec('SELECT k FROM "wm_items_fts_config"')).map(v => String(v[0])).filter(k => k !== 'version');
          if (extra.length) violations.push(name + ': ' + extra.length + ' unexpected row(s) (keys ' + extra.slice(0, 5).join(',') + ')');
        } else {
          const n = Number(first(db.exec('SELECT COUNT(*) FROM "' + name + '"'))[0][0]);
          if (n !== 0) violations.push(name + ': ' + n + ' row(s)');
        }
      }
      if (violations.length) return { ok: false, code: 'WM_PHYSICAL_NOT_EMPTY', lines: violations, tables: names.length };
      return { ok: true, tables: names.length, lines: [] };
    } catch (e) {
      return { ok: false, code: 'WM_PHYSICAL_UNVERIFIABLE', lines: ['cannot read wm_* tables: ' + String((e && e.message) || e)] };
    }
  }

  async function platformLines() {
    let swCache = 'UNKNOWN', swState = 'UNKNOWN';
    try {
      if (window.caches && window.caches.keys) {
        const keys = await window.caches.keys();
        swCache = keys.filter(k => /eiti-wizard/i.test(k)).join(',') || keys.join(',') || 'NONE';
      }
    } catch (_) {}
    try { swState = 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'CONTROLLED' : 'NOT_CONTROLLED') : 'UNSUPPORTED'; } catch (_) {}
    return [
      'APP_VERSION = ' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'UNKNOWN'),
      'SW_CACHE = ' + swCache,
      'SW_CONTROL = ' + swState,
      'GIT_SHA_OBSERVABLE = NOT_IN_APP (the PWA does not embed its git SHA)',
    ].concat(buildLines(), [
      'ORIGIN_PATH = ' + location.origin + location.pathname,
      'SECURE_CONTEXT = ' + (window.isSecureContext ? 'YES' : 'NO'),
      'USER_AGENT = ' + navigator.userAgent,
    ]);
  }
  // Integrity of the embedded fixture itself — no storage is touched.
  async function fixtureIntegrity() {
    const problems = [];
    const raw = await sha256Hex(FIXTURE_JSON);
    if (raw !== FIXTURE_RAW_SHA256) problems.push('fixture raw SHA-256 mismatch: ' + raw);
    let parsed = null;
    try { parsed = JSON.parse(FIXTURE_JSON); } catch (_) { problems.push('fixture is not valid JSON'); }
    if (parsed) {
      if (parsed.format !== EXPORT_FORMAT) problems.push('fixture format mismatch');
      const seed = await seedHashFromExport(parsed);
      if (seed !== EXPECTED_SEED) problems.push('fixture SEED_HASH mismatch: ' + seed);
      const logical = await logicalHash(parsed);
      if (logical !== EXPECTED_LOGICAL) problems.push('fixture LOGICAL hash mismatch: ' + logical);
    }
    return { problems, raw };
  }

  // ── Actions (each one refuses unless the device run is VALID) ───────────────────────────────────────────────────────────────
  // CHECK ENVIRONMENT — read-only: nothing is created, changed or written.
  async function checkEnvironment() {
    if (!isValid()) return invalidResult();
    const L = ['== CHECK ENVIRONMENT (read-only) ==', validHeader()];
    let ok = true;
    const bad = msg => { ok = false; L.push('FAIL: ' + msg); };
    const store = await getStore();
    L.push('WmStore = ' + (store ? 'PRESENT' : store === null ? 'NULL' : 'MISSING'));
    if (!store) bad('window.WmStore is not available (the app did not finish starting Working Memory)');
    else {
      for (const fn of ['exportData', 'importJSON']) {
        const has = typeof store[fn] === 'function';
        L.push('WmStore.' + fn + ' = ' + (has ? 'function' : 'MISSING'));
        if (!has) bad('WmStore.' + fn + ' missing');
      }
    }
    const fmt = window.WorkingMemory ? window.WorkingMemory.EXPORT_FORMAT : undefined;
    L.push('WorkingMemory.EXPORT_FORMAT = ' + String(fmt));
    if (fmt !== EXPORT_FORMAT) bad('WorkingMemory export format unexpected (want ' + EXPORT_FORMAT + ')');
    let fixture = null;
    try { fixture = await fixtureIntegrity(); } catch (e) { bad(String((e && e.message) || e)); }
    if (fixture) {
      L.push('FIXTURE_RAW_SHA256 = ' + fixture.raw);
      L.push('FIXTURE_SELF_CHECK = ' + (fixture.problems.length ? 'FAIL' : 'PASS'));
      for (const p of fixture.problems) bad(p);
    }
    let empty = false;
    const presence = physicalGuard(true);                                                                  // the whole expected namespace must exist first
    if (!presence.ok) L.push('WM_EMPTY = UNKNOWN (the physical wm_* namespace is incomplete or unreadable)');
    else if (store && typeof store.exportData === 'function') {
      try {
        const snap = snapshotOf(store);
        empty = snap.total === 0;
        L.push(countsLine(snap.counts));
        L.push('WM_EMPTY = ' + (empty ? 'YES' : 'NO') + ' (rows=' + snap.total + ')');
      } catch (e) { bad('cannot read wm_*: ' + String((e && e.message) || e)); }
    }
    const phys = presence.ok ? physicalGuard() : presence;
    L.push('WM_PHYSICAL_EMPTY = ' + (phys.ok ? 'YES' : phys.code === 'WM_PHYSICAL_NOT_EMPTY' ? 'NO' : 'UNVERIFIABLE') + (phys.tables ? ' (wm_* tables checked=' + phys.tables + ')' : ''));
    if (!phys.ok) { L.push('CODE = ' + phys.code); for (const x of phys.lines) L.push('  ' + x); }
    if (!phys.ok && phys.code === 'WM_PHYSICAL_UNVERIFIABLE') bad('the physical wm_* namespace is incomplete or unreadable (WM_PHYSICAL_UNVERIFIABLE) — the environment cannot be verified');
    const proceed = ok && empty && phys.ok;
    L.push('IMPORT_WOULD_PROCEED = ' + (proceed ? 'YES' : 'NO' + (ok && !empty ? ' (wm_* is not empty — import aborts)' : ok && empty && !phys.ok ? ' (' + phys.code + ' — import aborts)' : '')));
    L.push('WRITES_PERFORMED = NO');
    L.push.apply(L, await platformLines());
    return { verdict: ok ? 'ENV_OK' : 'ENV_FAIL', text: L.join('\n') };
  }

  // IMPORT FROZEN FIXTURE — the single write of this harness: WmStore.importJSON(exact fixture), only into an empty wm_*.
  async function importFixture() {
    if (!isValid()) return invalidResult();
    const L = ['== IMPORT FROZEN FIXTURE ==', validHeader()];
    let attempted = false;
    const fail = msg => {
      L.push('FAIL: ' + msg);
      L.push('WRITE_ATTEMPTED = ' + (attempted ? 'YES' : 'NO'));
      return { verdict: 'IMPORT_FAIL', text: L.join('\n') };
    };
    const store = await getStore();
    if (!store || typeof store.importJSON !== 'function' || typeof store.exportData !== 'function') return fail('WmStore missing');
    if (!window.WorkingMemory || window.WorkingMemory.EXPORT_FORMAT !== EXPORT_FORMAT) return fail('WorkingMemory export format unexpected');

    const presence = physicalGuard(true);                                                                  // 1. the complete expected physical namespace must exist
    if (!presence.ok) {
      L.push('CODE = ' + presence.code);
      for (const x of presence.lines) L.push('  ' + x);
      return fail(presence.code + ' — abort before import; nothing was recreated, cleaned or changed (use an isolated browser profile)');
    }
    const before = snapshotOf(store);                                                                      // 2. logical emptiness
    if (before.total !== 0) return fail('WM not empty (rows=' + before.total + ') — abort; use an isolated browser profile');
    const phys = physicalGuard();                                                                          // 3. physical emptiness (data tables, FTS index, shadow tables)
    if (!phys.ok) {
      L.push('CODE = ' + phys.code);
      for (const x of phys.lines) L.push('  ' + x);
      return fail(phys.code + ' — abort before import; nothing was cleaned up or changed (use an isolated browser profile)');
    }
    L.push('WM_PHYSICAL_EMPTY = YES (wm_* tables checked=' + phys.tables + ')');

    const fixture = await fixtureIntegrity();
    if (fixture.problems.length) return fail(fixture.problems[0]);
    L.push('FIXTURE_RAW_SHA256 = ' + fixture.raw + ' (verified)');
    L.push('SEED_HASH(fixture) = ' + EXPECTED_SEED + ' (verified)');

    attempted = true;
    let res;
    try { res = await store.importJSON(JSON.parse(FIXTURE_JSON)); }
    catch (e) { return fail('importJSON threw: ' + String((e && e.message) || e)); }
    if (!res || res.ok !== true) {
      const detail = res ? [res.code, res.error].filter(Boolean).join(' ') : 'unknown';
      const extra = res && (res.rolledBack !== undefined || res.persistenceState !== undefined)
        ? ' [rolledBack=' + res.rolledBack + ' persistenceState=' + res.persistenceState + ']' : '';
      return fail('importJSON failed: ' + detail + extra);
    }
    if (res.data && res.data.noOp === true) return fail('import was no-op (unexpected on an empty store)');
    if (res.data) L.push('importJSON = ok imported=' + res.data.imported + ' unchanged=' + res.data.unchanged);

    const after = snapshotOf(store);
    L.push(countsLine(after.counts));
    for (const k of Object.keys(EXPECTED)) {
      if (after.counts[k] !== EXPECTED[k]) return fail('count ' + k + '=' + after.counts[k] + ' expected ' + EXPECTED[k] + ' (rows were written — clear this browser profile before retrying)');
    }
    const logical = await logicalHash(after.d);
    if (logical !== EXPECTED_LOGICAL) return fail('LOGICAL hash mismatch: ' + logical + ' (rows were written — clear this browser profile before retrying)');
    const seed = await seedHashFromExport(after.d);
    if (seed !== EXPECTED_SEED) return fail('post-import SEED_HASH mismatch: ' + seed + ' (rows were written — clear this browser profile before retrying)');
    L.push('LOGICAL_EXPORT_HASH = ' + logical);
    L.push('SEED_HASH = ' + seed);
    L.push('PASS: imported exact fixture; projects=2 items=9 sources=3 relations=1 item_sources=1 changes=16');
    L.push('Next: RUN FINGERPRINT, then close and reopen the page and run it again.');
    return { verdict: 'IMPORT_PASS', text: L.join('\n') };
  }

  // RUN FINGERPRINT — read-only; same output contract as the STEP 1 fingerprint script.
  async function runFingerprint() {
    if (!isValid()) return invalidResult();
    const store = await getStore();
    if (!store || typeof store.exportData !== 'function') return { verdict: 'FAIL', text: 'FINGERPRINT_FAIL\nFAIL: WmStore missing' };
    const snap = snapshotOf(store);
    const logical = await logicalHash(snap.d);
    const seed = await seedHashFromExport(snap.d);
    const statuses = snap.d.items.map(i => i.work_id + ':' + i.status).sort();
    const okCounts = countsMatch(snap.counts);
    const okHash = logical === EXPECTED_LOGICAL && seed === EXPECTED_SEED;
    const verdict = okCounts && okHash ? 'PASS' : 'FAIL';
    const L = ['FINGERPRINT_' + verdict, validHeader()];
    L.push.apply(L, await platformLines());
    L.push(countsLine(snap.counts));
    if (snap.total === 0) L.push('NOTE: wm_* is empty — nothing has been imported on this profile yet');
    L.push('work_id + status:');
    for (const s of statuses) L.push('  ' + s.replace(':', '  '));
    L.push('work_id_status = ' + statuses.join('|'));
    L.push('LOGICAL_EXPORT_HASH = ' + logical);
    L.push('SEED_HASH = ' + seed);
    L.push('EXPECTED_LOGICAL = ' + EXPECTED_LOGICAL);
    L.push('EXPECTED_SEED = ' + EXPECTED_SEED);
    L.push('WRITES_PERFORMED = NO');
    return { verdict, text: L.join('\n') };
  }

  // ── Screen (phone-first, no external resources) ─────────────────────────────────────────────────────────────────────────────
  function build() {
    const css = (node, styles) => { for (const k of Object.keys(styles)) node.style.setProperty(k, styles[k]); return node; };
    const make = (tag, props, styles) => {
      const node = document.createElement(tag);
      for (const k of Object.keys(props || {})) node[k] = props[k];
      return css(node, styles || {});
    };
    const root = make('div', { id: ROOT_ID }, {
      position: 'fixed', top: '0', right: '0', bottom: '0', left: '0', 'z-index': '2147483647', overflow: 'auto',
      background: '#ffffff', color: '#111111', font: '16px/1.4 system-ui, -apple-system, Roboto, sans-serif',
      padding: '0 0 32px 0', 'box-sizing': 'border-box', '-webkit-text-size-adjust': '100%'
    });
    root.setAttribute('role', 'main');
    root.setAttribute('aria-label', 'B1-DEVICE TEST — NON PRODUCTION');
    root.setAttribute('data-run-state', 'VERIFYING');
    const banner = make('div', {}, { background: '#b00020', color: '#ffffff', padding: '12px 14px' });
    banner.appendChild(make('div', { id: 'b1d-title', textContent: 'B1-DEVICE TEST — NON PRODUCTION' }, { 'font-weight': '700', 'font-size': '17px', 'letter-spacing': '0.2px' }));
    banner.appendChild(make('div', { id: 'b1d-sub', textContent: 'TEST ONLY · opened by ?b1device=1 · not part of the normal app UI' }, { 'font-size': '13px', opacity: '0.95' }));
    root.appendChild(banner);
    const body = make('div', {}, { padding: '12px 14px' });
    root.appendChild(body);
    const statusEl = make('div', { id: 'b1d-status', textContent: 'VERIFYING BUILD …' }, {
      padding: '8px 10px', margin: '0 0 10px 0', 'border-radius': '6px', background: '#fff3cd', color: '#5c4400', 'font-size': '13px', 'font-weight': '700', 'overflow-wrap': 'anywhere'
    });
    body.appendChild(statusEl);

    const buttons = [];
    const verdictEl = make('div', { id: 'b1d-verdict', textContent: '—' }, {
      'text-align': 'center', 'font-weight': '800', 'font-size': '26px', padding: '10px 8px', margin: '10px 0', 'border-radius': '8px',
      background: '#e0e0e0', color: '#333333', 'overflow-wrap': 'anywhere'
    });
    verdictEl.setAttribute('data-verdict', 'NONE');
    const out = make('pre', { id: 'b1d-out', textContent: 'Verifying the harness build before anything is enabled …' }, {
      margin: '0', padding: '10px', background: '#f4f4f4', border: '1px solid #cccccc', 'border-radius': '6px', 'white-space': 'pre-wrap',
      'overflow-wrap': 'anywhere', 'user-select': 'text', '-webkit-user-select': 'text', font: '13px/1.45 ui-monospace, Menlo, Consolas, monospace'
    });
    let busy = false;
    const COLORS = { PASS: '#1b7f3b', IMPORT_PASS: '#1b7f3b', ENV_OK: '#1b7f3b', FAIL: '#b00020', IMPORT_FAIL: '#b00020', ENV_FAIL: '#b00020', DEVICE_RUN_INVALID: '#7a0014' };
    const setVerdict = v => {
      verdictEl.textContent = v; verdictEl.setAttribute('data-verdict', v);
      css(verdictEl, { background: COLORS[v] || '#e0e0e0', color: COLORS[v] ? '#ffffff' : '#333333' });
    };
    const setEnabled = on => { for (const b of buttons) { b.disabled = !on; b.style.setProperty('opacity', on ? '1' : '0.4'); } };
    const runner = (label, action) => async () => {
      if (busy) return;
      busy = true;
      setEnabled(false);
      setVerdict('RUNNING'); out.textContent = label + ' …';
      try {
        const r = await action();
        out.textContent = r.text; setVerdict(r.verdict);
      } catch (e) {
        out.textContent = 'FAIL: ' + String((e && e.message) || e); setVerdict('FAIL');
      }
      setEnabled(isValid());
      busy = false;
    };
    const addButton = (id, label, action, bg) => {
      const b = make('button', { id, type: 'button', textContent: label, disabled: true }, {
        display: 'block', width: '100%', 'min-height': '54px', margin: '0 0 10px 0', padding: '12px', 'font-size': '16px', 'font-weight': '700',
        color: '#ffffff', background: bg, border: '0', 'border-radius': '8px', 'touch-action': 'manipulation', cursor: 'pointer', opacity: '0.4'
      });
      b.addEventListener('click', runner(label, action));
      buttons.push(b); body.appendChild(b);
    };
    addButton('b1d-check', 'CHECK ENVIRONMENT', checkEnvironment, '#37474f');
    addButton('b1d-import', 'IMPORT FROZEN FIXTURE', importFixture, '#0d47a1');
    addButton('b1d-fingerprint', 'RUN FINGERPRINT', runFingerprint, '#1b5e20');
    body.appendChild(verdictEl);
    body.appendChild(out);
    (document.body || document.documentElement).appendChild(root);

    // Verify the build first; only a VALID device run enables the buttons.
    verifyBuild().then(v => ({ v, error: null }), error => ({ v: null, error })).then(({ v, error }) => {
      if (error || !v) run = { state: 'INVALID', v: { problems: ['BUILD_VERIFICATION_ERROR: ' + String((error && error.message) || error)], self: '', pageExpected: null, urlBuild: null, online: null } };
      else run = { state: v.problems.length ? 'INVALID' : 'VALID', v };
      root.setAttribute('data-run-state', run.state);
      if (run.state === 'VALID') {
        statusEl.textContent = 'BUILD CONSISTENT · ' + HARNESS_BUILD_ID + ' · freshness NOT proven — compare with the expected build id BEFORE import';
        css(statusEl, { background: '#d1ecf1', color: '#0c5460' });
        out.textContent = validHeader() + '\n' + buildLines().join('\n') + '\n\nBEFORE IMPORT: compare HARNESS_BUILD above with the build id published for the exact reviewed / deployed HEAD. If it differs, stop.\nPress a button. CHECK ENVIRONMENT and RUN FINGERPRINT never change anything; IMPORT FROZEN FIXTURE writes only into an empty wm_*.';
        setEnabled(true);
      } else {
        const r = invalidResult();
        statusEl.textContent = 'STALE_HARNESS · DEVICE_RUN_INVALID';
        css(statusEl, { background: '#f8d7da', color: '#721c24' });
        out.textContent = r.text; setVerdict(r.verdict);
        setEnabled(false);
      }
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build, { once: true });
})();

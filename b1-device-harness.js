/* B1-DEVICE-01 — native TEST-ONLY harness.  NON PRODUCTION.
 *
 * Why: the Eruda / bookmarklet route of B1-DEVICE STEP 1 does not start reliably on Android (Samsung Internet / Chrome). This file
 * reproduces the STEP 1 reference behaviour (import + fingerprint) as an on-page screen that works with taps only.
 *
 * Entry point: ONLY `index.html?b1device=1`. The gate in index.html injects this file when (and only when) that query is present;
 * without it nothing in this file is ever loaded, so the normal UI is unchanged.
 *
 * Boundaries (asserted by tests/working-memory/b1-device-harness.test.cjs and b1-device-browser.test.mjs):
 *  - the ONLY write is the existing WmStore.importJSON (wm_* namespace), ONLY when wm_* is completely empty, ONLY the exact frozen fixture
 *  - nothing else is written: no Canon, wiz_ref, Continuity, ledger or registry access; no cache / storage writes
 *  - no network request, no model invocation, no external CDN
 *  - no API key / token access: no localStorage / sessionStorage / IndexedDB / cookie access of its own; the screen shows counts, ids,
 *    statuses, hashes and version strings only; no console output
 *  - nothing on this screen is Canon or runtime authority: it is a device-test aid
 */
(function () {
  'use strict';
  const ROOT_ID = 'b1device-root';
  if (document.getElementById(ROOT_ID)) return;                       // one instance only
  const SCRIPT = document.currentScript;                              // only valid while this file first executes

  // ── Frozen B1-DEVICE-01 checkpoints (three DIFFERENT hashes; never substitute one for another) ─────────────────────────────
  const EXPECTED_SEED = '780bfac4bce6442f46f5fc9827b0d8cc25cba3f4c80ad7e54bc2e87dabba1ec0';      // SEED_HASH (work-id mapping)
  const EXPECTED_LOGICAL = '9334861791b8f64db8575d802159ac7c2d197a17fad563920dfd154ea1114b2a';   // LOGICAL_EXPORT_HASH of WmStore.exportData()
  const FIXTURE_RAW_SHA256 = '29b0e3d2e2025f1fab8979ae40169be78ce455549573617b57bd213e45eb73d4'; // SHA-256 of the fixture file bytes
  const EXPECTED = { projects: 2, items: 9, sources: 3, relations: 1, item_sources: 1, changes: 16 };
  const EXPORT_FORMAT = 'eiti-working-memory-export/1';
  const LISTS = ['projects', 'sources', 'items', 'item_sources', 'relations', 'changes'];
  // The exact frozen fixture (file bytes, as one string).
  const FIXTURE_JSON = "{\"format\":\"eiti-working-memory-export/1\",\"projects\":[{\"project_id\":\"firn\",\"code\":\"FIRN\",\"name\":\"Project FIRN synthetic\",\"summary\":\"Deterministic FMB seed\",\"created_at\":\"2026-10-06T12:00:01.000Z\",\"updated_at\":\"2026-10-06T12:00:01.000Z\"},{\"project_id\":\"other\",\"code\":\"OTHER\",\"name\":\"Distractor OTHER\",\"summary\":\"Scope contamination bait\",\"created_at\":\"2026-10-06T12:00:03.000Z\",\"updated_at\":\"2026-10-06T12:00:03.000Z\"}],\"sources\":[{\"source_id\":\"src-firn-nav\",\"project_id\":\"firn\",\"surface\":\"NOTION\",\"role\":\"NAVIGATION\",\"title\":\"FIRN nav page\",\"locator\":\"notion://synthetic/firn-board\",\"revision\":null,\"note\":null,\"created_at\":\"2026-10-06T12:00:07.000Z\",\"updated_at\":\"2026-10-06T12:00:07.000Z\"},{\"source_id\":\"src-firn-primary\",\"project_id\":\"firn\",\"surface\":\"GITHUB\",\"role\":\"PRIMARY\",\"title\":\"FIRN primary repo\",\"locator\":\"github://synthetic/firn#main\",\"revision\":null,\"note\":null,\"created_at\":\"2026-10-06T12:00:05.000Z\",\"updated_at\":\"2026-10-06T12:00:05.000Z\"},{\"source_id\":\"src-other\",\"project_id\":\"other\",\"surface\":\"LOCAL\",\"role\":\"PRIMARY\",\"title\":\"OTHER local\",\"locator\":\"local://other/notes.md\",\"revision\":null,\"note\":null,\"created_at\":\"2026-10-06T12:00:09.000Z\",\"updated_at\":\"2026-10-06T12:00:09.000Z\"}],\"items\":[{\"work_id\":\"WRK-FIRN-20261006-001\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"NOTE\",\"status\":\"CURRENT\",\"priority\":\"P0\",\"title\":\"FIRN current focus: resume Gate B1 orientation\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":\"Confirm orientation with owner\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:12.000Z\",\"updated_at\":\"2026-10-06T12:00:12.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-002\",\"project_id\":\"firn\",\"thread\":\"parser\",\"type\":\"TASK\",\"status\":\"IN_PROGRESS\",\"priority\":\"P1\",\"title\":\"FIRN in-progress: polish parser adapters\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":\"Finish parser adapters\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:15.000Z\",\"updated_at\":\"2026-10-06T12:00:15.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-003\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"QUESTION\",\"status\":\"OPEN\",\"priority\":\"P1\",\"title\":\"FIRN open: clarify export scope\",\"summary\":null,\"body_md\":null,\"current_question\":\"What is in-scope for export?\",\"status_note\":null,\"next_action\":\"Ask owner about export scope\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:18.000Z\",\"updated_at\":\"2026-10-06T12:00:18.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-004\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"TASK\",\"status\":\"BLOCKED\",\"priority\":\"P2\",\"title\":\"FIRN blocked: waiting owner review\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":\"Waiting for owner review of protocol\",\"next_action\":null,\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:21.000Z\",\"updated_at\":\"2026-10-06T12:00:21.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-005\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"NOTE\",\"status\":\"UNKNOWN\",\"priority\":\"P3\",\"title\":\"FIRN unknown: unexplained latency spike\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:24.000Z\",\"updated_at\":\"2026-10-06T12:00:24.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-006\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"TASK\",\"status\":\"COMPLETED\",\"priority\":\"P2\",\"title\":\"FIRN completed: seed schema ready\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:27.000Z\",\"updated_at\":\"2026-10-06T12:00:27.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-007\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"HYPOTHESIS\",\"status\":\"OPEN\",\"priority\":\"P2\",\"title\":\"FIRN model proposal: try Graphiti donor\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"MODEL_PROPOSAL\",\"tags_json\":\"[\\\"graphiti\\\",\\\"proposal\\\"]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:30.000Z\",\"updated_at\":\"2026-10-06T12:00:30.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-FIRN-20261006-008\",\"project_id\":\"firn\",\"thread\":\"\",\"type\":\"DECISION\",\"status\":\"CURRENT\",\"priority\":\"P0\",\"title\":\"FIRN user decision: keep DEFAULT_MODE WORKING\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":null,\"provenance_class\":\"USER_DECISION\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:33.000Z\",\"updated_at\":\"2026-10-06T12:00:33.000Z\",\"resolved_at\":null,\"archived_at\":null},{\"work_id\":\"WRK-OTHER-20261006-001\",\"project_id\":\"other\",\"thread\":\"\",\"type\":\"TASK\",\"status\":\"OPEN\",\"priority\":\"P0\",\"title\":\"OTHER distractor open: secret decoy task\",\"summary\":null,\"body_md\":null,\"current_question\":null,\"status_note\":null,\"next_action\":\"Do not mix into FIRN\",\"provenance_class\":\"USER_NOTE\",\"tags_json\":\"[]\",\"non_canon\":1,\"created_at\":\"2026-10-06T12:00:36.000Z\",\"updated_at\":\"2026-10-06T12:00:36.000Z\",\"resolved_at\":null,\"archived_at\":null}],\"item_sources\":[{\"work_id\":\"WRK-FIRN-20261006-002\",\"source_id\":\"src-firn-primary\",\"is_primary\":1}],\"relations\":[{\"relation_id\":\"wmr_000016\",\"from_work_id\":\"WRK-FIRN-20261006-004\",\"to_work_id\":\"WRK-FIRN-20261006-002\",\"relation_type\":\"BLOCKED_BY\",\"created_at\":\"2026-10-06T12:00:39.000Z\"}],\"changes\":[{\"change_id\":\"wmc_000001\",\"work_id\":null,\"change_type\":\"CREATE_PROJECT\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"code\\\",\\\"created_at\\\",\\\"name\\\",\\\"project_id\\\",\\\"summary\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"project_id\\\":\\\"firn\\\",\\\"code\\\":\\\"FIRN\\\",\\\"name\\\":\\\"Project FIRN synthetic\\\",\\\"summary\\\":\\\"Deterministic FMB seed\\\",\\\"created_at\\\":\\\"2026-10-06T12:00:01.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:01.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:02.000Z\"},{\"change_id\":\"wmc_000002\",\"work_id\":null,\"change_type\":\"CREATE_PROJECT\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"code\\\",\\\"created_at\\\",\\\"name\\\",\\\"project_id\\\",\\\"summary\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"project_id\\\":\\\"other\\\",\\\"code\\\":\\\"OTHER\\\",\\\"name\\\":\\\"Distractor OTHER\\\",\\\"summary\\\":\\\"Scope contamination bait\\\",\\\"created_at\\\":\\\"2026-10-06T12:00:03.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:03.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:04.000Z\"},{\"change_id\":\"wmc_000003\",\"work_id\":null,\"change_type\":\"CREATE_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"locator\\\",\\\"note\\\",\\\"project_id\\\",\\\"revision\\\",\\\"role\\\",\\\"source_id\\\",\\\"surface\\\",\\\"title\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"source_id\\\":\\\"src-firn-primary\\\",\\\"project_id\\\":\\\"firn\\\",\\\"surface\\\":\\\"GITHUB\\\",\\\"role\\\":\\\"PRIMARY\\\",\\\"title\\\":\\\"FIRN primary repo\\\",\\\"locator\\\":\\\"github://synthetic/firn#main\\\",\\\"revision\\\":null,\\\"note\\\":null,\\\"created_at\\\":\\\"2026-10-06T12:00:05.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:05.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:06.000Z\"},{\"change_id\":\"wmc_000004\",\"work_id\":null,\"change_type\":\"CREATE_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"locator\\\",\\\"note\\\",\\\"project_id\\\",\\\"revision\\\",\\\"role\\\",\\\"source_id\\\",\\\"surface\\\",\\\"title\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"source_id\\\":\\\"src-firn-nav\\\",\\\"project_id\\\":\\\"firn\\\",\\\"surface\\\":\\\"NOTION\\\",\\\"role\\\":\\\"NAVIGATION\\\",\\\"title\\\":\\\"FIRN nav page\\\",\\\"locator\\\":\\\"notion://synthetic/firn-board\\\",\\\"revision\\\":null,\\\"note\\\":null,\\\"created_at\\\":\\\"2026-10-06T12:00:07.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:07.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:08.000Z\"},{\"change_id\":\"wmc_000005\",\"work_id\":null,\"change_type\":\"CREATE_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"locator\\\",\\\"note\\\",\\\"project_id\\\",\\\"revision\\\",\\\"role\\\",\\\"source_id\\\",\\\"surface\\\",\\\"title\\\",\\\"updated_at\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"source_id\\\":\\\"src-other\\\",\\\"project_id\\\":\\\"other\\\",\\\"surface\\\":\\\"LOCAL\\\",\\\"role\\\":\\\"PRIMARY\\\",\\\"title\\\":\\\"OTHER local\\\",\\\"locator\\\":\\\"local://other/notes.md\\\",\\\"revision\\\":null,\\\"note\\\":null,\\\"created_at\\\":\\\"2026-10-06T12:00:09.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:09.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:10.000Z\"},{\"change_id\":\"wmc_000006\",\"work_id\":\"WRK-FIRN-20261006-001\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-001\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"NOTE\\\",\\\"status\\\":\\\"CURRENT\\\",\\\"priority\\\":\\\"P0\\\",\\\"title\\\":\\\"FIRN current focus: resume Gate B1 orientation\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":\\\"Confirm orientation with owner\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:12.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:12.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:13.000Z\"},{\"change_id\":\"wmc_000007\",\"work_id\":\"WRK-FIRN-20261006-002\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-002\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"parser\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"IN_PROGRESS\\\",\\\"priority\\\":\\\"P1\\\",\\\"title\\\":\\\"FIRN in-progress: polish parser adapters\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":\\\"Finish parser adapters\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:15.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:15.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:16.000Z\"},{\"change_id\":\"wmc_000008\",\"work_id\":\"WRK-FIRN-20261006-003\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-003\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"QUESTION\\\",\\\"status\\\":\\\"OPEN\\\",\\\"priority\\\":\\\"P1\\\",\\\"title\\\":\\\"FIRN open: clarify export scope\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":\\\"What is in-scope for export?\\\",\\\"status_note\\\":null,\\\"next_action\\\":\\\"Ask owner about export scope\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:18.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:18.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:19.000Z\"},{\"change_id\":\"wmc_000009\",\"work_id\":\"WRK-FIRN-20261006-004\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-004\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"BLOCKED\\\",\\\"priority\\\":\\\"P2\\\",\\\"title\\\":\\\"FIRN blocked: waiting owner review\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":\\\"Waiting for owner review of protocol\\\",\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:21.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:21.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:22.000Z\"},{\"change_id\":\"wmc_000010\",\"work_id\":\"WRK-FIRN-20261006-005\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-005\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"NOTE\\\",\\\"status\\\":\\\"UNKNOWN\\\",\\\"priority\\\":\\\"P3\\\",\\\"title\\\":\\\"FIRN unknown: unexplained latency spike\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:24.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:24.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:25.000Z\"},{\"change_id\":\"wmc_000011\",\"work_id\":\"WRK-FIRN-20261006-006\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-006\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"COMPLETED\\\",\\\"priority\\\":\\\"P2\\\",\\\"title\\\":\\\"FIRN completed: seed schema ready\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:27.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:27.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:28.000Z\"},{\"change_id\":\"wmc_000012\",\"work_id\":\"WRK-FIRN-20261006-007\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-007\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"HYPOTHESIS\\\",\\\"status\\\":\\\"OPEN\\\",\\\"priority\\\":\\\"P2\\\",\\\"title\\\":\\\"FIRN model proposal: try Graphiti donor\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"MODEL_PROPOSAL\\\",\\\"tags_json\\\":\\\"[\\\\\\\"graphiti\\\\\\\",\\\\\\\"proposal\\\\\\\"]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:30.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:30.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:31.000Z\"},{\"change_id\":\"wmc_000013\",\"work_id\":\"WRK-FIRN-20261006-008\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-008\\\",\\\"project_id\\\":\\\"firn\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"DECISION\\\",\\\"status\\\":\\\"CURRENT\\\",\\\"priority\\\":\\\"P0\\\",\\\"title\\\":\\\"FIRN user decision: keep DEFAULT_MODE WORKING\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":null,\\\"provenance_class\\\":\\\"USER_DECISION\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:33.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:33.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:34.000Z\"},{\"change_id\":\"wmc_000014\",\"work_id\":\"WRK-OTHER-20261006-001\",\"change_type\":\"CREATE_ITEM\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"archived_at\\\",\\\"body_md\\\",\\\"created_at\\\",\\\"current_question\\\",\\\"next_action\\\",\\\"non_canon\\\",\\\"priority\\\",\\\"project_id\\\",\\\"provenance_class\\\",\\\"resolved_at\\\",\\\"status\\\",\\\"status_note\\\",\\\"summary\\\",\\\"tags_json\\\",\\\"thread\\\",\\\"title\\\",\\\"type\\\",\\\"updated_at\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-OTHER-20261006-001\\\",\\\"project_id\\\":\\\"other\\\",\\\"thread\\\":\\\"\\\",\\\"type\\\":\\\"TASK\\\",\\\"status\\\":\\\"OPEN\\\",\\\"priority\\\":\\\"P0\\\",\\\"title\\\":\\\"OTHER distractor open: secret decoy task\\\",\\\"summary\\\":null,\\\"body_md\\\":null,\\\"current_question\\\":null,\\\"status_note\\\":null,\\\"next_action\\\":\\\"Do not mix into FIRN\\\",\\\"provenance_class\\\":\\\"USER_NOTE\\\",\\\"tags_json\\\":\\\"[]\\\",\\\"non_canon\\\":1,\\\"created_at\\\":\\\"2026-10-06T12:00:36.000Z\\\",\\\"updated_at\\\":\\\"2026-10-06T12:00:36.000Z\\\",\\\"resolved_at\\\":null,\\\"archived_at\\\":null}\",\"created_at\":\"2026-10-06T12:00:37.000Z\"},{\"change_id\":\"wmc_000015\",\"work_id\":\"WRK-FIRN-20261006-002\",\"change_type\":\"LINK_SOURCE\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"is_primary\\\",\\\"source_id\\\",\\\"work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"work_id\\\":\\\"WRK-FIRN-20261006-002\\\",\\\"source_id\\\":\\\"src-firn-primary\\\",\\\"is_primary\\\":1}\",\"created_at\":\"2026-10-06T12:00:38.000Z\"},{\"change_id\":\"wmc_000017\",\"work_id\":\"WRK-FIRN-20261006-004\",\"change_type\":\"ADD_RELATION\",\"actor_class\":\"SYSTEM\",\"changed_fields_json\":\"[\\\"created_at\\\",\\\"from_work_id\\\",\\\"relation_id\\\",\\\"relation_type\\\",\\\"to_work_id\\\"]\",\"before_json\":null,\"after_json\":\"{\\\"relation_id\\\":\\\"wmr_000016\\\",\\\"from_work_id\\\":\\\"WRK-FIRN-20261006-004\\\",\\\"to_work_id\\\":\\\"WRK-FIRN-20261006-002\\\",\\\"relation_type\\\":\\\"BLOCKED_BY\\\",\\\"created_at\\\":\\\"2026-10-06T12:00:39.000Z\\\"}\",\"created_at\":\"2026-10-06T12:00:40.000Z\"}]}\n";

  let BUILD = 'UNKNOWN';
  try { BUILD = new URL(SCRIPT.src).searchParams.get('h') || 'UNKNOWN'; } catch (_) {}

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
      'HARNESS_BUILD = ' + BUILD,
      'ORIGIN_PATH = ' + location.origin + location.pathname,
      'SECURE_CONTEXT = ' + (window.isSecureContext ? 'YES' : 'NO'),
      'USER_AGENT = ' + navigator.userAgent,
    ];
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

  // ── Actions ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // CHECK ENVIRONMENT — read-only: nothing is created, changed or written.
  async function checkEnvironment() {
    const L = ['== CHECK ENVIRONMENT (read-only) =='];
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
    if (store && typeof store.exportData === 'function') {
      try {
        const snap = snapshotOf(store);
        empty = snap.total === 0;
        L.push(countsLine(snap.counts));
        L.push('WM_EMPTY = ' + (empty ? 'YES' : 'NO') + ' (rows=' + snap.total + ')');
      } catch (e) { bad('cannot read wm_*: ' + String((e && e.message) || e)); }
    }
    L.push('IMPORT_WOULD_PROCEED = ' + (ok && empty ? 'YES' : 'NO' + (ok && !empty ? ' (wm_* is not empty — import aborts)' : '')));
    L.push('WRITES_PERFORMED = NO');
    L.push.apply(L, await platformLines());
    return { verdict: ok ? 'ENV_OK' : 'ENV_FAIL', text: L.join('\n') };
  }

  // IMPORT FROZEN FIXTURE — the single write of this harness: WmStore.importJSON(exact fixture), only into an empty wm_*.
  async function importFixture() {
    const L = ['== IMPORT FROZEN FIXTURE =='];
    let attempted = false;
    const fail = msg => {
      L.push('FAIL: ' + msg);
      L.push('WRITE_ATTEMPTED = ' + (attempted ? 'YES' : 'NO'));
      return { verdict: 'IMPORT_FAIL', text: L.join('\n') };
    };
    const store = await getStore();
    if (!store || typeof store.importJSON !== 'function' || typeof store.exportData !== 'function') return fail('WmStore missing');
    if (!window.WorkingMemory || window.WorkingMemory.EXPORT_FORMAT !== EXPORT_FORMAT) return fail('WorkingMemory export format unexpected');

    const before = snapshotOf(store);
    if (before.total !== 0) return fail('WM not empty (rows=' + before.total + ') — abort; use an isolated browser profile');

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
    const store = await getStore();
    if (!store || typeof store.exportData !== 'function') return { verdict: 'FAIL', text: 'FINGERPRINT_FAIL\nFAIL: WmStore missing' };
    const snap = snapshotOf(store);
    const logical = await logicalHash(snap.d);
    const seed = await seedHashFromExport(snap.d);
    const statuses = snap.d.items.map(i => i.work_id + ':' + i.status).sort();
    const okCounts = countsMatch(snap.counts);
    const okHash = logical === EXPECTED_LOGICAL && seed === EXPECTED_SEED;
    const verdict = okCounts && okHash ? 'PASS' : 'FAIL';
    const L = ['FINGERPRINT_' + verdict];
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
    const banner = make('div', {}, { background: '#b00020', color: '#ffffff', padding: '12px 14px' });
    banner.appendChild(make('div', { id: 'b1d-title', textContent: 'B1-DEVICE TEST — NON PRODUCTION' }, { 'font-weight': '700', 'font-size': '17px', 'letter-spacing': '0.2px' }));
    banner.appendChild(make('div', { id: 'b1d-sub', textContent: 'TEST ONLY · opened by ?b1device=1 · not part of the normal app UI' }, { 'font-size': '13px', opacity: '0.95' }));
    root.appendChild(banner);
    const body = make('div', {}, { padding: '12px 14px' });
    root.appendChild(body);

    const buttons = [];
    const verdictEl = make('div', { id: 'b1d-verdict', textContent: '—' }, {
      'text-align': 'center', 'font-weight': '800', 'font-size': '26px', padding: '10px 8px', margin: '10px 0', 'border-radius': '8px',
      background: '#e0e0e0', color: '#333333', 'overflow-wrap': 'anywhere'
    });
    verdictEl.setAttribute('data-verdict', 'NONE');
    const out = make('pre', { id: 'b1d-out', textContent: 'Press a button. CHECK ENVIRONMENT and RUN FINGERPRINT never change anything; IMPORT FROZEN FIXTURE writes only into an empty wm_*.' }, {
      margin: '0', padding: '10px', background: '#f4f4f4', border: '1px solid #cccccc', 'border-radius': '6px', 'white-space': 'pre-wrap',
      'overflow-wrap': 'anywhere', 'user-select': 'text', '-webkit-user-select': 'text', font: '13px/1.45 ui-monospace, Menlo, Consolas, monospace'
    });
    let busy = false;
    const COLORS = { PASS: '#1b7f3b', IMPORT_PASS: '#1b7f3b', ENV_OK: '#1b7f3b', FAIL: '#b00020', IMPORT_FAIL: '#b00020', ENV_FAIL: '#b00020' };
    const setVerdict = v => {
      verdictEl.textContent = v; verdictEl.setAttribute('data-verdict', v);
      css(verdictEl, { background: COLORS[v] || '#e0e0e0', color: COLORS[v] ? '#ffffff' : '#333333' });
    };
    const run = (label, action) => async () => {
      if (busy) return;
      busy = true;
      for (const b of buttons) b.disabled = true;
      setVerdict('RUNNING'); out.textContent = label + ' …';
      try {
        const r = await action();
        out.textContent = r.text; setVerdict(r.verdict);
      } catch (e) {
        out.textContent = 'FAIL: ' + String((e && e.message) || e); setVerdict('FAIL');
      }
      for (const b of buttons) b.disabled = false;
      busy = false;
    };
    const addButton = (id, label, action, bg) => {
      const b = make('button', { id, type: 'button', textContent: label }, {
        display: 'block', width: '100%', 'min-height': '54px', margin: '0 0 10px 0', padding: '12px', 'font-size': '16px', 'font-weight': '700',
        color: '#ffffff', background: bg, border: '0', 'border-radius': '8px', 'touch-action': 'manipulation', cursor: 'pointer'
      });
      b.addEventListener('click', run(label, action));
      buttons.push(b); body.appendChild(b);
    };
    addButton('b1d-check', 'CHECK ENVIRONMENT', checkEnvironment, '#37474f');
    addButton('b1d-import', 'IMPORT FROZEN FIXTURE', importFixture, '#0d47a1');
    addButton('b1d-fingerprint', 'RUN FINGERPRINT', runFingerprint, '#1b5e20');
    body.appendChild(verdictEl);
    body.appendChild(out);
    (document.body || document.documentElement).appendChild(root);
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build, { once: true });
})();

BEGIN TRANSACTION;
CREATE TABLE audit_log (
  timestamp  TEXT NOT NULL,
  operation  TEXT NOT NULL,
  target_id  TEXT,
  actor      TEXT NOT NULL,
  result     TEXT NOT NULL
);
INSERT INTO "audit_log" VALUES('2026-09-21T15:16:17Z','SEED','goal-phase1-arch','RUNNER','seeded goal + open_loop');
INSERT INTO "audit_log" VALUES('2026-09-21T15:16:17Z','APPLY_MODEL_PROPOSAL','evt-001','MODEL','stored as PROPOSED; NEVER ACTIVE alone');
INSERT INTO "audit_log" VALUES('2026-09-21T15:16:17Z','APPLY_USER_DECISION','evt-002','USER','ACTIVE=state-e170110094c3; prior proposals REJECTED/SUPERSEDED; no deletes');
INSERT INTO "audit_log" VALUES('2026-09-21T15:16:17Z','APPLY_MODEL_PROPOSAL','evt-003','MODEL','stored; proposal REJECTED against existing ACTIVE; no second ACTIVE');
INSERT INTO "audit_log" VALUES('2026-09-21T15:16:17Z','APPLY_RESEARCH_CLAIM','evt-004','MODEL','stored as HELD; NOT authoritative ACTIVE');
INSERT INTO "audit_log" VALUES('2026-09-21T15:16:17Z','QUERY_RESUME','evt-005','USER','resume projection');
CREATE TABLE events (
  event_id     TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'MODEL_PROPOSAL', 'USER_DECISION', 'RESEARCH_CLAIM', 'QUERY_RESUME'
  )),
  source_actor TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
INSERT INTO "events" VALUES('evt-001','Use Graphiti in Phase 1.','MODEL_PROPOSAL','MODEL','2026-09-21T15:16:17Z');
INSERT INTO "events" VALUES('evt-002','Phase 1 will proceed without Graphiti.','USER_DECISION','USER','2026-09-21T15:16:17Z');
INSERT INTO "events" VALUES('evt-003','Use Graphiti in Phase 1.','MODEL_PROPOSAL','MODEL','2026-09-21T15:16:17Z');
INSERT INTO "events" VALUES('evt-004','Phase 1 is production-authorized.','RESEARCH_CLAIM','MODEL','2026-09-21T15:16:17Z');
INSERT INTO "events" VALUES('evt-005','Where did we stop?','QUERY_RESUME','USER','2026-09-21T15:16:17Z');
CREATE TABLE goals (
  goal_id    TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);
INSERT INTO "goals" VALUES('goal-phase1-arch','Phase 1 architecture choice','OPEN','2026-09-21T15:16:17Z');
CREATE TABLE open_loops (
  loop_id    TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);
INSERT INTO "open_loops" VALUES('loop-prod-auth','Is Phase 1 production-authorized?','OPEN','2026-09-21T15:16:17Z');
CREATE TABLE relations (
  relation_id   TEXT PRIMARY KEY,
  from_id       TEXT NOT NULL,
  to_id         TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'SUPPORTS', 'CONTRADICTS', 'SUPERSEDES', 'REJECTED_BECAUSE'
  )),
  rationale     TEXT,
  created_at    TEXT NOT NULL
);
INSERT INTO "relations" VALUES('rel-adff4d7e84f3','state-e170110094c3','state-8926784ae273','REJECTED_BECAUSE','USER_DECISION rejects conflicting MODEL_PROPOSAL (Graphiti branch)','2026-09-21T15:16:17Z');
INSERT INTO "relations" VALUES('rel-e4d23b6d9142','state-e749ab40770a','state-e170110094c3','CONTRADICTS','MODEL_PROPOSAL re-assert without USER_DECISION; current decision stands','2026-09-21T15:16:17Z');
INSERT INTO "relations" VALUES('rel-276e8490e0ba','state-0c862aefacd7','state-e170110094c3','CONTRADICTS','unsupported RESEARCH_CLAIM does not override ACTIVE decision','2026-09-21T15:16:17Z');
CREATE TABLE states (
  state_id     TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  state_status TEXT NOT NULL CHECK (state_status IN (
    'ACTIVE', 'REJECTED', 'SUPERSEDED', 'UNKNOWN', 'HELD', 'PROPOSED'
  )),
  event_id     TEXT NOT NULL REFERENCES events(event_id),
  created_at   TEXT NOT NULL
);
INSERT INTO "states" VALUES('state-8926784ae273','Use Graphiti in Phase 1.','REJECTED','evt-001','2026-09-21T15:16:17Z');
INSERT INTO "states" VALUES('state-e170110094c3','Phase 1 will proceed without Graphiti.','ACTIVE','evt-002','2026-09-21T15:16:17Z');
INSERT INTO "states" VALUES('state-e749ab40770a','Use Graphiti in Phase 1.','REJECTED','evt-003','2026-09-21T15:16:17Z');
INSERT INTO "states" VALUES('state-0c862aefacd7','Phase 1 is production-authorized.','HELD','evt-004','2026-09-21T15:16:17Z');
COMMIT;

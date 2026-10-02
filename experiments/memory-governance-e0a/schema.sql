-- E0-A Ownership & Governance Conformance Probe — isolated schema
-- Deterministic; no LLM; no Graphiti/Kuzu/FalkorDB.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'MODEL_PROPOSAL', 'USER_DECISION', 'RESEARCH_CLAIM', 'QUERY_RESUME'
  )),
  source_actor TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS states (
  state_id     TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  state_status TEXT NOT NULL CHECK (state_status IN (
    'ACTIVE', 'REJECTED', 'SUPERSEDED', 'UNKNOWN', 'HELD', 'PROPOSED'
  )),
  event_id     TEXT NOT NULL REFERENCES events(event_id),
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relations (
  relation_id   TEXT PRIMARY KEY,
  from_id       TEXT NOT NULL,
  to_id         TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'SUPPORTS', 'CONTRADICTS', 'SUPERSEDES', 'REJECTED_BECAUSE'
  )),
  rationale     TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  timestamp  TEXT NOT NULL,
  operation  TEXT NOT NULL,
  target_id  TEXT,
  actor      TEXT NOT NULL,
  result     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  goal_id    TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS open_loops (
  loop_id    TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);

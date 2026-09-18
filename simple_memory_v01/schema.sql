-- Simple Memory Resume v0.1
-- SQLite sandbox only. Not Velantrim architecture.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS memory_items (
    memory_id   TEXT PRIMARY KEY,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('bio', 'thought', 'work_state', 'note')),
    title       TEXT,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    session_id  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_items(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_items(created_at);

-- FTS5 for convenient retrieval (optional path; demoted if unavailable)
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    memory_id UNINDEXED,
    title,
    content,
    memory_type UNINDEXED,
    content='memory_items',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS memory_items_ai AFTER INSERT ON memory_items BEGIN
  INSERT INTO memory_fts(rowid, memory_id, title, content, memory_type)
  VALUES (new.rowid, new.memory_id, new.title, new.content, new.memory_type);
END;

CREATE TRIGGER IF NOT EXISTS memory_items_ad AFTER DELETE ON memory_items BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, memory_id, title, content, memory_type)
  VALUES ('delete', old.rowid, old.memory_id, old.title, old.content, old.memory_type);
END;

CREATE TRIGGER IF NOT EXISTS memory_items_au AFTER UPDATE ON memory_items BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, memory_id, title, content, memory_type)
  VALUES ('delete', old.rowid, old.memory_id, old.title, old.content, old.memory_type);
  INSERT INTO memory_fts(rowid, memory_id, title, content, memory_type)
  VALUES (new.rowid, new.memory_id, new.title, new.content, new.memory_type);
END;

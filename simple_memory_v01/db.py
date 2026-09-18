
"""SQLite helpers for simple memory sandbox."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_PATH = Path(__file__).with_name("schema.sql")

DEFAULT_DB = Path(__file__).resolve().parent / "data" / "simple_memory.sqlite3"


def connect(db_path: str | Path) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: str | Path) -> Path:
    path = Path(db_path)
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    conn = connect(path)
    try:
        try:
            conn.executescript(schema)
        except sqlite3.OperationalError as exc:
            # FTS5 may be unavailable in some builds — fall back to base table only.
            if "fts5" not in str(exc).lower() and "fts" not in str(exc).lower():
                raise
            conn.executescript(
                """
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
                """
            )
        conn.commit()
    finally:
        conn.close()
    return path


def fts_available(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts'"
    ).fetchone()
    return row is not None

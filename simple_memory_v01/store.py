
"""Remember / recall / list — no LLM, no embeddings."""
from __future__ import annotations

import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from .db import connect, fts_available, init_db

ALLOWED_TYPES = ("bio", "thought", "work_state", "note")


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id() -> str:
    return f"mem:{uuid.uuid4().hex[:8]}"


def remember(
    db_path: str,
    *,
    memory_type: str,
    content: str,
    title: str | None = None,
    session_id: str = "session",
) -> dict[str, Any]:
    if memory_type not in ALLOWED_TYPES:
        raise ValueError(f"memory_type must be one of {ALLOWED_TYPES}")
    text = content.strip()
    if not text:
        raise ValueError("content must be non-empty")
    init_db(db_path)
    mid = _new_id()
    created = _utc_now()
    title_val = (title or _default_title(memory_type, text)).strip()
    conn = connect(db_path)
    try:
        conn.execute(
            """
            INSERT INTO memory_items (memory_id, memory_type, title, content, created_at, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (mid, memory_type, title_val, text, created, session_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "memory_id": mid,
        "memory_type": memory_type,
        "title": title_val,
        "created_at": created,
        "session_id": session_id,
    }


def _default_title(memory_type: str, content: str) -> str:
    first = content.strip().splitlines()[0].strip()
    if len(first) > 60:
        first = first[:57] + "..."
    return first or memory_type


def list_memories(db_path: str, memory_type: str | None = None, limit: int = 50) -> list[dict]:
    init_db(db_path)
    conn = connect(db_path)
    try:
        if memory_type:
            rows = conn.execute(
                """
                SELECT memory_id, memory_type, title, content, created_at, session_id
                FROM memory_items WHERE memory_type = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (memory_type, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT memory_id, memory_type, title, content, created_at, session_id
                FROM memory_items ORDER BY created_at DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def latest_work(db_path: str) -> dict | None:
    items = list_memories(db_path, memory_type="work_state", limit=1)
    return items[0] if items else None


_TYPE_HINTS = {
    "bio": re.compile(r"биограф|о себе|родил|детств|biography|about me", re.I),
    "thought": re.compile(r"мысл|thought|кажется|идея", re.I),
    "work_state": re.compile(
        r"работа|занимал|остановил|следующ|проект|work|resume|продолж", re.I
    ),
}


def _prefer_type(query: str) -> str | None:
    for t, pat in _TYPE_HINTS.items():
        if pat.search(query):
            return t
    return None


def recall(db_path: str, query: str, limit: int = 5) -> dict[str, Any]:
    """Retrieve top relevant memories. No LLM. Max `limit` (default 5)."""
    init_db(db_path)
    q = query.strip()
    prefer = _prefer_type(q)
    conn = connect(db_path)
    try:
        rows: list[sqlite3.Row] = []
        if prefer == "work_state" and re.search(r"остановил|следующ|latest|resume|продолж|чем я", q, re.I):
            rows = conn.execute(
                """
                SELECT memory_id, memory_type, title, content, created_at, session_id
                FROM memory_items WHERE memory_type = 'work_state'
                ORDER BY created_at DESC LIMIT ?
                """,
                (min(limit, 3),),
            ).fetchall()
        elif prefer in ("bio", "thought", "work_state", "note"):
            # Prefer typed match, then FTS/like within or across
            typed = conn.execute(
                """
                SELECT memory_id, memory_type, title, content, created_at, session_id
                FROM memory_items WHERE memory_type = ?
                ORDER BY created_at DESC LIMIT ?
                """,
                (prefer, limit),
            ).fetchall()
            # If query has extra keywords, filter by LIKE
            keywords = _keywords(q)
            if keywords and typed:
                filtered = [r for r in typed if _match_keywords(dict(r), keywords)]
                rows = filtered or list(typed)
            else:
                rows = list(typed)
            if len(rows) < limit:
                extra = _text_search(conn, q, limit=limit, exclude_ids={r["memory_id"] for r in rows})
                rows = list(rows) + extra
                rows = rows[:limit]
        else:
            rows = _text_search(conn, q, limit=limit)

        items = [dict(r) for r in rows][:limit]
        return {
            "query": q,
            "preferred_type": prefer,
            "retrieved_count": len(items),
            "retrieved_ids": [i["memory_id"] for i in items],
            "items": items,
            "empty": len(items) == 0,
        }
    finally:
        conn.close()


def _keywords(query: str) -> list[str]:
    stop = {
        "что", "я", "о", "об", "про", "говорил", "говорила", "рассказал", "рассказывал",
        "своих", "своей", "тогда", "чем", "где", "на", "чём", "the", "a", "about", "my",
        "and", "or", "in", "of", "to", "what", "did", "was", "were", "how",
    }
    toks = re.findall(r"[A-Za-zА-Яа-яЁё0-9_-]{3,}", query.lower())
    return [t for t in toks if t not in stop]


def _match_keywords(item: dict, keywords: list[str]) -> bool:
    blob = f"{item.get('title') or ''} {item.get('content') or ''}".lower()
    return any(k in blob for k in keywords)


def _text_search(conn: sqlite3.Connection, query: str, limit: int, exclude_ids: set[str] | None = None) -> list:
    exclude_ids = exclude_ids or set()
    keywords = _keywords(query)
    results: list = []
    if fts_available(conn) and keywords:
        # Simple FTS: join keywords with OR
        fts_q = " OR ".join(f'"{k}"' for k in keywords[:8])
        try:
            rows = conn.execute(
                """
                SELECT m.memory_id, m.memory_type, m.title, m.content, m.created_at, m.session_id
                FROM memory_fts f
                JOIN memory_items m ON m.memory_id = f.memory_id
                WHERE memory_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_q, limit * 2),
            ).fetchall()
            for r in rows:
                if r["memory_id"] not in exclude_ids:
                    results.append(r)
                if len(results) >= limit:
                    return results
        except sqlite3.OperationalError:
            pass
    # LIKE fallback
    if keywords:
        clauses = " OR ".join(["(lower(title) LIKE ? OR lower(content) LIKE ?)"] * len(keywords[:6]))
        params: list[str] = []
        for k in keywords[:6]:
            params.extend([f"%{k}%", f"%{k}%"])
        rows = conn.execute(
            f"""
            SELECT memory_id, memory_type, title, content, created_at, session_id
            FROM memory_items
            WHERE {clauses}
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (*params, limit * 2),
        ).fetchall()
        for r in rows:
            if r["memory_id"] not in exclude_ids:
                results.append(r)
            if len(results) >= limit:
                break
    return results[:limit]

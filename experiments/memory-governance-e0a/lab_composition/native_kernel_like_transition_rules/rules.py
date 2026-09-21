"""LAB ONLY: apply admission into E0-A SQLite schema. Not Native Kernel."""
from __future__ import annotations
import sqlite3
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Optional


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class ApplyError(ValueError):
    pass


@dataclass(frozen=True)
class TransitionReceipt:
    receipt_id: str
    event_id: str
    outcome: str
    target_status: str
    from_state_id: Optional[str]
    to_state_id: Optional[str]
    authority_class: str
    rationale: str
    lab_component: str = "native_kernel_like_transition_rules"

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def apply_admission(
    conn: sqlite3.Connection,
    *,
    event: Mapping[str, Any],
    outcome: str,
    target_status: str,
    rationale: str,
    audit_fn=None,
) -> TransitionReceipt:
    """Persist transition. Never DELETE prior rows."""
    et = event["event_type"]
    actor = str(event.get("source_actor", "UNKNOWN"))
    event_id = str(event["event_id"])
    content = str(event.get("content", ""))

    if target_status == "ACTIVE" and et != "USER_DECISION":
        raise ApplyError("authority: only USER_DECISION may become ACTIVE decision")
    if target_status == "ACTIVE" and actor != "USER":
        raise ApplyError("authority: ACTIVE decision requires USER source_actor")

    from_id: Optional[str] = None
    to_id: Optional[str] = None
    now = _now()

    if et == "QUERY_RESUME" or target_status == "RESUME_QUERY":
        rid = TransitionReceipt(
            receipt_id=_uid("rcpt"),
            event_id=event_id,
            outcome=outcome,
            target_status=target_status,
            from_state_id=None,
            to_state_id=None,
            authority_class=actor,
            rationale=rationale,
        )
        if audit_fn:
            audit_fn("APPLY_RESUME_QUERY", event_id, actor, rationale)
        return rid

    # Ensure event row exists (idempotent insert by caller usually)
    # Create state
    to_id = _uid("state")

    if target_status == "ACTIVE" and et == "USER_DECISION":
        prior = list(conn.execute("SELECT * FROM states WHERE state_status='ACTIVE'"))
        for a in prior:
            from_id = a["state_id"]
            conn.execute(
                "UPDATE states SET state_status='SUPERSEDED' WHERE state_id=?",
                (from_id,),
            )
            conn.execute(
                "INSERT INTO relations(relation_id, from_id, to_id, relation_type, rationale, created_at) VALUES (?,?,?,?,?,?)",
                (_uid("rel"), to_id, from_id, "SUPERSEDES", "USER_DECISION supersedes prior ACTIVE", now),
            )
        conn.execute(
            "INSERT INTO states(state_id, content, state_status, event_id, created_at) VALUES (?,?,?,?,?)",
            (to_id, content, "ACTIVE", event_id, now),
        )
        for p in list(conn.execute("SELECT * FROM states WHERE state_status='PROPOSED'")):
            conn.execute(
                "UPDATE states SET state_status='REJECTED' WHERE state_id=?",
                (p["state_id"],),
            )
            conn.execute(
                "INSERT INTO relations(relation_id, from_id, to_id, relation_type, rationale, created_at) VALUES (?,?,?,?,?,?)",
                (
                    _uid("rel"),
                    to_id,
                    p["state_id"],
                    "REJECTED_BECAUSE",
                    "USER_DECISION rejects conflicting MODEL_PROPOSAL (Graphiti branch)",
                    now,
                ),
            )
        if audit_fn:
            audit_fn("APPLY_USER_DECISION", event_id, actor, f"ACTIVE={to_id}; no deletes")

    elif target_status == "PROPOSED":
        conn.execute(
            "INSERT INTO states(state_id, content, state_status, event_id, created_at) VALUES (?,?,?,?,?)",
            (to_id, content, "PROPOSED", event_id, now),
        )
        if audit_fn:
            audit_fn("APPLY_MODEL_PROPOSAL", event_id, actor, "stored as PROPOSED; NEVER ACTIVE alone")

    elif target_status == "REJECTED":
        conn.execute(
            "INSERT INTO states(state_id, content, state_status, event_id, created_at) VALUES (?,?,?,?,?)",
            (to_id, content, "REJECTED", event_id, now),
        )
        active = list(conn.execute("SELECT * FROM states WHERE state_status='ACTIVE'"))
        for a in active:
            conn.execute(
                "INSERT INTO relations(relation_id, from_id, to_id, relation_type, rationale, created_at) VALUES (?,?,?,?,?,?)",
                (
                    _uid("rel"),
                    to_id,
                    a["state_id"],
                    "CONTRADICTS",
                    "MODEL_PROPOSAL re-assert without USER_DECISION; current decision stands",
                    now,
                ),
            )
            conn.execute(
                "INSERT INTO relations(relation_id, from_id, to_id, relation_type, rationale, created_at) VALUES (?,?,?,?,?,?)",
                (
                    _uid("rel"),
                    a["state_id"],
                    to_id,
                    "REJECTED_BECAUSE",
                    "ACTIVE decision rejects re-asserted MODEL_PROPOSAL",
                    now,
                ),
            )
        if audit_fn:
            audit_fn(
                "APPLY_MODEL_PROPOSAL",
                event_id,
                actor,
                "stored; proposal REJECTED against existing ACTIVE; no second ACTIVE",
            )

    elif target_status == "HELD":
        conn.execute(
            "INSERT INTO states(state_id, content, state_status, event_id, created_at) VALUES (?,?,?,?,?)",
            (to_id, content, "HELD", event_id, now),
        )
        for a in list(conn.execute("SELECT * FROM states WHERE state_status='ACTIVE'")):
            conn.execute(
                "INSERT INTO relations(relation_id, from_id, to_id, relation_type, rationale, created_at) VALUES (?,?,?,?,?,?)",
                (
                    _uid("rel"),
                    to_id,
                    a["state_id"],
                    "CONTRADICTS",
                    "unsupported RESEARCH_CLAIM does not override ACTIVE decision",
                    now,
                ),
            )
        if audit_fn:
            audit_fn("APPLY_RESEARCH_CLAIM", event_id, actor, "stored as HELD; NOT authoritative ACTIVE")

    else:
        raise ApplyError(f"unsupported target_status={target_status}")

    return TransitionReceipt(
        receipt_id=_uid("rcpt"),
        event_id=event_id,
        outcome=outcome,
        target_status=target_status,
        from_state_id=from_id,
        to_state_id=to_id,
        authority_class=actor,
        rationale=rationale,
    )

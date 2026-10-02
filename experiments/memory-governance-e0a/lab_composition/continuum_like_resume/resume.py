"""LAB ONLY: resume projection. Not Continuum."""
from __future__ import annotations
import sqlite3
from dataclasses import asdict, dataclass
from typing import Any, Optional


@dataclass
class ResumeBundle:
    current_goal: Optional[dict[str, Any]]
    current_state: Optional[dict[str, Any]]
    rationale: list[dict[str, Any]]
    rejected_graphiti_branch: list[dict[str, Any]]
    open_authorization_question: Optional[dict[str, Any]]
    next_action: str
    all_active_count: int
    lab_component: str = "continuum_like_resume"

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def project_resume(conn: sqlite3.Connection) -> ResumeBundle:
    goals = [dict(r) for r in conn.execute("SELECT * FROM goals WHERE status='OPEN'")]
    active = [dict(r) for r in conn.execute(
        "SELECT * FROM states WHERE state_status='ACTIVE' ORDER BY created_at"
    )]
    rejected = [dict(r) for r in conn.execute(
        "SELECT * FROM states WHERE state_status='REJECTED' ORDER BY created_at"
    )]
    rejected_graphiti = [s for s in rejected if "Graphiti" in (s.get("content") or "")]
    open_loops = [dict(r) for r in conn.execute(
        "SELECT * FROM open_loops WHERE status='OPEN'"
    )]
    rationale_rows: list[dict[str, Any]] = []
    if active:
        aid = active[0]["state_id"]
        rationale_rows = [dict(r) for r in conn.execute(
            "SELECT * FROM relations WHERE from_id=? OR to_id=? ORDER BY created_at",
            (aid, aid),
        )]
    next_action = (
        "Resolve open authorization question before treating any RESEARCH_CLAIM as production authority."
        if open_loops
        else "Continue from ACTIVE decision."
    )
    return ResumeBundle(
        current_goal=goals[0] if goals else None,
        current_state=active[0] if active else None,
        rationale=rationale_rows,
        rejected_graphiti_branch=rejected_graphiti,
        open_authorization_question=open_loops[0] if open_loops else None,
        next_action=next_action,
        all_active_count=len(active),
    )

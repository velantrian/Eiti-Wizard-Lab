#!/usr/bin/env python3
"""E0-A Ownership & Governance Conformance Probe runner.

Deterministic apply / project / resume. NO LLM. NO Graphiti.
Hardcoded fixture event types only.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "schema.sql"
FIXTURE_PATH = ROOT / "fixture.json"
DEFAULT_DB = ROOT / "e0a.sqlite3"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class GovernanceRunner:
    def __init__(self, db_path: Path | str = DEFAULT_DB):
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")

    def close(self) -> None:
        self.conn.close()

    def init_schema(self) -> None:
        sql = SCHEMA_PATH.read_text(encoding="utf-8")
        self.conn.executescript(sql)
        self.conn.commit()

    def audit(self, operation: str, target_id: Optional[str], actor: str, result: str) -> None:
        self.conn.execute(
            "INSERT INTO audit_log(timestamp, operation, target_id, actor, result) VALUES (?,?,?,?,?)",
            (_now(), operation, target_id, actor, result),
        )

    def seed(self, fixture: dict) -> None:
        g = fixture["seed"]["goal"]
        self.conn.execute(
            "INSERT OR REPLACE INTO goals(goal_id, content, status, created_at) VALUES (?,?,?,?)",
            (g["goal_id"], g["content"], g["status"], _now()),
        )
        ol = fixture["seed"]["open_loop"]
        self.conn.execute(
            "INSERT OR REPLACE INTO open_loops(loop_id, content, status, created_at) VALUES (?,?,?,?)",
            (ol["loop_id"], ol["content"], ol["status"], _now()),
        )
        self.audit("SEED", g["goal_id"], "RUNNER", "seeded goal + open_loop")
        self.conn.commit()

    def _insert_event(self, step: dict) -> None:
        self.conn.execute(
            "INSERT INTO events(event_id, content, event_type, source_actor, created_at) VALUES (?,?,?,?,?)",
            (
                step["event_id"],
                step["content"],
                step["event_type"],
                step["source_actor"],
                _now(),
            ),
        )

    def _active_states(self) -> list[sqlite3.Row]:
        return list(
            self.conn.execute(
                "SELECT * FROM states WHERE state_status = 'ACTIVE' ORDER BY created_at"
            )
        )

    def _create_state(self, content: str, status: str, event_id: str) -> str:
        sid = _uid("state")
        self.conn.execute(
            "INSERT INTO states(state_id, content, state_status, event_id, created_at) VALUES (?,?,?,?,?)",
            (sid, content, status, event_id, _now()),
        )
        return sid

    def _relate(
        self, from_id: str, to_id: str, relation_type: str, rationale: str
    ) -> str:
        rid = _uid("rel")
        self.conn.execute(
            "INSERT INTO relations(relation_id, from_id, to_id, relation_type, rationale, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (rid, from_id, to_id, relation_type, rationale, _now()),
        )
        return rid

    def apply_model_proposal(self, step: dict) -> dict[str, Any]:
        """MODEL_PROPOSAL: store event; may create non-ACTIVE proposal state;
        NEVER becomes USER_DECISION or ACTIVE decision alone."""
        self._insert_event(step)
        active = self._active_states()
        # Always create a PROPOSED (non-ACTIVE) state for the proposal.
        prop_id = self._create_state(step["content"], "PROPOSED", step["event_id"])
        if active:
            # Re-assert without new USER_DECISION: keep current ACTIVE; reject branch.
            for a in active:
                self._relate(
                    prop_id,
                    a["state_id"],
                    "CONTRADICTS",
                    "MODEL_PROPOSAL re-assert without USER_DECISION; current decision stands",
                )
                # Mark proposal REJECTED relative to active decision (do not delete).
                self.conn.execute(
                    "UPDATE states SET state_status = 'REJECTED' WHERE state_id = ?",
                    (prop_id,),
                )
            self.audit(
                "APPLY_MODEL_PROPOSAL",
                step["event_id"],
                step["source_actor"],
                "stored; proposal REJECTED against existing ACTIVE; no second ACTIVE",
            )
            self.conn.commit()
            return {
                "ok": True,
                "event_id": step["event_id"],
                "proposal_state_id": prop_id,
                "proposal_status": "REJECTED",
                "active": [dict(a) for a in active],
                "note": "no second ACTIVE; current decision preserved",
            }
        # No ACTIVE yet: proposal stored as PROPOSED only — never ACTIVE alone.
        self.audit(
            "APPLY_MODEL_PROPOSAL",
            step["event_id"],
            step["source_actor"],
            "stored as PROPOSED; NEVER ACTIVE alone",
        )
        self.conn.commit()
        return {
            "ok": True,
            "event_id": step["event_id"],
            "proposal_state_id": prop_id,
            "proposal_status": "PROPOSED",
            "active": [],
            "note": "MODEL_PROPOSAL is not USER_DECISION and is not ACTIVE",
        }

    def apply_user_decision(self, step: dict) -> dict[str, Any]:
        """USER_DECISION: becomes ACTIVE; prior conflicting proposals REJECTED/SUPERSEDED
        via relation; NEVER delete old rows."""
        self._insert_event(step)
        prior_active = self._active_states()
        new_id = self._create_state(step["content"], "ACTIVE", step["event_id"])

        # Supersede prior ACTIVE decisions (keep rows).
        for a in prior_active:
            self.conn.execute(
                "UPDATE states SET state_status = 'SUPERSEDED' WHERE state_id = ?",
                (a["state_id"],),
            )
            self._relate(
                new_id,
                a["state_id"],
                "SUPERSEDES",
                "USER_DECISION supersedes prior ACTIVE",
            )

        # Reject any still-PROPOSED that contradict this decision (never delete).
        for p in list(
            self.conn.execute("SELECT * FROM states WHERE state_status = 'PROPOSED'")
        ):
            self.conn.execute(
                "UPDATE states SET state_status = 'REJECTED' WHERE state_id = ?",
                (p["state_id"],),
            )
            self._relate(
                new_id,
                p["state_id"],
                "REJECTED_BECAUSE",
                "USER_DECISION rejects conflicting MODEL_PROPOSAL (Graphiti branch)",
            )

        self.audit(
            "APPLY_USER_DECISION",
            step["event_id"],
            step["source_actor"],
            f"ACTIVE={new_id}; prior proposals REJECTED/SUPERSEDED; no deletes",
        )
        self.conn.commit()
        return {
            "ok": True,
            "event_id": step["event_id"],
            "active_state_id": new_id,
            "content": step["content"],
        }

    def apply_research_claim(self, step: dict) -> dict[str, Any]:
        """RESEARCH_CLAIM unsupported: store as held/observed; NOT authoritative ACTIVE."""
        self._insert_event(step)
        held_id = self._create_state(step["content"], "HELD", step["event_id"])
        active = self._active_states()
        for a in active:
            self._relate(
                held_id,
                a["state_id"],
                "CONTRADICTS",
                "unsupported RESEARCH_CLAIM does not override ACTIVE decision",
            )
        self.audit(
            "APPLY_RESEARCH_CLAIM",
            step["event_id"],
            step["source_actor"],
            "stored as HELD; NOT authoritative ACTIVE",
        )
        self.conn.commit()
        return {
            "ok": True,
            "event_id": step["event_id"],
            "held_state_id": held_id,
            "status": "HELD",
            "is_authoritative": False,
            "active_unchanged": [dict(a) for a in active],
        }

    def resume(self, step: Optional[dict] = None) -> dict[str, Any]:
        """Return current goal, current state, rationale, rejected Graphiti branch,
        open authorization question, next action."""
        if step is not None:
            self._insert_event(step)
            self.audit("QUERY_RESUME", step["event_id"], step["source_actor"], "resume projection")
            self.conn.commit()

        goals = [dict(r) for r in self.conn.execute("SELECT * FROM goals WHERE status='OPEN'")]
        active = [dict(r) for r in self._active_states()]
        rejected = [
            dict(r)
            for r in self.conn.execute(
                "SELECT * FROM states WHERE state_status = 'REJECTED' ORDER BY created_at"
            )
        ]
        # Graphiti branch = rejected/proposed content mentioning Graphiti
        rejected_graphiti = [
            s for s in rejected if "Graphiti" in (s.get("content") or "")
        ]
        open_loops = [
            dict(r)
            for r in self.conn.execute("SELECT * FROM open_loops WHERE status='OPEN'")
        ]
        # Rationale from SUPERSEDES / REJECTED_BECAUSE relations into ACTIVE
        rationale_rows = []
        if active:
            aid = active[0]["state_id"]
            rationale_rows = [
                dict(r)
                for r in self.conn.execute(
                    "SELECT * FROM relations WHERE from_id = ? OR to_id = ? ORDER BY created_at",
                    (aid, aid),
                )
            ]

        next_action = (
            "Resolve open authorization question before treating any RESEARCH_CLAIM as production authority."
            if open_loops
            else "Continue from ACTIVE decision."
        )
        return {
            "current_goal": goals[0] if goals else None,
            "current_state": active[0] if active else None,
            "rationale": rationale_rows,
            "rejected_graphiti_branch": rejected_graphiti,
            "open_authorization_question": open_loops[0] if open_loops else None,
            "next_action": next_action,
            "all_active_count": len(active),
        }

    def project_current_state(self) -> dict[str, Any]:
        active = [dict(r) for r in self._active_states()]
        return {
            "active_states": active,
            "active_count": len(active),
            "events": [dict(r) for r in self.conn.execute("SELECT * FROM events ORDER BY created_at")],
            "states": [dict(r) for r in self.conn.execute("SELECT * FROM states ORDER BY created_at")],
            "relations": [
                dict(r) for r in self.conn.execute("SELECT * FROM relations ORDER BY created_at")
            ],
        }

    def apply_step(self, step: dict) -> dict[str, Any]:
        et = step["event_type"]
        if et == "MODEL_PROPOSAL":
            return self.apply_model_proposal(step)
        if et == "USER_DECISION":
            return self.apply_user_decision(step)
        if et == "RESEARCH_CLAIM":
            return self.apply_research_claim(step)
        if et == "QUERY_RESUME":
            return self.resume(step)
        raise ValueError(f"unknown event_type: {et}")

    def run_fixture(self, fixture_path: Path = FIXTURE_PATH) -> dict[str, Any]:
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        self.init_schema()
        self.seed(fixture)
        results = []
        resume_out = None
        for step in fixture["steps"]:
            out = self.apply_step(step)
            results.append({"step": step["step"], "event_type": step["event_type"], "result": out})
            if step["event_type"] == "QUERY_RESUME":
                resume_out = out
        projection = self.project_current_state()
        return {
            "step_results": results,
            "projection": projection,
            "resume": resume_out or self.resume(),
        }


def main() -> None:
    db = DEFAULT_DB
    if db.exists():
        db.unlink()
    runner = GovernanceRunner(db)
    try:
        out = runner.run_fixture()
        print(json.dumps({"ok": True, "db": str(db), "resume": out["resume"]}, indent=2))
    finally:
        runner.close()


if __name__ == "__main__":
    main()

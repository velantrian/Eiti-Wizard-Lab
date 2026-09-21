#!/usr/bin/env python3
"""E0-A Ownership & Governance Conformance Probe runner (LAB COMPOSITION).

Pipeline per apply_step:
  crystal_like_admission.admit_* →
  native_kernel_like_transition_rules.apply_* →
  SQLite persist →
  continuum_like_resume.project_* (QUERY_RESUME / resume)

Deterministic. NO LLM. NO Graphiti. LAB ONLY — not Crystal/NK/Continuum.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from lab_composition.crystal_like_admission import admit_typed_event
from lab_composition.native_kernel_like_transition_rules import apply_admission
from lab_composition.continuum_like_resume import project_resume

ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "schema.sql"
FIXTURE_PATH = ROOT / "fixture.json"
DEFAULT_DB = ROOT / "e0a.sqlite3"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class GovernanceRunner:
    def __init__(self, db_path: Path | str = DEFAULT_DB):
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.admission_trace: list[dict[str, Any]] = []
        self.transition_trace: list[dict[str, Any]] = []

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

    def _states_snapshot(self) -> list[dict[str, Any]]:
        return [
            {
                "state_id": r["state_id"],
                "content": r["content"],
                "state_status": r["state_status"],
                "event_id": r["event_id"],
            }
            for r in self.conn.execute("SELECT * FROM states ORDER BY created_at")
        ]

    def resume(self, step: Optional[dict] = None) -> dict[str, Any]:
        """Return current goal, current state, rationale, rejected Graphiti branch,
        open authorization question, next action — via continuum_like_resume.project_*."""
        if step is not None:
            self._insert_event(step)
            active = self._active_states()
            active0 = dict(active[0]) if active else None
            decision = admit_typed_event(step, active_decision=active0)
            self.admission_trace.append({"step": step, "decision": decision.as_dict()})
            before = self._states_snapshot()
            receipt = apply_admission(
                self.conn,
                event=step,
                outcome=decision.outcome.value,
                target_status=decision.target_status,
                rationale=decision.rationale,
                audit_fn=self.audit,
            )
            after = self._states_snapshot()
            self.transition_trace.append(
                {
                    "step": step,
                    "receipt": receipt.as_dict(),
                    "states_before": before,
                    "states_after": after,
                }
            )
            self.conn.commit()

        bundle = project_resume(self.conn)
        out = bundle.as_dict()
        # Public resume keys expected by tests (drop lab-only marker from contract surface)
        return {
            "current_goal": out["current_goal"],
            "current_state": out["current_state"],
            "rationale": out["rationale"],
            "rejected_graphiti_branch": out["rejected_graphiti_branch"],
            "open_authorization_question": out["open_authorization_question"],
            "next_action": out["next_action"],
            "all_active_count": out["all_active_count"],
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
        """admit_* → apply_* → SQLite; QUERY_RESUME also project_*."""
        et = step["event_type"]
        if et == "QUERY_RESUME":
            return self.resume(step)

        # Snapshot before for transition_trace
        before = self._states_snapshot()
        active = self._active_states()
        active0 = dict(active[0]) if active else None

        decision = admit_typed_event(step, active_decision=active0)
        self.admission_trace.append({"step": step, "decision": decision.as_dict()})

        self._insert_event(step)

        receipt = apply_admission(
            self.conn,
            event=step,
            outcome=decision.outcome.value,
            target_status=decision.target_status,
            rationale=decision.rationale,
            audit_fn=self.audit,
        )
        after = self._states_snapshot()
        self.transition_trace.append(
            {
                "step": step,
                "receipt": receipt.as_dict(),
                "states_before": before,
                "states_after": after,
            }
        )
        self.conn.commit()

        active_now = [dict(a) for a in self._active_states()]

        if et == "MODEL_PROPOSAL":
            return {
                "ok": True,
                "event_id": step["event_id"],
                "proposal_state_id": receipt.to_state_id,
                "proposal_status": decision.target_status,
                "active": active_now,
                "note": decision.rationale,
                "admission": decision.as_dict(),
                "transition": receipt.as_dict(),
            }
        if et == "USER_DECISION":
            return {
                "ok": True,
                "event_id": step["event_id"],
                "active_state_id": receipt.to_state_id,
                "content": step["content"],
                "admission": decision.as_dict(),
                "transition": receipt.as_dict(),
            }
        if et == "RESEARCH_CLAIM":
            return {
                "ok": True,
                "event_id": step["event_id"],
                "held_state_id": receipt.to_state_id,
                "status": "HELD",
                "is_authoritative": False,
                "active_unchanged": active_now,
                "admission": decision.as_dict(),
                "transition": receipt.as_dict(),
            }
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
            "admission_trace": list(self.admission_trace),
            "transition_trace": list(self.transition_trace),
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

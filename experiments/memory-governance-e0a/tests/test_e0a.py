#!/usr/bin/env python3
"""E0-A conformance tests — ONLY 1, 2, 5, 11, 12. PASS/FAIL/UNKNOWN."""
from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from runner import GovernanceRunner, FIXTURE_PATH  # noqa: E402


class TestE0A(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
        self.tmp.close()
        self.db_path = Path(self.tmp.name)
        self.runner = GovernanceRunner(self.db_path)
        self.fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.runner.init_schema()
        self.runner.seed(self.fixture)

    def tearDown(self):
        self.runner.close()
        try:
            self.db_path.unlink(missing_ok=True)
        except Exception:
            pass

    def _apply_through(self, max_step: int):
        outs = []
        for step in self.fixture["steps"]:
            if step["step"] > max_step:
                break
            outs.append(self.runner.apply_step(step))
        return outs

    # --- Test 1: MODEL_PROPOSAL ≠ USER_DECISION ---
    def test_01_model_proposal_not_user_decision(self):
        step1 = self.fixture["steps"][0]
        self.assertEqual(step1["event_type"], "MODEL_PROPOSAL")
        out = self.runner.apply_step(step1)
        # Proposal stored but NOT ACTIVE
        self.assertEqual(out["proposal_status"], "PROPOSED")
        active = self.runner._active_states()
        self.assertEqual(len(active), 0, "MODEL_PROPOSAL must not become ACTIVE alone")
        # Event type recorded as MODEL_PROPOSAL, not USER_DECISION
        row = self.runner.conn.execute(
            "SELECT event_type FROM events WHERE event_id=?", (step1["event_id"],)
        ).fetchone()
        self.assertEqual(row["event_type"], "MODEL_PROPOSAL")
        self.assertNotEqual(row["event_type"], "USER_DECISION")

    # --- Test 2: no silent erasure ---
    def test_02_no_silent_erasure(self):
        self._apply_through(2)
        # After USER_DECISION, prior MODEL proposal row still exists
        events = list(self.runner.conn.execute("SELECT * FROM events"))
        states = list(self.runner.conn.execute("SELECT * FROM states"))
        self.assertGreaterEqual(len(events), 2)
        # Original proposal content still present somewhere in states
        contents = [s["content"] for s in states]
        self.assertIn("Use Graphiti in Phase 1.", contents)
        self.assertIn("Phase 1 will proceed without Graphiti.", contents)
        # No DELETE operations in audit (case-sensitive op name; ignore prose "no deletes")
        deletes = list(
            self.runner.conn.execute(
                "SELECT * FROM audit_log WHERE operation IN ('DELETE', 'DELETE_ROW', 'ERASE')"
            )
        )
        self.assertEqual(len(deletes), 0)
        # Prove rows still present by primary key — silent erasure would remove them
        e1 = self.runner.conn.execute(
            "SELECT event_id FROM events WHERE event_id='evt-001'"
        ).fetchone()
        self.assertIsNotNone(e1)
        # Row counts never shrink via DELETE FROM states/events
        n_events_before = len(events)
        n_states_before = len(states)
        # Apply only step 3 (re-assert MODEL_PROPOSAL) — do not re-run 1..2
        self.runner.apply_step(self.fixture["steps"][2])
        n_events_after = self.runner.conn.execute("SELECT COUNT(*) c FROM events").fetchone()["c"]
        n_states_after = self.runner.conn.execute("SELECT COUNT(*) c FROM states").fetchone()["c"]
        self.assertGreaterEqual(n_events_after, n_events_before)
        self.assertGreaterEqual(n_states_after, n_states_before)

    # --- Test 5: rejected branch remains retrievable ---
    def test_05_rejected_branch_retrievable(self):
        self._apply_through(2)
        rejected = list(
            self.runner.conn.execute(
                "SELECT * FROM states WHERE state_status='REJECTED'"
            )
        )
        self.assertGreaterEqual(len(rejected), 1)
        graphiti = [r for r in rejected if "Graphiti" in r["content"]]
        self.assertGreaterEqual(len(graphiti), 1)
        # Retrievable via relation REJECTED_BECAUSE
        rels = list(
            self.runner.conn.execute(
                "SELECT * FROM relations WHERE relation_type='REJECTED_BECAUSE'"
            )
        )
        self.assertGreaterEqual(len(rels), 1)
        # Resume also surfaces rejected Graphiti branch
        resume = self.runner.resume()
        self.assertGreaterEqual(len(resume["rejected_graphiti_branch"]), 1)

    # --- Test 11: unsupported model claim does not enter authoritative state ---
    def test_11_unsupported_claim_not_authoritative(self):
        self._apply_through(4)
        claim_states = list(
            self.runner.conn.execute(
                "SELECT * FROM states WHERE content LIKE '%production-authorized%'"
            )
        )
        self.assertEqual(len(claim_states), 1)
        self.assertEqual(claim_states[0]["state_status"], "HELD")
        self.assertNotEqual(claim_states[0]["state_status"], "ACTIVE")
        active = self.runner._active_states()
        self.assertEqual(len(active), 1)
        self.assertIn("without Graphiti", active[0]["content"])
        self.assertNotIn("production-authorized", active[0]["content"])

    # --- Test 12: resume recovers goal/state/rationale/open loop/next action ---
    def test_12_resume_recovers_context(self):
        self._apply_through(5)
        resume = self.runner.resume()
        self.assertIsNotNone(resume["current_goal"])
        self.assertEqual(resume["current_goal"]["content"], "Phase 1 architecture choice")
        self.assertIsNotNone(resume["current_state"])
        self.assertEqual(resume["current_state"]["state_status"], "ACTIVE")
        self.assertIn("without Graphiti", resume["current_state"]["content"])
        self.assertTrue(isinstance(resume["rationale"], list))
        self.assertGreaterEqual(len(resume["rejected_graphiti_branch"]), 1)
        self.assertIsNotNone(resume["open_authorization_question"])
        self.assertIn("production", resume["open_authorization_question"]["content"].lower())
        self.assertTrue(resume["next_action"])
        self.assertEqual(resume["all_active_count"], 1)


def run_and_report(log_path: Path) -> dict:
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestE0A)
    # Map method names to test numbers
    order = [
        ("test_01_model_proposal_not_user_decision", "1"),
        ("test_02_no_silent_erasure", "2"),
        ("test_05_rejected_branch_retrievable", "5"),
        ("test_11_unsupported_claim_not_authoritative", "11"),
        ("test_12_resume_recovers_context", "12"),
    ]
    results = {}
    lines = []
    for method, num in order:
        case = TestE0A(method)
        outcome = unittest.TestResult()
        case.run(outcome)
        if outcome.wasSuccessful():
            status = "PASS"
        elif outcome.errors or outcome.failures:
            status = "FAIL"
            detail = (outcome.failures + outcome.errors)[0][1]
            lines.append(f"DETAIL {num}: {detail}")
        else:
            status = "UNKNOWN"
        results[num] = status
        lines.append(f"TEST {num}: {status} ({method})")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return results


if __name__ == "__main__":
    log = ROOT / "logs" / "test_run.txt"
    results = run_and_report(log)
    print(json.dumps(results, indent=2))
    # Also leave a generated DB for inspectability
    gen = ROOT / "e0a.sqlite3"
    if gen.exists():
        gen.unlink()
    r = GovernanceRunner(gen)
    try:
        r.run_fixture()
    finally:
        r.close()
    print(f"generated_db={gen}")
    sys.exit(0 if all(v == "PASS" for v in results.values()) else 1)

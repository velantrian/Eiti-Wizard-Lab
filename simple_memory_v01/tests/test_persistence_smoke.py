
"""Acceptance smoke tests A–E with REAL process isolation for persistence."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLI = [sys.executable, "-m", "simple_memory_v01.cli"]


def run_cli(db: Path, *args: str) -> subprocess.CompletedProcess:
    env = {"PYTHONPATH": str(ROOT), "SIMPLE_MEMORY_DB": str(db)}
    return subprocess.run(
        [*CLI, "--db", str(db), *args],
        cwd=str(ROOT),
        env={**dict(**{k: v for k, v in __import__("os").environ.items()}), **env},
        capture_output=True,
        text=True,
        check=False,
    )


class PersistenceSmoke(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.sqlite3"

    def tearDown(self):
        self.tmp.cleanup()

    def test_A_bio_survives_fresh_process(self):
        # SESSION A — separate process
        r = run_cli(
            self.db,
            "remember",
            "--type",
            "bio",
            "--session",
            "A",
            "--text",
            "Я родился в городе N. В детстве интересовался X. Позже начал заниматься Y.",
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("SAVED", r.stdout)
        # SESSION B — new process (new CLI invocation)
        r2 = run_cli(self.db, "recall", "Что я рассказывал о своей биографии?")
        self.assertEqual(r2.returncode, 0, r2.stderr)
        self.assertIn("RETRIEVED COUNT:", r2.stdout)
        self.assertNotIn("NO_RELEVANT_MEMORY", r2.stdout)
        self.assertIn("родился", r2.stdout)
        self.assertIn("mem:", r2.stdout)

    def test_B_thought_recall(self):
        run_cli(
            self.db,
            "remember",
            "--type",
            "thought",
            "--text",
            "Мне кажется, что хорошая цифровая память должна возвращать не весь архив, а только то, что относится к текущему вопросу.",
        )
        r = run_cli(self.db, "recall", "О чём я говорил в своих мыслях о памяти?")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("архив", r.stdout)
        self.assertNotIn("NO_RELEVANT_MEMORY", r.stdout)

    def test_C_work_state_resume(self):
        run_cli(
            self.db,
            "remember",
            "--type",
            "work_state",
            "--text",
            "Я работаю над Project X. Сейчас остановился после шага Y. Мы решили использовать Z. Следующий шаг — Q.",
        )
        r = run_cli(self.db, "recall", "Чем я занимался?")
        self.assertEqual(r.returncode, 0, r.stderr)
        out = r.stdout
        self.assertIn("Project X", out)
        self.assertIn("Y", out)
        self.assertIn("Z", out)
        self.assertIn("Q", out)
        r2 = run_cli(self.db, "latest-work")
        self.assertIn("Q", r2.stdout)
        self.assertIn("RESUME_HINT", r2.stdout)

    def test_D_selective_retrieval(self):
        run_cli(self.db, "remember", "--type", "bio", "--text", "Биография: город N.")
        run_cli(self.db, "remember", "--type", "note", "--text", "Музыкальная идея: мелодия в миноре.")
        run_cli(
            self.db,
            "remember",
            "--type",
            "work_state",
            "--text",
            "Работаю над Project unrelated.",
        )
        run_cli(self.db, "remember", "--type", "note", "--text", "Случайная заметка про кофе.")
        run_cli(
            self.db,
            "remember",
            "--type",
            "thought",
            "--text",
            "Мысли о памяти: возвращать только релевантное, не весь архив.",
        )
        r = run_cli(self.db, "recall", "О чём я говорил насчёт памяти?")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("памят", r.stdout.lower())
        # Must not dump everything — retrieved count <= 5 and should not include coffee note as primary dump of all 5 unless relevant
        self.assertNotIn("кофе", r.stdout)
        # Count line
        lines = r.stdout.splitlines()
        idx = lines.index("RETRIEVED COUNT:")
        count = int(lines[idx + 1].strip())
        self.assertGreaterEqual(count, 1)
        self.assertLessEqual(count, 5)

    def test_E_honest_empty(self):
        run_cli(self.db, "remember", "--type", "bio", "--text", "Я родился в городе N.")
        r = run_cli(self.db, "recall", "Что я говорил о выращивании орхидей?")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("NO_RELEVANT_MEMORY", r.stdout)


if __name__ == "__main__":
    unittest.main()

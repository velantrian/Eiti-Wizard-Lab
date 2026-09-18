
#!/usr/bin/env python3
"""Minimal CLI: remember | recall | latest-work | list"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# allow `python -m simple_memory_v01.cli` and `python simple_memory_v01/cli.py`
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from simple_memory_v01.db import DEFAULT_DB, init_db
from simple_memory_v01.store import latest_work, list_memories, recall, remember


def _db(args) -> str:
    return str(Path(args.db).expanduser())


def cmd_init(args):
    path = init_db(_db(args))
    print(f"DB_READY {path}")


def cmd_remember(args):
    text = args.text
    if args.file:
        text = Path(args.file).read_text(encoding="utf-8")
    if not text:
        print("ERROR: provide --text or --file", file=sys.stderr)
        sys.exit(2)
    row = remember(
        _db(args),
        memory_type=args.type,
        content=text,
        title=args.title,
        session_id=args.session,
    )
    print("SAVED")
    print(json.dumps(row, ensure_ascii=False, indent=2))


def cmd_recall(args):
    result = recall(_db(args), args.query, limit=args.limit)
    print("MEMORY QUERY:")
    print(json.dumps(result["query"], ensure_ascii=False))
    print()
    print("RETRIEVED MEMORY IDS:")
    if result["retrieved_ids"]:
        for mid in result["retrieved_ids"]:
            print(mid)
    else:
        print("(none)")
    print()
    print("RETRIEVED COUNT:")
    print(result["retrieved_count"])
    print()
    if result["empty"]:
        print("NO_RELEVANT_MEMORY")
        return
    print("RETRIEVED CONTENT:")
    for item in result["items"]:
        print("---")
        print(f"id: {item['memory_id']}")
        print(f"type: {item['memory_type']}")
        print(f"title: {item.get('title')}")
        print(f"created_at: {item['created_at']}")
        print(item["content"])


def cmd_latest(args):
    item = latest_work(_db(args))
    if not item:
        print("NO_RELEVANT_MEMORY")
        return
    print("MEMORY QUERY:")
    print('"latest work_state"')
    print()
    print("RETRIEVED MEMORY IDS:")
    print(item["memory_id"])
    print()
    print("RETRIEVED COUNT:")
    print(1)
    print()
    print("RETRIEVED CONTENT:")
    print("---")
    print(f"id: {item['memory_id']}")
    print(f"type: {item['memory_type']}")
    print(f"title: {item.get('title')}")
    print(f"created_at: {item['created_at']}")
    print(item["content"])
    print()
    print("RESUME_HINT: stored continuation is in the work_state text above (look for next step).")


def cmd_list(args):
    items = list_memories(_db(args), memory_type=args.type, limit=args.limit)
    print(f"COUNT {len(items)}")
    for item in items:
        print(f"{item['memory_id']}\t{item['memory_type']}\t{item['created_at']}\t{item.get('title')}")


def main(argv=None):
    p = argparse.ArgumentParser(description="Simple Memory / Resume Sandbox v0.1")
    p.add_argument(
        "--db",
        default=os.environ.get("SIMPLE_MEMORY_DB", str(DEFAULT_DB)),
        help="SQLite file path",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init", help="Create/migrate DB")
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("remember", help="Save original user text")
    s.add_argument("--type", required=True, choices=["bio", "thought", "work_state", "note"])
    s.add_argument("--text", default="")
    s.add_argument("--file", default="")
    s.add_argument("--title", default=None)
    s.add_argument("--session", default="manual")
    s.set_defaults(func=cmd_remember)

    s = sub.add_parser("recall", help="Retrieve relevant memories")
    s.add_argument("query")
    s.add_argument("--limit", type=int, default=5)
    s.set_defaults(func=cmd_recall)

    s = sub.add_parser("latest-work", help="Most recent work_state")
    s.set_defaults(func=cmd_latest)

    s = sub.add_parser("list", help="List memories")
    s.add_argument("--type", default=None, choices=["bio", "thought", "work_state", "note"])
    s.add_argument("--limit", type=int, default=50)
    s.set_defaults(func=cmd_list)

    args = p.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

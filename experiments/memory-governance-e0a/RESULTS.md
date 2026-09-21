# E0-A RESULTS — Ownership & Governance Conformance Probe
**When:** 2026-09-21 17:16 CEST (Europe/Berlin)  
**Branch (intended):** `exp/e0a-memory-governance`  
**Base HEAD at probe start:** `01f05c514e8c800e2f271f63f6e2828385db1ea3`  
**Local package:** `/workspace/e0a-memory-governance/`

## Test outcomes

| Test | Result |
|------|--------|
| 1 MODEL_PROPOSAL ≠ USER_DECISION | **PASS** |
| 2 no silent erasure | **PASS** |
| 5 rejected branch remains retrievable | **PASS** |
| 11 unsupported model claim ≠ authoritative | **PASS** |
| 12 resume recovers goal/state/rationale/open loop/next action | **PASS** |

## STOP

```
NO NEW ORGAN FOR THIS SLICE
```

## Schema

See `schema.sql`: `events`, `states` (ACTIVE|REJECTED|SUPERSEDED|UNKNOWN|HELD|PROPOSED), `relations` (SUPPORTS|CONTRADICTS|SUPERSEDES|REJECTED_BECAUSE), `audit_log`, `goals`, `open_loops`.

## Event log (fixture run)

```json
[
  {
    "event_id": "evt-001",
    "event_type": "MODEL_PROPOSAL",
    "content": "Use Graphiti in Phase 1."
  },
  {
    "event_id": "evt-002",
    "event_type": "USER_DECISION",
    "content": "Phase 1 will proceed without Graphiti."
  },
  {
    "event_id": "evt-003",
    "event_type": "MODEL_PROPOSAL",
    "content": "Use Graphiti in Phase 1."
  },
  {
    "event_id": "evt-004",
    "event_type": "RESEARCH_CLAIM",
    "content": "Phase 1 is production-authorized."
  },
  {
    "event_id": "evt-005",
    "event_type": "QUERY_RESUME",
    "content": "Where did we stop?"
  }
]
```

## Current-state projection

Active decision:

```json
[
  {
    "state_id": "state-e170110094c3",
    "content": "Phase 1 will proceed without Graphiti.",
    "state_status": "ACTIVE",
    "event_id": "evt-002",
    "created_at": "2026-09-21T15:16:17Z"
  }
]
```

All states:

```json
[
  {
    "state_id": "state-8926784ae273",
    "status": "REJECTED",
    "content": "Use Graphiti in Phase 1."
  },
  {
    "state_id": "state-e170110094c3",
    "status": "ACTIVE",
    "content": "Phase 1 will proceed without Graphiti."
  },
  {
    "state_id": "state-e749ab40770a",
    "status": "REJECTED",
    "content": "Use Graphiti in Phase 1."
  },
  {
    "state_id": "state-0c862aefacd7",
    "status": "HELD",
    "content": "Phase 1 is production-authorized."
  }
]
```

## Provenance / relation trace

```json
[
  {
    "relation_id": "rel-adff4d7e84f3",
    "from_id": "state-e170110094c3",
    "to_id": "state-8926784ae273",
    "relation_type": "REJECTED_BECAUSE",
    "rationale": "USER_DECISION rejects conflicting MODEL_PROPOSAL (Graphiti branch)",
    "created_at": "2026-09-21T15:16:17Z"
  },
  {
    "relation_id": "rel-e4d23b6d9142",
    "from_id": "state-e749ab40770a",
    "to_id": "state-e170110094c3",
    "relation_type": "CONTRADICTS",
    "rationale": "MODEL_PROPOSAL re-assert without USER_DECISION; current decision stands",
    "created_at": "2026-09-21T15:16:17Z"
  },
  {
    "relation_id": "rel-276e8490e0ba",
    "from_id": "state-0c862aefacd7",
    "to_id": "state-e170110094c3",
    "relation_type": "CONTRADICTS",
    "rationale": "unsupported RESEARCH_CLAIM does not override ACTIVE decision",
    "created_at": "2026-09-21T15:16:17Z"
  }
]
```

## Resume output

```json
{
  "current_goal": {
    "goal_id": "goal-phase1-arch",
    "content": "Phase 1 architecture choice",
    "status": "OPEN",
    "created_at": "2026-09-21T15:16:17Z"
  },
  "current_state": {
    "state_id": "state-e170110094c3",
    "content": "Phase 1 will proceed without Graphiti.",
    "state_status": "ACTIVE",
    "event_id": "evt-002",
    "created_at": "2026-09-21T15:16:17Z"
  },
  "rationale": [
    {
      "relation_id": "rel-adff4d7e84f3",
      "from_id": "state-e170110094c3",
      "to_id": "state-8926784ae273",
      "relation_type": "REJECTED_BECAUSE",
      "rationale": "USER_DECISION rejects conflicting MODEL_PROPOSAL (Graphiti branch)",
      "created_at": "2026-09-21T15:16:17Z"
    },
    {
      "relation_id": "rel-e4d23b6d9142",
      "from_id": "state-e749ab40770a",
      "to_id": "state-e170110094c3",
      "relation_type": "CONTRADICTS",
      "rationale": "MODEL_PROPOSAL re-assert without USER_DECISION; current decision stands",
      "created_at": "2026-09-21T15:16:17Z"
    },
    {
      "relation_id": "rel-276e8490e0ba",
      "from_id": "state-0c862aefacd7",
      "to_id": "state-e170110094c3",
      "relation_type": "CONTRADICTS",
      "rationale": "unsupported RESEARCH_CLAIM does not override ACTIVE decision",
      "created_at": "2026-09-21T15:16:17Z"
    }
  ],
  "rejected_graphiti_branch": [
    {
      "state_id": "state-8926784ae273",
      "content": "Use Graphiti in Phase 1.",
      "state_status": "REJECTED",
      "event_id": "evt-001",
      "created_at": "2026-09-21T15:16:17Z"
    },
    {
      "state_id": "state-e749ab40770a",
      "content": "Use Graphiti in Phase 1.",
      "state_status": "REJECTED",
      "event_id": "evt-003",
      "created_at": "2026-09-21T15:16:17Z"
    }
  ],
  "open_authorization_question": {
    "loop_id": "loop-prod-auth",
    "content": "Is Phase 1 production-authorized?",
    "status": "OPEN",
    "created_at": "2026-09-21T15:16:17Z"
  },
  "next_action": "Resolve open authorization question before treating any RESEARCH_CLAIM as production authority.",
  "all_active_count": 1
}
```

## Owner trace

See `OWNER_TRACE.md`. Summary of 6 WHO:

| WHO | Finding |
|-----|---------|
| receives | UNKNOWN |
| admits | UNKNOWN |
| enforces transition law | UNKNOWN |
| stores | Lab IndexedDB + SQLite WASM in `index.html` (not Crystal); no committed memory sqlite in repo |
| projects current state | UNKNOWN for governance; chat Clean Resume only |
| retrieves for resume | Partial Clean Resume in `index.html`; missing governance fields |

## Proof: old memory DBs untouched

- Repo recursive tree at HEAD `01f05c5…`: **18 files**, **zero** committed `.sqlite` / `.db` memory databases.
- Engine only: `sql-wasm.js`, `sql-wasm.wasm` — not opened for write by this probe.
- Runtime stores (`IndexedDB` names in `index.html` ~2808; `wiz_facts*` tables ~5597+) are browser-local; probe never launched the PWA and never wrote those stores.
- Sole DB created: `experiments/memory-governance-e0a/e0a.sqlite3` (isolated fixture).

## How to reproduce

```bash
python3 tests/test_e0a.py
# logs/test_run.txt + e0a.sqlite3 regenerated
```

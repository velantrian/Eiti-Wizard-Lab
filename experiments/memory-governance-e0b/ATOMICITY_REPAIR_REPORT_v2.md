# ATOMICITY REPAIR REPORT v2 — E0-B Phase 1D

- Base 1C: `5771de4c03c2cd6e33223b3d21223687535406bd`
- Original USER parent messages: **10**
- Atomic USER spans: **22** (1C had 20; further splits on V08.1, V21.2; V38 boundary fix)
- Intentionally compound spans: `E0B-V13`, `E0B-V08.1.2`, `E0B-V17.1`, `E0B-V18.1`, `E0B-V21.2.2`, `E0B-V31.2`, `E0B-V38.3`
- content_origin distribution: `{'USER_OWN': 22}`
- conditional-act count: **8**
- marker coverage: **18/22** (auxiliary only)
- HUMAN_GOLD: NOT_CREATED
- BLIND_RUN: NOT_RUN

## Parent → atomic children (v2)

- `E0B-V04` → (whole)
- `E0B-V07` → (whole)
- `E0B-V13` → (whole)
- `E0B-V08` → `E0B-V08.1.1`, `E0B-V08.1.2`, `E0B-V08.2`
- `E0B-V17` → `E0B-V17.1`, `E0B-V17.2`
- `E0B-V18` → `E0B-V18.1`, `E0B-V18.2`, `E0B-V18.3`, `E0B-V18.4`
- `E0B-V21` → `E0B-V21.1`, `E0B-V21.2.1`, `E0B-V21.2.2`
- `E0B-V31` → `E0B-V31.1`, `E0B-V31.2`
- `E0B-V34` → `E0B-V34.1`, `E0B-V34.2`
- `E0B-V38` → `E0B-V38.1`, `E0B-V38.2`, `E0B-V38.3`

## Soft-span resolution

- **V08.1** → split into `.1.1` (question) + `.1.2` (access claim+condition, compound)
- **V17.1** → kept compound (preference + rationale + soft confirm)
- **V18.1** → kept compound (proposal + because)
- **V18.3** → kept; relation CONTINUES_PROPOSAL_FROM V18.1
- **V21.2** → split into `.2.1` (stack constraints) + `.2.2` (adapt / no-touch-main, compound)
- **V38.2 / V38.3** → purpose clause reattached to `.3` with operational condition

## Integrity

- children reconstruct parents exactly: PASS
- no paraphrase / no dropped / no duplicated characters: PASS
- parent hashes refreshed in atoms_parent_messages.json
- conditional clauses kept with their acts: PASS (see checks)

## AUTHORITY field

Replaced `AUTHORITY` with `AUTHORITY_EXERCISED` (YES/NO/UNKNOWN) on both gold surfaces.

STOP after freeze/hash/push to PR #7.

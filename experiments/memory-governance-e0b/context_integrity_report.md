# Context Integrity Report — E0-B Phase 1D

## Reconstruction

- `E0B-V08` sha256=`43fbcccdb529a7f996e3921945a0789269e6148c40c255c54c4a24c8587a1626` children=E0B-V08.1.1+E0B-V08.1.2+E0B-V08.2 OK
- `E0B-V17` sha256=`2a32891b38929f065750350ce2b26ec222b0022a374657550d0c4a959d560478` children=E0B-V17.1+E0B-V17.2 OK
- `E0B-V18` sha256=`82711f489054256bff1da91255173107eced5702c3ceaa2d9515cf0fa532e38a` children=E0B-V18.1+E0B-V18.2+E0B-V18.3+E0B-V18.4 OK
- `E0B-V21` sha256=`bc07cf39a7b49b7895a3a72e76385bc244e499baaae14280eebb60e58d90b0d0` children=E0B-V21.1+E0B-V21.2.1+E0B-V21.2.2 OK
- `E0B-V31` sha256=`c33c2467343a5cc5c514545bd27e4e9e1dfe887e57e560ceb5ff108744ebbbbf` children=E0B-V31.1+E0B-V31.2 OK
- `E0B-V34` sha256=`bc9b14029a1008b44d3fe765b31e1de7fd084bc46d9d474b2ad228dcb92cd02c` children=E0B-V34.1+E0B-V34.2 OK
- `E0B-V38` sha256=`f9f3c641b8328a54f26add051f4e1561b1bdcf382a6bd39dc3d712cb02d1b3d7` children=E0B-V38.1+E0B-V38.2+E0B-V38.3 OK

## Context-loss findings

- **INFO** `E0B-V18.3`: Additive proposal uses anaphoric "туда"/continuation; relation CONTINUES_PROPOSAL_FROM V18.1 recorded; not a character loss
- **INFO** `E0B-V38.3`: Purpose clause "чтобы можно…" kept with operational span (reattached from soft 1C boundary)
- **INFO** `E0B-V21.2.2`: Trailing "Потому что" remains truncated as in source parent (no characters invented)
- **NONE** All parent messages reconstruct exactly from children; no paraphrase; no dropped/duplicated characters

## Dependencies preserved

- `E0B-V08.1.2`: relation={'type': 'SUPPORTS_FEASIBILITY_OF', 'target_atom_id': 'E0B-V08.1.1', 'status': 'PRESENT'} dep=None
- `E0B-V08.2`: relation={'type': 'CONSTRAINT_ON_ANSWER_FOR', 'target_atom_id': 'E0B-V08.1.1', 'status': 'PRESENT'} dep=None
- `E0B-V17.1`: relation={'type': 'RATIONALE_ATTACHED_WITHIN_SPAN', 'target_atom_id': None, 'status': 'PRESENT'} dep=None
- `E0B-V17.2`: relation={'type': 'MEMORY_REQUEST_FOR', 'target_atom_id': 'E0B-V17.1', 'status': 'PRESENT'} dep=None
- `E0B-V18.1`: relation={'type': 'RATIONALE_ATTACHED_WITHIN_SPAN', 'status': 'PRESENT'} dep=None
- `E0B-V18.2`: relation={'type': 'HYPOTHESIS_ABOUT', 'target_atom_id': 'E0B-V18.1', 'status': 'PRESENT'} dep=None
- `E0B-V18.3`: relation={'type': 'CONTINUES_PROPOSAL_FROM', 'target_atom_id': 'E0B-V18.1', 'status': 'PRESENT'} dep=Additive proposal; underspecified without V18.1 target ("туда")
- `E0B-V18.4`: relation={'type': 'QUESTION_ABOUT', 'target_atom_id': 'E0B-V18.3', 'status': 'PRESENT'} dep=None
- `E0B-V21.2.1`: relation={'type': 'CONSTRAINT_ON', 'target_atom_id': 'E0B-V21.1', 'status': 'PRESENT'} dep=None
- `E0B-V21.2.2`: relation={'type': 'METHOD_CONSTRAINT_ON', 'target_atom_id': 'E0B-V21.1', 'status': 'PRESENT'} dep=None
- `E0B-V31.2`: relation={'type': 'STYLE_CONSTRAINT_FOR_ACTION_IN', 'target_atom_id': 'E0B-V31.1', 'status': 'PRESENT'} dep=None
- `E0B-V34.2`: relation={'type': 'CONFIRMATION_QUESTION_ABOUT', 'target_atom_id': 'E0B-V34.1', 'status': 'PRESENT'} dep=None
- `E0B-V38.3`: relation={'type': 'OPERATIONAL_ELABORATION_OF', 'target_atom_id': 'E0B-V38.2', 'status': 'PRESENT'} dep=None

## sender_actor vs content_origin

All Phase 1D USER spans: sender_actor=USER, content_origin=USER_OWN.
Schema allows divergence (MODEL_QUOTE / EXTERNAL_QUOTE / MIXED / UNKNOWN) when evidence appears.


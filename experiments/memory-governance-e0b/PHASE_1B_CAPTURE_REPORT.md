# E0-B Phase 1B — PROSPECTIVE VERBATIM CORPUS CAPTURE

**When:** 2026-09-21T19:05:47+02:00 (Europe/Berlin / CEST)  
**Branch:** `exp/e0b-typing-reliability`  
**Repo:** `velantrian/Eiti-Wizard-Lab`  
**Action:** PROSPECTIVE_VERBATIM_CORPUS_CAPTURE · **STOP** (await human labels; no blind run)

## Outcome

```
PHASE1B PROSPECTIVE VERBATIM CORPUS CAPTURE complete
PRIMARY_CORPUS = VERBATIM_ONLY
NEW_SOURCE_STREAM = AGENT_CHAT
ORCHID / LIVE-01 / SLOT-01 = STILL_MISSING (not reconstructed)
GROUND_TRUTH_STATUS = PENDING
BLIND_RUN = NOT_RUN
STOP — wait for human labels; do not start blind run
```

## Corpus totals

| Metric | Value |
|--------|-------|
| Total verbatim atoms | **42** |
| Retained Phase 1A (LAB-E0A-FIXTURE) | 7 |
| New Phase 1B (AGENT_CHAT) | 35 |
| Target range | 30–50 |
| Shortfall vs 30 | 0 |
| Excluded ledger (unchanged prior) | 7 |
| USER atoms requiring human labels | 10 |

## SOURCE-axis distribution (metadata only)

```json
{
  "EXTERNAL": 2,
  "MODEL": 30,
  "USER": 10
}
```

## Source distribution

```json
{
  "LAB-E0A-FIXTURE": 7,
  "AGENT_CHAT:Labs": 35
}
```

## Provenance coverage

- Primary atoms with full provenance: **42/42 (100%)**
- Each new atom has: `source_artifact`, `source_message_id`, `span_start/end`, speaker metadata, `VERBATIM=YES`, `content_sha256`

## Source files + content hashes

| Artifact | Role | Hash |
|----------|------|------|
| `experiments/memory-governance-e0a/fixture.json` | retained 7 atoms | `3e1b0803cc6790afdc48dd7cb214ecda597930f5225b1dbc1ad028ee3d539f71` |
| `raw_messages.json` | prospective captures | `351554aa95a9b97922f8b0ae8b17da635f353b761173ceb03d01d04f41ad6c1d` |
| agent `store.db` transcript_entries | live origin (mirrored) | per-message `entry_sha256` / `content_sha256` in raw_messages |

## Search log (Phase 1B)

- A) Lab remote branches: no NEW Orchid/LIVE-01/SLOT-01 transcript bodies
- B) Notion: TCE evidence page only; comments empty; sessions API not available for verbatim event pull; Orchid dump absent
- C) Drive: companion TCE doc only; no source_transcript_before_snapshot.txt / tce-live bodies
- D) GitHub lab issues/PR comments: empty on #1–#7
- E) Box: /workspace/tce-live-01 and tce-slot-01 ABSENT; claimed SHAs unmatched
- F) AGENT_CHAT: /home/box/agent-data/agents/*/store.db transcript_entries — PRIMARY new verbatim source (Labs conversation)
- G) Other lab logs: no additional stable-ID quoted dumps beyond agent stores + retained E0-A fixture

## Explicit non-actions

- Did **not** run blind model classification / scoring / GO E0-B BLIND RUN
- Did **not** modify `experiments/memory-governance-e0a/**`
- Did **not** write to Crystal / Native Kernel / Continuum / Mentaury* / Titan
- Did **not** reconstruct LIVE-01 / SLOT-01 / Orchid from summaries
- Did **not** manufacture artificial classification examples
- Did **not** introduce PST-01 / new Memory Admission Controller / architecture promotion

## Next human action

1. Label USER atoms in `human_label_packet.md`
2. Only then authorize Phase 2 blind run

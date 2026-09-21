# E0-B Phase 1A — SOURCE INTEGRITY REPORT

**When:** 2026-09-21T18:35:03+02:00 (Europe/Berlin / CEST)  
**Branch:** `exp/e0b-typing-reliability`  
**Repo:** `velantrian/Eiti-Wizard-Lab`  
**Action:** SOURCE_INTEGRITY_REPAIR · STOP (no blind run)

## Outcome

```
PHASE1A SOURCE INTEGRITY REPAIR complete
PRIMARY_CORPUS = VERBATIM_ONLY
ORCHID = ORCHID_SOURCE_MISSING
LIVE-01 / SLOT-01 = VERBATIM_TRANSCRIPT_MISSING
GROUND_TRUTH_STATUS = PENDING
BLIND_RUN = NOT_RUN
```

## Verbatim atom count

| Metric | Value |
|--------|-------|
| Primary verbatim atoms | **7** |
| Target range | 30–50 |
| Shortfall | 23 (integrity > size; no paraphrase padding) |
| Excluded (EXCLUDE_SOURCE_NOT_VERBATIM) | **38** |
| Prior Phase1 atoms considered | 45 |

## Source distribution (primary)

{
  "LAB-E0A-FIXTURE": 7
}

## SOURCE-axis distribution (metadata only)

{
  "EXTERNAL": 2,
  "MODEL": 3,
  "USER": 2
}

## Exclusions

All prior LIVE-01 (20) and SLOT-01 (17) atoms excluded as non-verbatim (evidence paraphrases / snapshot observations / research invariants / hash pointers).  
Plus 1 prior LAB-E0A-FIXTURE atom (`E0B-A39`) whose text is composition/resume projector output, not `fixture.json` event/seed content.

Ledger: `atoms_excluded.json` (exclusion_code=`EXCLUDE_SOURCE_NOT_VERBATIM` on every entry).

## Missing sources

| Source | Status | Claimed SHA256 / path |
|--------|--------|------------------------|
| Orchid | **ORCHID_SOURCE_MISSING** | n/a |
| LIVE-01 | **VERBATIM_TRANSCRIPT_MISSING** | `e0e21160157b464c…` · `/workspace/tce-live-01/` |
| SLOT-01 | **VERBATIM_TRANSCRIPT_MISSING** | `d1e9cb984c8b86e3…` · `source_transcript_before_snapshot.txt` · `/workspace/tce-slot-01/` |
| LAB-E0A-FIXTURE | **PRESENT** | `3e1b0803cc6790afdc48dd7cb214ecda597930f5225b1dbc1ad028ee3d539f71` · `experiments/memory-governance-e0a/fixture.json` |

## Provenance coverage

- Atoms with full provenance (artifact path + SHA256 + turn/location + speaker + VERBATIM exact text): **7**
- Total considered (prior Phase1): **45**
- **Coverage: 15.56%**

Primary corpus itself is 100% fully provenanced; overall coverage is low because missing transcripts force exclusion of most prior atoms.

## Search log (Phase 1A)

- Eiti-Wizard-Lab: fetched all remote branches; path/content search — no Orchid/LIVE-01/SLOT-01 transcript files (only e0b provenance MISSING markers)
- gh code search org:velantrian for orchid/tce-live-01/SLOT-01/source_transcript*: empty usable hits (Orchid hit = unrelated Titan floristry doc)
- Notion: TCE Snapshot/Observer page 3e1ac84d… has evidence summaries + claimed SHA256s; Orchid search empty; no embedded transcript body
- Drive: companion doc 1mLgFC4… evidence only; title/fullText searches found no source_transcript_before_snapshot.txt / tce-live / Orchid transcript; Orchid fullText → unrelated flora PDF
- Shared box: /workspace/tce-live-01, /workspace/tce-slot-01, claimed SHA256 file matches — ABSENT
- LAB-E0A-FIXTURE present: experiments/memory-governance-e0a/fixture.json SHA256=3e1b0803cc6790afdc48dd7cb214ecda597930f5225b1dbc1ad028ee3d539f71

## Files updated

- `corpus_manifest.json`
- `atoms_phase1.json` (primary = verbatim)
- `atoms_verbatim.json` (same primary)
- `atoms_excluded.json` (new ledger)
- `blind_inputs.jsonl` (verbatim-only, no gold)
- `human_label_packet.md` (USER atoms only; semantic axes null)
- `SOURCE_INTEGRITY_REPORT.md` (this file)
- `RESULT.md`
- `README.md`
- `provenance_excerpts/Orchid_MISSING.md` → ORCHID_SOURCE_MISSING
- `provenance_excerpts/LIVE-01_evidence_excerpt.md` → VERBATIM_TRANSCRIPT_MISSING
- `provenance_excerpts/SLOT-01_evidence_excerpt.md` → VERBATIM_TRANSCRIPT_MISSING
- `provenance_excerpts/LAB-E0A-FIXTURE_copy.json` (unchanged bytes; SHA match)

## Explicit non-actions

- Did **not** run blind model classification / PST-01
- Did **not** invent or reconstruct Orchid/LIVE-01/SLOT-01 transcript text
- Did **not** pad corpus with paraphrases to hit 30–50
- Did **not** mutate `experiments/memory-governance-e0a/**` (read-only; fixture copied under provenance_excerpts only)
- Did **not** write to owner repos

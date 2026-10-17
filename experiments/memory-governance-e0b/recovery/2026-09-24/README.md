# E0-B Local Artifact Recovery — 2026-09-24

**Recovery event:** `E0B_LOCAL_ARTIFACT_RECOVERY_2026-09-24`  
**Repository:** `velantrian/Eiti-Wizard-Lab`  
**Branch:** `exp/e0b-typing-reliability`  
**Recovery date:** 2026-09-24 (Europe/Berlin)  
**Mode:** WRITE ONLY TO THIS RECOVERY/PRESERVATION SURFACE

## Explicit recovery statements (required)

1. **Recovered from local historical workspace.** These bytes were found on the local box under `/workspace/e0b-prepare/experiments/memory-governance-e0b/` and quarantined under `recovery_quarantine_READONLY_2026-09-24/from_primary/`. They are pinned here as **RECOVERED LOCAL WORKSPACE ARTIFACTS** with the **current** recovery date.
2. **NOT in Git history at recovery time.** For each of the 13 artifacts, `git log` over historical paths returned **zero** hits at recovery start (parent tip `8a8557706a5a73bf9d177052104129e5020aa88f`). `historical_git_presence: NO`.
3. **This commit does NOT establish prior commit, publish, immutable, or remote preregistration.** Pinning recovered bytes to GitHub today is preservation, not backfill preregistration. `preregistration_claim: NOT_ESTABLISHED_BY_THIS_RECOVERY`. `historical_remote_preregistration: NOT_PROVEN`. `backdated: false`. `historical_git_reconstruction: false`.
4. **Preserves current known original bytes.** Copies used `cp -a` from quarantine after SHA-256 verification against the expected FULL digests. No regeneration, EOL normalization, JSON reserialization, timestamp rewrite, content edit, or reconstruction from memory. `content_modified_during_recovery: false`; `byte_copy_verified: true`.
5. **Historical claims need frozen GitHub artifacts / hashes / receipts / local forensic with honest labels.** Local filesystem mtimes and internal stamps are provenance clues only. They are not proof of remote preregistration. Do not treat this recovery tree as evidence that these files were previously published on GitHub.
6. **Do NOT relabel these files as original historical Git commits.** Destinations under `recovered_artifacts/` are recovery aliases for local workspace bytes. They are not reconstructed historical commits and must not be cited as such.
7. **A0 / A1 / B remain NOT_RUN.** This recovery does not continue U0b, write FRESH-U0-05, run triage, freeze U0b, create HUMAN_GOLD, or execute A0/A1/B.
8. **Frozen Human U0 unchanged.** `HUMAN_SEGMENTATION_REFERENCE.json` and `HUMAN_SEGMENTATION_REFERENCE_FREEZE_RECEIPT.json` were not modified. Existing frozen U0 history / experiment results, A0/A1/B state, and Crystal / Titan / Continuum / Soul surfaces were not touched.

## Layout

```
experiments/memory-governance-e0b/recovery/2026-09-24/
├── README.md
├── RECOVERY_MANIFEST.json
├── SHA256SUMS
├── U0B_EXPOSURE_PROVENANCE.md
├── recovered_artifacts/   (13 files)
└── optional/u0b_triage/   (empty — triage scripts NOT_RECOVERED)
```

## Artifacts recovered (13/13)

| dest name | sha256 (full) |
|---|---|
| PHASE_1J_FINAL_PRECOLLECTION_PATCH.md | 592ba9c1f169ceafb407528890fbfef39ab04fe77040f3780d07724c163dc373 |
| segmentation_evaluation_contract_v1.md | d4b40b3fe804e75f31e79d08870a190eeec9d6779027c4c90d77852e52612c37 |
| fresh_untouched_dataset_protocol_v1.md | 3f056518762d310caff2f18c30bfab8731178465bd5ef66edaf0a5029f687f89 |
| evaluation_contract_v1.md | b4d22cf58b7b29b7442f6c428b97b6e69f57cc655182b9a8265f6a7d42aabf9b |
| classifier_input_A0_raw_v1.json | a689669714d441193ad3c8f89b33173d3727fa3871cb0fc4cfd3c63a05a1959d |
| classifier_input_A1_presegmented_raw_v1.json | a168753d73149958e7b538b0035c0ccb2f618d263da771c729e3188fd114a852 |
| classifier_input_B_augmented_v1.json | d3b93f743be1add13a46aa1e10820ff880a5225979f691c01176e62cec87dcf7 |
| classifier_input_contract_v1.json | ec5892a17fd18512f92fa0def4a9efe948aa5204470027e02fff111793514f47 |
| fresh_U0_packet_v1.json | fbec1af53068c3bbd0ab37913006e414d3b8ce3bdbbb0a47729bca68c29da8b3 |
| human_U0_annotations_in_progress.json | 0ea83d9029ffb3f821fe7e844dbab236cd19e29951a4a74f63723d8d72714c07 |
| HUMAN_BOUNDARY_REFERENCE_U0b.in_progress.json | 9bcc60e86e67f3a739894f4d499c6c0a3a9bdbd7f144cb5b6e7fcbde9b56e039 |
| fresh_collection_2A_freeze.json | 5dd9f85f981b230816a3013802788d6a2f85bbd237d16236d880f2821011cfee |
| fresh_collection_manifest_v1.json | 9e6f2c29f483619f9953256c7a64b465dd79915723fdb6a359baa4bd1dfeee60 |

## U0b checkpoint

- Label: `U0B_WORKING_CHECKPOINT_PRE_CONTINUATION`
- File: `recovered_artifacts/HUMAN_BOUNDARY_REFERENCE_U0b.in_progress.json`
- SHA-256: `9bcc60e86e67f3a739894f4d499c6c0a3a9bdbd7f144cb5b6e7fcbde9b56e039`
- Status: working checkpoint only; **NOT** final gold; U0b not complete. See `U0B_EXPOSURE_PROVENANCE.md`.

## Triage scripts (optional)

| name | expected sha256 | status |
|---|---|---|
| u0b_triage_v1.0.0.py | 708a778956063dc429de03cf72e38fa50ee13dd469ca4261db95f9f479efebac | **NOT_RECOVERED** |
| u0b_triage_v1.0.1.py | 9cc87f025c47d37e33bf3761680da4907707a26afd84da9ddc7a09108bae04ac | **NOT_RECOVERED** |
| u0b_triage_v1.0.2.py | 410aa7fd34aa6591c6ad5a3d89ee04abea47d141250041f1cea63755dba861ad | **NOT_RECOVERED** |

`TRIAGE_VERSIONS = 0/3`. Directory `optional/u0b_triage/` left empty. Do not invent.

## F8 hash semantics finding

- Full-file SHA-256 of `fresh_collection_manifest_v1.json` = `9e6f2c29f483619f9953256c7a64b465dd79915723fdb6a359baa4bd1dfeee60`
- Embedded `manifest_content_sha256` / freeze `manifest_sha256` = `9bcce7c2327bf14d81fd9af0761ee7940f450328ecd7445a88144483a6385ed5`
- Interpretation: **self-hash-excluding-content semantics candidate**; NOT claimed as a missing alternate full file; originals were **not** rewritten.
- `F8_STATUS`: `HASH_SEMANTICS_AMBIGUITY_RESOLVED_TO_SELF_HASH_PATTERN_CANDIDATE`

## Suggested state language (Issue #8)

`OPEN` / `RECOVERY_ARTIFACTS_PRESERVED` / `HISTORICAL_REMOTE_PREREGISTRATION=NOT_PROVEN` / `F8=RECLASSIFIED` / `U0B=IN_PROGRESS` / `A0/A1/B=NOT_RUN`

## Out of scope (do not treat this commit as doing these)

- Continue U0b / write FRESH-U0-05 / run triage / freeze U0b / create HUMAN_GOLD / run A0/A1/B
- Modify frozen Human U0 or other experiment result surfaces
- Claim remote historical preregistration was repaired

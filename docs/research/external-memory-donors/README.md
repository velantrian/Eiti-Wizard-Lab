# External Memory Donors & Prior Art

Status: **RESEARCH / DONOR DISCOVERY**

This directory records external agent-memory architectures and mechanisms that may be relevant to Eiti-Wizard-Lab.

It is intentionally **not** an integration decision, implementation authorization, runtime activation, experiment result, or Canon admission.

## Core boundary

DONOR DISCOVERED != DONOR VALIDATED != MECHANISM TESTED != MECHANISM ADOPTED != RUNTIME ACTIVE != CANON

The purpose of this directory is to preserve commit-pinned / source-grounded donor research while keeping Eiti authority boundaries intact.

## Current donor set

| Donor | Research role | Candidate mechanisms | Main caution |
|---|---|---|---|
| BlooRecall | source retrieval donor | BM25 + local embeddings, source drift | retrieval != truth |
| Hillock | associative donor | KG, HDC/VSA, Hebbian-like activation, answerability gate | association != admission |
| Virtual Context | temporal/context donor | verbatim history, supersession, fact decisions, paging | source record != Eiti Canon |
| Slowave | adaptive/procedural donor | feedback, utility, salience/decay, procedures | usefulness != truth |
| Kwipu | structured-source donor + failure case | deterministic wikilink/frontmatter graph | derived facts require provenance |
| Agent Memory Atlas | research map | tombstone, trust, bitemporal, scope, audit, human review | static review != runtime proof |
| Context Radar | freshness donor | drift detection, reassessment trigger | drift != invalidation |
| Daily-Nerd Scout | research-intake donor | discovery, candidates.jsonl, triage | discovery != validation |
| Daily-Nerd Scar | negative-memory donor | dead ends, fences, landmines, failure reasons | past failure != impossible forever |

## Sources

- https://github.com/Blooshoo/BlooRecall
- https://github.com/roandejager/Hillock
- https://github.com/roandejager/Hillock/releases/tag/v0.9.0
- https://hillock.mintlify.site/
- https://github.com/virtual-context/virtual-context
- https://slowave-ai.mintlify.app/
- https://github.com/benmaster82/Kwipu/issues/4
- https://neoneye.github.io/agent-memory-atlas/
- https://github.com/thoroc/context-radar/blob/main/.github/workflows/freshness.yml
- https://github.com/Daily-Nerd/scout
- https://github.com/Daily-Nerd/Scar

## Community evidence handling

Community/Discord statements may be recorded as **AUTHOR_STATEMENT / DESIGN_INTENT** evidence, but they are not implementation or runtime proof.

Raw screenshots should remain outside this public repository unless publication is explicitly appropriate. Public records should contain normalized findings only.

## Candidate invariants

- ASSOCIATION != ADMISSION
- ASSOCIATION STRENGTH != TRUTH
- USEFULNESS != TRUTH
- SALIENCE != AUTHORITY
- DECAY OF RETRIEVAL != DECAY OF EVIDENCE
- REJECTED != FORGOTTEN
- FAILED APPROACH != USELESS HISTORY
- PAST FAILURE != IMPOSSIBLE FOREVER
- FRESHNESS != TRUTH
- DRIFT != INVALIDATION
- UPSTREAM CHANGE != CANON MUTATION
- STALE FOR CURRENT USE != INVALID AS HISTORICAL EVIDENCE
- DISCOVERY != VALIDATION
- MISSING != ZERO
- WORKFLOW STATUS != EVIDENCE STATUS
- README CLAIM != IMPLEMENTATION
- SOURCE RECORD != CANON
- EXTRACTED FACT != VERIFIED FACT
- GRAPH EDGE != TRUTH
- MODEL-GENERATED SUMMARY != SOURCE
- NEWER != AUTOMATICALLY AUTHORITATIVE

## First bounded experiment candidates

1. Rejected-value tombstone / negative knowledge.
2. Freshness drift without Canon mutation.
3. Source -> derived fact provenance and deterministic retirement/supersession.

No experiment has been run by adding this directory.

## Research intake lifecycle

EXTERNAL SOURCE -> DISCOVERY -> TRIAGE -> DONOR REVIEW -> BOUNDED EXPERIMENT -> EVIDENCE -> OWNER DECISION

Only actual bounded experiments should enter the central Experiment Registry.

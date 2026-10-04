# Owner Passport / Personal Authority — Resume Checkpoint

**Date:** 2026-10-04  
**Status:** docs-only handoff / resume checkpoint  
**Repository:** `velantrian/Eiti-Wizard-Lab`  
**Base checkpoint:** `lab/continuity-carrier-m1@e9e5ea3cd3fcdb19902c071f1b24b2705a6fef31`

> This document records where the Owner Passport / Personal Authority & Delegation research line stopped and how to resume it. It is not Canon admission, runtime authorization, a grant, or permission to start implementation.

## Purpose

The larger goal is a provider-neutral continuity system in which durable memory, owner context, goals, and authority do not belong to a model/provider. Models may observe and propose, but owner authority remains separate from model output.

The Owner Passport / Personal Authority line adds a strict distinction between:

- what is known about the owner;
- what the owner wants;
- what the system may infer;
- what an agent is actually authorized to do.

Core rule:

`KNOWN_ABOUT_OWNER != OWNER_PERMISSION`

## Completed design work

- Digital Owner Passport / Personal Authority & Delegation design: **PASS / FROZEN** after targeted independent re-audit.
- Implementation-precondition study: **COMPLETE**.
- Owner Decision Pack for a bounded, non-authoritative, synthetic/read-only prototype: **PREPARED**.
- Isolation requirements and acceptance plan: **COMPLETE**.
- Isolation model defines 17 requirements (A-Q) and 16 acceptance checks (ISO-01..ISO-16).
- Local backend feasibility assessment: **COMPLETE**.
- Seven local backend candidates were evaluated in the current Manus environment; **0 were accepted as viable**.

Do not reopen the frozen design merely because implementation is blocked. A new design review requires new contradictory evidence.

## Current hard stop

```text
CURRENT_WORKSPACE_REUSABLE=NO
LOCAL_ISOLATION_BACKEND_AVAILABLE=NO
ISOLATION_ACCEPTED=NO
ENVIRONMENT_READY=NO
PROTOTYPE_READY=NO
PROTOTYPE_STARTED=NO

OWNER_CHANNEL_GATE=NOT_ACCEPTED
MERGE_SERIALIZATION_GATE=NOT_ACCEPTED
RUNTIME_GATES_DEPLOYED=0/2

CANON_APPLY=0%
```

ISO-01..ISO-16 have **not been executed**. For acceptance reporting they are currently `FAIL (NOT RUN)` because no qualifying disposable environment exists. This is not evidence that an implemented prototype failed the tests.

## Why the current Manus workspace is not accepted

The current environment did not establish the required technical boundary. Findings include:

- current workspace is not proven to be a disposable isolated target;
- current execution identity is not proven test-only and has supplementary `sudo` membership;
- `NoNewPrivs=0`;
- `Seccomp=0`;
- hard per-run CPU, memory, PID and writable-storage enforcement is unavailable or unproven;
- enforced no-egress is unavailable or unproven;
- independent observability and verified cleanup/rollback are not established;
- isolation from production credentials and official Git/Canon/ledger is not completely proven;
- availability of `bwrap` or `unshare` CLI is not evidence that the required enforcement exists.

A read-only backend feasibility pass evaluated seven local approaches and found **0 viable**. Do not repeat local-backend audits unless the execution environment materially changes.

## Required future environment

When the owner has access to a suitable PC/server or separately controlled external host, provision exactly one **disposable VM/microVM/test host** with an independent host-side controller.

The future target must be capable of proving, at minimum:

- network/egress default deny;
- no host network namespace or host control sockets;
- no production credentials;
- no official Git/Canon/ledger mounts or routes;
- separate test-only identity without admin/sudo;
- no privilege escalation;
- read-only root filesystem where practical;
- read-only synthetic fixtures and manifest;
- narrowly bounded writable work/output/log areas;
- CPU <= 1 core;
- memory <= 512 MiB;
- PIDs <= 10;
- writable storage <= 100 MiB;
- output/run <= 5 MiB;
- external runtime deadline <= 60 seconds;
- independent minimized run logs;
- verified cleanup/rollback;
- no hidden alternate tool/effect route.

These are test/prototype limits, not production limits.

## What ISO-01..ISO-16 are for

The acceptance suite must prove the sandbox boundary technically rather than rely on an AI promise. It covers:

1. disposable workspace isolation;
2. synthetic-only inputs;
3. read-only originals;
4. production credentials unavailable;
5. network denied;
6. CPU bounded;
7. memory bounded;
8. storage/output/process count bounded;
9. external timeout;
10. official Git inaccessible;
11. Canon inaccessible;
12. official ledger inaccessible;
13. limited identity and no privilege escalation;
14. logs complete/integrity-protected enough for review;
15. rollback/cleanup;
16. bypass attempts blocked.

Acceptance is fail-closed:

`FAIL / UNKNOWN / NOT_VERIFIED / PARTIAL / missing evidence => ISOLATION_ACCEPTED=NO`

All applicable ISO checks must PASS before isolation can be accepted.

## Exact resume procedure

A future AI/session should resume as follows:

1. Read this checkpoint and the frozen Owner Passport / Personal Authority design.
2. Do **not** redesign the frozen architecture without new contradictory evidence.
3. Do **not** reuse the rejected current Manus `/workspace`.
4. Wait until an owner-controlled PC/server or suitable external VM/test host is available.
5. Provision one disposable target only after explicit owner authorization for that provisioning/acceptance stage.
6. Configure the accepted isolation requirements A-Q.
7. Run ISO-01..ISO-16 against that disposable target and collect a sanitized evidence package.
8. Accept isolation only if every applicable check is PASS.
9. STOP for owner review after the isolation evidence. Isolation PASS does not automatically authorize the prototype.
10. Only after a separate explicit owner GO may the bounded non-authoritative prototype start:
    - synthetic fixtures;
    - read-only Passport View;
    - mock/non-authoritative grant representation;
    - pure read-only PDP;
    - deterministic fixture tests.

## Still not authorized by this checkpoint

This document does **not** authorize:

- real owner data;
- authoritative/real grants;
- authoritative grant activation;
- PEP real effects;
- autonomous real-world effects;
- `UPDATE_ONE_DERIVED_LOCAL_INDEX` execution;
- production deployment;
- production credentials;
- official Git changes beyond separately reviewed docs work;
- UDL changes;
- official ledger mutation;
- Canon mutation/apply;
- model/provider ownership of authority.

## Preserved authority boundaries

```text
OWNER_PROFILE != OWNER_PERMISSION
KNOWN_ABOUT_OWNER != OWNER_PERMISSION
OWNER_GOAL != ACTION_AUTHORITY
GOAL_ALIGNMENT != AUTHORIZATION
OWNER_PREFERENCE != DELEGATION
PAST_OWNER_ACCEPTANCE != FUTURE_PERMISSION
INFERRED_OWNER_INTENT != OWNER_INTENT
MODEL_CONFIDENCE != OWNER_INTENT
CONTEXT_ACCESS != ACTION_AUTHORITY
ABSENCE_OF_CONFLICT != CONSENT
UNKNOWN != PERMISSION
DELEGATED_ACTION != USER_DECISION
DELEGATION != CANON_APPLY
AI_CANNOT_SELF_EXPAND_AUTHORITY
TECHNICAL_ACCESS != AUTHORIZATION
TOOL_AVAILABLE != TOOL_AUTHORIZED
MODEL_DECISION != ENFORCEMENT_DECISION
```

The broader continuity invariants also remain in force, including `MODEL != MEMORY_OWNER`, `PROVIDER != MEMORY_OWNER`, `MODEL_OUTPUT != CANON`, `USER_DECISION != CANON_APPLY`, and `IMPLEMENTED != ACTIVATED`.

## Next bounded action

**WAIT until an owner-controlled PC/server or suitable external VM/test host is available. Then provision exactly one disposable target and run the isolation acceptance stage.**

Do not start the prototype automatically.

---

### Progress snapshot

- Owner Passport / Personal Authority design: **100% — PASS / FROZEN**
- Implementation-precondition study: **100%**
- Isolation requirements / acceptance plan: **100%**
- Local backend feasibility: **100%**
- Viable local backends in current environment: **0 / 7**
- Isolation acceptance tests actually executed: **0 / 16**
- Accepted environment: **0%**
- Non-authoritative prototype: **0%**
- UDL runtime gates accepted/deployed: **0 / 2**
- Canon Apply: **0%**

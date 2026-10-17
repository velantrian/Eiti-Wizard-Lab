# Eiti Working Research Workspace & Digital Identity Routing

Status: **RESEARCH / ARCHITECTURE PROPOSAL**

This document records a bounded proposal for:

1. a **Digital Identity / Owner Passport routing policy**; and
2. a **Working Research Workspace v0.1** for long-running LLM-assisted work.

It is **not** Canon, not owner authority, not admission, not runtime authorization, and not an automatic memory writer.

## Why this exists

Research is currently distributed across chats, GitHub, Notion, Google Drive, experiments, external projects, and community discussions. The practical failure mode is repeated reconstruction: the thread is lost, the same questions are revisited, and it becomes unclear where a new idea or result belongs.

The immediate goal is a practical workspace that can preserve bounded working state and storage routing without granting an LLM authority over identity or Canon.

## Core boundaries

- DIGITAL_IDENTITY != TRUTH_ORACLE
- POLICY != FACT
- AUTO_ROUTING != AUTO_ADMISSION
- WORKSPACE != CANON
- WORKING_MEMORY != OFFICIAL_MEMORY
- RETRIEVAL != EVIDENCE
- UTILITY != TRUTH
- ASSOCIATION != ADMISSION
- MODEL_SUMMARY != OWNER_ASSERTION
- UNKNOWN != FALSE
- NOT_RETRIEVED != ABSENT
- SUPERSEDED != DELETED
- FAILED_APPROACH != USELESS_HISTORY
- DRIFT != INVALIDATION
- UPSTREAM_CHANGE != CANON_MUTATION

## Digital Identity / Owner Passport

The passport is a policy-bearing identity/orientation object for a human or system.

It may describe:

- identity / role / north star;
- current priorities and active research questions;
- projects and horizons;
- values and non-negotiable invariants;
- privacy and action boundaries;
- topics actively sought;
- topics allowed for consideration;
- donor domains;
- epistemic handling policy;
- storage/routing policy;
- narrowly pre-authorized low-risk writes.

It does **not** decide what is objectively true.

### Candidate routing classes

Incoming information may be routed to:

- WORKING_NOTE
- OBSERVED
- DONOR_CANDIDATE
- RESEARCH_PRIORITY
- RESEARCH_TAIL
- HYPOTHESIS
- EXPERIMENT_CANDIDATE
- HUMAN_REVIEW_REQUIRED
- REJECTED / NEGATIVE_KNOWLEDGE
- ADMISSION_CANDIDATE

Only an explicitly authorized admission path may produce Canon.

### Authority idea

Owner authority does not require manual approval of every low-risk working write.

The owner may define policy allowing the system to:

- create a working note;
- add an external donor candidate;
- attach source references;
- update freshness metadata;
- route an item to a research queue.

Identity claims, beliefs, values, owner decisions, high-impact project direction, and Canon transitions should remain subject to stronger policy and/or human review.

## External retriever / memory donors

External systems already reviewed should remain **replaceable mechanisms**, not authorities.

| Donor | Candidate role | Boundary |
|---|---|---|
| BlooRecall | source retrieval + drift | retrieval != truth |
| Hillock | association / HDC / neuro-symbolic retrieval | association != admission |
| Virtual Context | temporal context, paging, supersession | source record != Canon |
| Slowave | adaptive/procedural memory | usefulness != truth |
| Kwipu | structured-source graph | derived fact requires provenance |
| Agent Memory Atlas | donor discovery / lifecycle map | static review != runtime proof |
| Context Radar | freshness / drift | drift != invalidation |
| Scout | discovery / triage | discovery != validation |
| Scar | negative knowledge | past failure != impossible forever |

Sources:

- https://github.com/Blooshoo/BlooRecall
- https://github.com/roandejager/Hillock
- https://github.com/virtual-context/virtual-context
- https://slowave-ai.mintlify.app/
- https://github.com/benmaster82/Kwipu/issues/4
- https://neoneye.github.io/agent-memory-atlas/
- https://github.com/thoroc/context-radar/blob/main/.github/workflows/freshness.yml
- https://github.com/Daily-Nerd/scout
- https://github.com/Daily-Nerd/Scar

### Role separation

- Source retriever: "Where is it written?"
- Temporal retriever: "What happened and what was current then?"
- Associative retriever: "What is related?"
- Procedural retriever: "What worked before?"
- Freshness watcher: "Has upstream changed?"
- Negative memory: "What failed and why?"
- Eiti governance: "What is this allowed to become?"

Retriever output must not silently become evidence, an owner decision, or Canon.

## Working Research Workspace v0.1

The workspace should act like a small research notebook / project memory inside Eiti.

Each work item receives a stable ID.

### Candidate record

```text
WORK_ID
TITLE
CREATED_AT
UPDATED_AT
STATUS
PROJECT
THREAD
SOURCE_CLASS
SOURCE_REFS
SHORT_SUMMARY
CURRENT_QUESTION
CURRENT_STATE
NEXT_BOUNDED_ACTION
RELATED_WORK_IDS
EVIDENCE_REFS
STORAGE_TARGETS
PROVENANCE_CLASS
```

Example:

```text
WORK_ID=WRK-20261005-001
TITLE=External memory donors for Eiti
PROJECT=Eiti-Wizard-Lab
THREAD=memory-governance
STATUS=ACTIVE_RESEARCH
SHORT_SUMMARY=Compare external retrieval/memory systems and extract donor mechanisms
NEXT_BOUNDED_ACTION=Run commit-pinned donor audit
STORAGE_TARGETS=GitHub,Notion,Drive
```

### Workspace layers

1. Inbox
2. Working Notes
3. Research Threads
4. Donor Queue
5. Experiment Candidates
6. Human Review
7. Negative Knowledge
8. Historical / Superseded Archive

## Storage routing map

### GitHub

Use for:

- technical contracts;
- schemas;
- code-adjacent research cards;
- experiment plans and results;
- machine-readable registries;
- commit-pinned evidence.

### Notion

Use for:

- navigation;
- research queues;
- active threads;
- priorities;
- donor registry;
- human-facing dashboard.

### Google Drive

Use for:

- long-form research chronicle;
- detailed handoffs;
- evidence narratives;
- private/community captures where appropriate;
- large synthesis documents.

### Experiment Registry

Use only for actual bounded experiments and their evidence/results.

### Canon

Use only for admitted continuity state.

## Documentation-aware routing

Before saving, the system should determine:

- object class;
- project;
- authority level;
- evidence level;
- privacy level;
- intended lifetime;
- owning store.

If uncertain:

```text
ROUTE_TO_REVIEW
```

Do not guess.

## MVP scope

Working Research Workspace v0.1 should implement only:

1. stable WORK_ID;
2. title/date/project/thread/status;
3. short summary;
4. current question;
5. next bounded action;
6. provenance/source refs;
7. storage target;
8. related work IDs;
9. explicit NON_CANON label;
10. deterministic list/search by ID, project, date, and status.

Not in v0.1:

- graph;
- embeddings;
- semantic retrieval;
- automatic donor scoring;
- adaptive salience;
- automated admission;
- real owner authority;
- Canon Apply.

## First experiment

Question:

Can a fresh LLM session recover one active research thread from the workspace, identify where authoritative sources live, recover the last stop, and continue with the correct bounded next action without reading prior chat history?

Candidate PASS conditions:

- correct project/thread;
- correct last stop;
- correct next bounded action;
- correct source locations;
- zero invented owner facts;
- zero Canon mutation;
- no confusion between working note and evidence.

## Cross-system durable records

Google Drive:
https://docs.google.com/document/d/1-ZreAQzB43qTe67h6OG3egZX1zooqCtmYA_8yfu1FrM/edit

Notion:
https://app.notion.com/p/3f0ac84d054781fbaec2de6544dcfd95

External donor registry:
https://app.notion.com/p/3f0ac84d054781ea973cfb6ebf11e040

## Next bounded action

Design and test **Working Research Workspace v0.1** as an isolated experiment.

Do not merge it into Canon, owner authority, admission, or runtime continuity until the cross-session routing/resume experiment is independently reviewed.

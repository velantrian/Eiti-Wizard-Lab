# E0-A Owner Trace — Ownership & Governance Conformance Probe

**Repo inspected:** `velantrian/Eiti-Wizard-Lab` (default branch `main`, HEAD at probe start `01f05c514e8c800e2f271f63f6e2828385db1ea3`)  
**Method:** GitHub MCP `get_file_contents` / `list_commits` + raw `index.html` grep. Code search returned incomplete/empty index for this repo.  
**Rule:** Mark UNKNOWN if no existing owner — do not invent. Do not invent Crystal/Continuum/Native Kernel bindings into this lab repo.

## Repo surface (factual)

| Path | Role |
|------|------|
| `README.md` | Product overview; memory described as IndexedDB + future graph memory |
| `AGENTS.md` | Cursor agent notes; single-file PWA; IndexedDB memory |
| `index.html` | Entire app (~11k lines): IndexedDB stores + SQLite WASM L1/L2/L3 facts |
| `sql-wasm.js` / `sql-wasm.wasm` | SQLite WASM engine (not a memory DB file) |
| `export-forensic-20260920.html` | Read-only IDB dump helper |
| `docs/` | **Absent** (404) |
| `experiments/` | **Absent** before this probe (404) |

**Named organs Crystal / Native Kernel / Continuum / Mentaury Soul / Mentaury-Kernel:**  
**Not present** as code, docs paths, or callable modules inside `Eiti-Wizard-Lab`.  
Ecosystem role definitions exist only outside this repo (Notion Separation Plan v1.0, Continuum IDPS pages) and are **not wired** here. Cross-domain boundary note only — **no ownership claim transferred into this lab**.

## Six WHO answers (governance slice)

| Question | Owner | Citation | Notes |
|----------|-------|----------|-------|
| **WHO receives?** | **UNKNOWN** | — | No admission intake / envelope receiver for MODEL_PROPOSAL vs USER_DECISION in this repo. Chat/message handlers in `index.html` receive chat text, not governance envelopes. |
| **WHO admits?** | **UNKNOWN** | — | No admission protocol distinguishing proposal vs decision vs research claim. `index.html` personal/EITI memory write paths (`dbPut('memory', …)`, `wiz_facts` INSERT) store facts without governance admission types. |
| **WHO enforces transition law?** | **UNKNOWN** | — | No MODEL_PROPOSAL → USER_DECISION transition law, no ACTIVE/REJECTED/SUPERSEDED state machine in repo. Epistemic labels on `wiz_facts.epistemic_state` (`index.html` ~5597–5766) are fact-layer labels, not decision transition law. |
| **WHO stores?** | **Lab runtime stores (not Crystal)** | `index.html` IndexedDB `openDB` / `STORES` (~2808–2838); SQLite WASM `wiz_facts` / `wiz_l2_digests` (~5597–5796); UI note ~2185 | Browser-local persistence. **Not** Crystal trusted-memory write boundary. No committed `.sqlite`/`.db` memory files in git tree (18 files; none are memory DBs). |
| **WHO projects current state?** | **UNKNOWN** (governance ACTIVE) / partial chat snapshot | Clean Resume UI ~2895–3208 `wizStartCleanResume` / `wizBuildCleanResumeContext` | Projects chat snapshot after resume boundary — **not** authoritative ACTIVE decision projection for architecture governance. |
| **WHO retrieves for resume?** | **Partial: Clean Resume in `index.html`** | `wizLoadResumeStateForChat`, `wizPersistResumeState`, `wizBuildCleanResumeContext` (~2921–3208) | Retrieves snapshot + post-boundary messages. Does **not** return rejected Graphiti branch, open authorization loop, or governance rationale as specified by E0-A. |

## Ecosystem organs (out-of-repo; boundary only)

Cited Notion Separation Plan roles (NOT implemented in this repo — do not treat as local owners):

- **Crystal** — trusted memory/evidence write boundary (external)
- **Native Kernel** — semantic obligations / invariants (external)
- **Continuum** — capture/transfer experiment lab (external)
- **Mentaury Soul** — identity/belief admission (external; semantic boundary only)
- **Mentaury-Kernel** — cross-domain composition / non-escalation (external; boundary only)

For **this slice inside Eiti-Wizard-Lab**, those organs remain **UNKNOWN / not present**.

## Existing memory store paths — DO NOT MUTATE

| Kind | Path / locator | Status |
|------|----------------|--------|
| Committed sqlite memory DB | *(none found in repo tree)* | N/A — nothing to mutate |
| SQLite WASM engine | `sql-wasm.js`, `sql-wasm.wasm` | Engine binaries only; not written by this probe |
| Runtime IndexedDB (browser) | stores: `chats`, `messages`, `memory`, `files`, `config`, `agents`, `chunks`, `tasks`, `agent_backups` (`index.html` ~2808, ~2185) | Browser-only; probe never opened or wrote |
| Runtime SQLite tables | `wiz_facts`, `wiz_facts_fts`, `wiz_l2_digests`, `wiz_notes_fts` (`index.html` ~5597+) | Created in-browser; probe never touched |
| Forensic export helper | `export-forensic-20260920.html` | Read-only dump tool; not mutated |

**Proof:** This probe creates only isolated `experiments/memory-governance-e0a/e0a.sqlite3` under the experiment directory. No writes to any path listed above.

## UNKNOWN owner gaps (summary)

1. No receiver for typed governance events  
2. No admission authority for proposals vs decisions  
3. No transition-law enforcer (ACTIVE/REJECTED/SUPERSEDED)  
4. No authoritative current-state projector for decisions  
5. Resume path is chat-snapshot only — missing governance fields  

**Implication for STOP line:** gaps are **missing arrows / missing owners**, not a mandate to create a new architecture organ inside this probe. Isolation fixture demonstrates law; promotion is out of scope.

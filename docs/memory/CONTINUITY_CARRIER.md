# Continuity Carrier — M1 contract

Provider-neutral GitHub continuity carrier for Velantrim / EITI.
**Milestone:** M1 (canon declaration only). No Lab importer changes. No second passport.

## Equalities (non-negotiable)

- `CANON != DERIVED`
- `CANON != TRUTH`
- `CURRENT_STATE != HISTORY`
- `WIZ_REF != CANON`
- `MODEL != MEMORY_OWNER`
- `PROVIDER != MEMORY_OWNER`
- `CHAT != CANON`
- `MODEL_SUMMARY != CANON`
- `MODEL_PROPOSAL != USER_DECISION`
- `UNKNOWN != FALSE`
- `SUPERSEDED != DELETED`

## What “Canon” means here

`docs/memory/ruslan-orientation-seed.json` is the **`CANONICAL_CONTINUITY_RECORD_SET`**:

the official **provider-neutral** set of **admitted** orientation records, each keeping its own `status` / `provenance` / `source`.

**`CANON != TRUTH`:** Canon does **not** assert absolute truth of every statement. Historical, open, unknown, superseded, deferred, and model-proposal rows remain labeled as such.

## Flow

```text
GitHub Canon (seed + manifest)
        ↓ regenerate
current-state view (CURRENT_ORIENTATION.md)
        ↓ export-lab (deterministic, no LLM)
derived wiz_ref JSONL (wiz-ref-jsonl/1)
        ↓ optional UI import
Lab local wiz_ref_* runtime index
        ↓
replaceable AI / client (Grok, ChatGPT, Claude, Vibe, Copilot, …)
```

Any client is a **reader/writer candidate**. No single model or API vendor owns memory.

## Admission

| Key | Value |
|---|---|
| `ADMISSION_POLICY` | **SPECIFIED** (see allow-list below + seed enums / invariants) |
| `ADMISSION_IMPLEMENTATION` | **ABSENT / FUTURE** (Memory Admission Controller is **not** implemented in this repo) |

The current seed is treated as the **already-admitted initial canonical set** at carrier activation.

**Do not** implement automatic admission decisions in M1.

Admission-worthy classes (policy only): USER_DECISION, appropriate USER_GOAL / preference, PROJECT_STATE, VERIFIED_RESULT, OPEN_QUESTION, NEXT_ACTION, SUPERSESSION, authoritative correction, relevant provenance/evidence.  
Never: chat transcript as canon; unlabeled model summary as user decision; UNKNOWN coerced to FALSE.

## Event ledger

Path: `docs/memory/event_ledger.jsonl` (reserved in `manifest.json`).

- Starts **empty** at Continuity Carrier activation.
- **No** backfill of synthetic history from the existing seed.
- Future append-only admissions / supersessions / conflicts only.

## Derived artefacts (rebuildable from Canon)

| Artefact | Role |
|---|---|
| `docs/memory/CURRENT_ORIENTATION.md` | `DERIVED_VIEW` (`seed_tool render-start-view`) |
| `export-lab` → `wiz-ref-jsonl/1` | `DERIVED_INDEX_BUILD_PATH` |
| Lab `wiz_ref_*` | `LOCAL_DERIVED_RUNTIME_INDEX` |

Delete or wipe a derived layer → restore from Canon + tools. Derived layers are not authority.

## Write / concurrency (M1)

- `default_write_mode` = **`READ_WRITE_PR`**
- `concurrency_mode` = **`OPTIMISTIC_MANIFEST_HASH`** (writes declare base `canonical_content_sha256` / manifest hash; no silent overwrite)

`READ_WRITE_DIRECT` is out of scope unless explicitly authorized later.

## Security

Canon, manifest, ledger, and derived bundles must **never** contain API keys, tokens, passwords, cookies, or other credentials. Private locators stay under gitignored `private-memory/`.

## Non-goals of M1

- No file moves / `continuity/passport.json` duplicate
- No seed content edits
- No Lab importer / `index.html` / `wiz-ref-memory.js` changes
- No merge requirement; review via PR when ready

See also: `docs/memory/manifest.json`, `docs/memory/README.md`, `docs/REFERENCE_MEMORY.md`.

## Примечание М2.2.0a — lifecycle без допуска

- `admission_state` остаётся `OBSERVED` для каждого события, `authorized_by` остаётся null/отсутствует, `admission_implementation=ABSENT`.
- Допустимая lifecycle-последовательность: `OBSERVED → CANDIDATE → PROPOSED`, а также `HOLD`, явный `CONFLICT_MARK` и терминальный lifecycle `SUPERSEDE` по transition matrix.
- `proposal_content_kind=FULL_RECORD` означает только артефакт предлагаемой записи; это не Canon CREATE/UPDATE/PATCH и не решение пользователя.
- Semantic parent задан только `applies_to_event_id`; `prior_event_id` остаётся физическим append-порядком.
- `project-proposals` — read-only board. Несколько открытых proposal от одного OBSERVE root дают warning, но не conflict и не authority.
- Нет USER ADMIT, состояния ADMITTED, применения к Canon, изменений seed/manifest/CURRENT_ORIENTATION/SOURCE_REGISTRY/wiz_ref или правок operational `event_ledger.jsonl` в этой вехе.
- Старые OBSERVE события без `lifecycle_state` сохраняют совместимость и проецируются как `OBSERVED`.
- Источник записи сохраняет строгий XOR M2.1.1 (Путь А или Путь Б); `recorded_by` остаётся заявленной меткой, не подтверждением личности.
- Подробности — в `docs/memory/EVENT_LEDGER_SCHEMA.md` и схеме `continuity-carrier-event-ledger/2.2.0a`.

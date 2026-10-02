# docs/memory — Ruslan Orientation Passport

## Continuity status — 2026-10-02

- **M1 — MERGED** (`PR #13`)
- **M2 — MERGED** (`PR #15`)
- **M3 — DONE / MERGED / CLOSED** (`PR #16`)
  - accepted head: `78fbf5eee74e0184c71e9dcfd0e5393a484707f3`
  - merge commit / completion point on `main`: `826e27abb9e1f114a11773adc2a79e1bc60927d0`
  - post-merge Manus run: **66/66 PASS**
  - seed validate: **79 records, 0 errors, 0 warnings**
  - `CANON_UNCHANGED = TRUE`
  - `MANIFEST_UNCHANGED = TRUE`
  - `EVENT_LEDGER_UNCHANGED = TRUE`
  - `ADMISSION_IMPLEMENTATION = ABSENT`
  - `M4_NOT_STARTED = TRUE`

M3 provides the provider-neutral read-only runtime bridge:
`Canon → verified M2 bootstrap → committed derived runtime artifact → browser loader → 35-record runtime core → central instructions → selected provider/model`.

**M3 is complete.** Future work is separate and must not be treated as M3 debt: M4 selective retrieval, runtime-artifact content binding, whole-record context budget, Service Worker stale-cache hardening, future SNAP+Continuity composition, and future admission/write architecture.

| Файл | Что это |
|---|---|
| `RUSLAN_ORIENTATION_PASSPORT.md` | Паспорт ориентации (RU, 13 разделов), написан вручную по seed. |
| `CURRENT_ORIENTATION.md` | Стартовая выжимка. **Генерируется** из seed, руками не править. |
| `ruslan-orientation-seed.json` | Источник истины паспорта: записи с type/status/source/provenance/relations (`ruslan-orientation-seed/1`). |
| `SOURCE_REGISTRY.md` | Реестр источников: роль, use-for, do-not-use-for, reachable, найденные конфликты. |
| `../../tools/memory/seed_tool.mjs` | Node без зависимостей: `validate`, `stats`, `render-start-view`, `search`, `export-lab`, `export-context`. |
| `AI_CONTEXT_BOOTSTRAP.md` | Провайдер-нейтральный контекст М2 (`eiti-context-bootstrap/1`): сборка из канона через ворота целостности. |
| `context-bootstrap.runtime.json` | Производный runtime-артефакт М3 (DERIVED): побайтовая копия `exportContext({ format: 'json' })`, читается браузером. Руками не править — пересобирать командой ниже. |
| `AI_CONTEXT_RUNTIME.md` | Read-only рантайм-мост М3: загрузчик, ограниченное ядро (35 записей), инжект в центральные инструкции, Clean Resume purity. |
| `../../continuity-runtime.mjs` | Модуль М3 без зависимостей: проверка пакета, отбор/рендер ядра, композиция инструкций, `fetch`-загрузчик. |

```bash
node tools/memory/seed_tool.mjs validate
node tools/memory/seed_tool.mjs render-start-view --out        # → docs/memory/CURRENT_ORIENTATION.md
node tools/memory/seed_tool.mjs search "Что остаётся открытым?" --k 5
node tools/memory/seed_tool.mjs export-context --format json   # провайдер-нейтральный пакет М2 (или --format md)
node tools/memory/seed_tool.mjs export-context --format json --out docs/memory/context-bootstrap.runtime.json  # М3: пересборка runtime-артефакта (только через exportContext)
node tools/memory/seed_tool.mjs export-lab --out private-memory/ruslan-orientation-seed.private.jsonl \
     [--locators private-memory/source-locators.private.json]
node --test tools/memory/
```

## Как паспорт попадает в память Lab
Память Lab — это IndexedDB `velan-eiti-lab-db` v7 (store `memory`: EITI Memory `kind:'eiti_mem'`, L2-дайджесты, дневник) плюс SQLite (sql.js-fts5, `window._wizDB`, blob в IndexedDB `wiz_lab_mem_store`), где лежат `wiz_facts`, `wiz_l2_digests`, `wiz_notes_fts` и reference memory `wiz_ref_*`.
**Паспорт загружается в существующий слой `wiz_ref_*`** через существующий формат `wiz-ref-jsonl/1`: `export-lab`, затем в UI Память → «📖 Reference memory (wiz_ref)» → **Import JSONL**. Это ручной шаг, `index.html` не менялся, нового хранилища нет.

Почему не остальные слои:
- **EITI Memory (`memory`/`eiti_mem`)** авто-инъектирует 50 последних записей в system prompt как «реальные факты о пользователе». Это нарушает `STORED != CURRENT` и `PASSPORT → SOURCE MAP → DETAIL ON DEMAND`. Кроме того, импорт `eitiMemImportHandler` сохраняет только text/tag/source.
- **`wiz_facts`** не имеет полей status/source-document/relations, подвержен decay, а `mem_validate` может повысить запись до `Validated`.
- **`wiz_ref_*`** хранит source, status, provenance и relations, работает только по явному запросу (`ref_search`/`ref_source`/`ref_trace`) и не подставляется в чат. Оговорка: `REFERENCE_MEMORY.md` описывает wiz_ref как «не personal memory». Паспорт — ориентационный reference, а не набор фактов о пользователе, и эта оговорка сохраняется.

## Проекция seed → wiz-ref-jsonl/1 (что теряется)
| seed | wiz_ref |
|---|---|
| `source` alias (13) | `source` (surface/kind/authority_class; `SRC-USER-*` → `HUMAN_REFERENCE_ONLY`) |
| record | `item` `passport:<id>`; claim = `[TYPE · STATUS] statement`; `source_section` = `seed_type/id/details`; `source_status` = status **дословно** |
| type (кроме записей из `SRC-USER-*`, которые все становятся `HUMAN_LENS`): PROJECT_POINTER / SOURCE_POINTER / INVARIANT / OPEN_QUESTION / NEXT_ACTION / RESEARCH_RESULT(RESEARCH_RESULT) | PROJECT_ROLE / ROUTE / INVARIANT / OPEN_QUESTION / NEXT_ACTION / RESEARCH_RESULT |
| status ENGINEERING_RESULT | `VALIDATION_RESULT` |
| status HISTORICAL/SUPERSEDED (не pointer) | `HISTORICAL_NOTE` |
| USER_IDENTITY / USER_GOAL / USER_MOTIVATION / CURRENT_PRIORITY / ACTIVE_THREAD / KNOWN_LIMITATION / DEFERRED_ITEM | `UNKNOWN` (или `HUMAN_LENS` для источника HUMAN_REFERENCE_ONLY); **seed-тип остаётся только в claim-префиксе и `source_section`** |
| provenance USER_STATEMENT / USER_RAW / SOURCE_DOC / AI_SUMMARY | `epistemic_state` = USER_STATEMENT / USER_RAW / SOURCE_ASSERTION / AI_SUMMARY |
| rel SUPPORTS / USES_SOURCE | SUPPORTS / DOCUMENTED_IN |
| rel SUPERSEDED_BY | `supersedes_item_id` → importer создаёт SUPERSEDES и lifecycle=SUPERSEDED |
| rel MOTIVATED_BY / IMPLEMENTED_BY_PROJECT / INVESTIGATES / RELATED_TO / NEXT_ACTION / **DOES_NOT_ESTABLISH** | `RELATED_TO` + `rationale: seed_rel=<rel>` (**семантика теряется для поиска**; DOES_NOT_ESTABLISH виден только в rationale) |
| `scope`, `valid_from`, `updated_at`, `related_to`, `certainty`, `keywords` | `authority_scope`, `validity`, `as_of`; `related_to` → только текстом в `provenance`; `certainty` в seed не заполнен (`confidence`=null); `keywords` не экспортируются (только локальный `search`) |

`keywords` — расширение seed для детерминированного локального поиска, а не часть требуемой схемы.

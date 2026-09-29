# CURRENT ORIENTATION — Руслан / Velantrim

> Сгенерировано детерминированно из `docs/memory/ruslan-orientation-seed.json` (seed 2026-09-29.1, as of 2026-09-29) командой `node tools/memory/seed_tool.mjs render-start-view`. Не редактировать вручную.
> ORIENTATION, не архитектурный authority. Теги: `id · status · source`. STORE EVERYTHING != PUT EVERYTHING IN ACTIVE CONTEXT. PASSPORT → SOURCE MAP → DETAIL ON DEMAND.

## WHO
- Руслан — исследователь когнитивных систем (cognitive-systems researcher). `UID-01 · CURRENT · SRC-USER-2026-09-29`
- Изучает память человека, мышление, retrieval, контекст, понимание, перенос между ситуациями, графовые системы, SQLite, RAG/CAG и другие подходы к памяти и извлечению. `UID-02 · CURRENT · SRC-USER-2026-09-29`
- Изучает когницию людей, животных, птиц, рыб, насекомых, бактерий, растений, грибов; чувства, аффект, значимость; работы советских, российских, американских, европейских и азиатских учёных. `UID-03 · CURRENT · SRC-USER-2026-09-29`

## NORTH STAR
- Цель исследования: не копировать биологию буквально, а извлекать функциональные принципы, полезные для искусственной когнитивной системы. `UG-01 · CURRENT · SRC-USER-2026-09-29`
- Ближняя цель: реально работающий умный ассистент / Exo-Cortex, который помогает Руслану не терять нить, хранить исследования, понимать связи, видеть текущее/решённое/открытое, возвращаться после пауз и продолжать без ручной реконструкции. `UG-02 · CURRENT · SRC-USER-2026-09-29`
- Дальняя цель: инновационная система, полезная Руслану, разработчикам, исследователям и, возможно, для более крупных человеческих проблем. `UG-03 · CURRENT · SRC-USER-2026-09-29`
- Жизненный контекст: желание материальной стабильности и долгосрочной возможности заниматься этой работой. Это USER_MOTIVATION, НЕ системное требование. `UM-01 · CURRENT · SRC-USER-2026-09-29`

## CURRENT PRIORITY
- Текущая человеческая боль: потеря исследовательской нити между чатами, инструментами и документами. `UM-02 · CURRENT · SRC-USER-2026-09-29`
- Текущая практическая цель: одна точка входа для ориентации — этот паспорт. `CP-01 · CURRENT · SRC-USER-2026-09-29`
- Желаемый UX: свежая AI-сессия, фраза «Посмотри мой паспорт / память и скажи, где мы» → восстановить identity, цели, приоритеты, активную линию, решённое/открытое, источники и следующий bounded шаг без чтения сотен документов. `CP-02 · CURRENT · SRC-USER-2026-09-29`
- STORE EVERYTHING != PUT EVERYTHING IN ACTIVE CONTEXT. PASSPORT → SOURCE MAP → DETAIL ON DEMAND. `INV-06 · CURRENT · SRC-USER-2026-09-29`

## ACTIVE THREAD
- Карта исследования: EVENT/INFORMATION → STORE → RETRIEVE → INTERPRET → RELATE TO CURRENT CONTEXT → TRANSFER PRINCIPLE → ACT/DECIDE → REVISE/LEARN. `AT-01 · CURRENT · SRC-USER-2026-09-29`
- HAP-01 изучает прежде всего AVAILABLE RECORDED HISTORY → LATER BEHAVIOR (как доступная записанная история влияет на последующее поведение). `AT-HAP · CURRENT · SRC-USER-2026-09-29`
- HAP-01 НЕ устанавливает: качество retrieval, изменение весов, live authorship, личность, субъектность, сознание. `KL-HAP · CURRENT · SRC-USER-2026-09-29`
- HAP-01 не найден ни в одном прочитанном источнике (Notion/Drive, 2026-09-29): описание — только из заявления пользователя; owner, артефакт и статус эксперимента UNKNOWN. `KL-HAP-SRC · UNKNOWN · SRC-AI-ASSEMBLY-2026-09-29`
- Линии из источников, актуальность которых сегодня НЕ подтверждена (STORED != CURRENT):
  - По источнику (2026-09-27/28): приоритет программы — E0-B Issue #8 / provenance disposition; SIGNET-TRACE-01 = BLOCKED_AT_STEP_0_BY_SOURCE_GAP; Protocol v0.1 не валидирован и не фальсифицирован. Актуальность на сегодня не подтверждена. `AT-03 · UNKNOWN · SRC-N-RUSLAN-RESEARCH`
  - По источнику (2026-09-29): вопрос «цифровая личность / душа» разделён на три линии — continuity, agency / life-like autonomy, subjectivity; SUBJECT-POLE = UNRESOLVED; следующий этап там — Claim Registry → Source Audit → Model Cards v2. `AT-04 · UNKNOWN · SRC-N-RUSLAN-RESEARCH`

## KNOWN
- Simple Memory v0.1 (SQLite; без LLM, embeddings, vector/graph DB): SAVE → PROCESS CLOSE → FRESH PROCESS → RETRIEVE → RESUME. Synthetic smoke: MEMORY_SAVE=PASS, SELECTIVE_RETRIEVAL=PASS, RESUME_NEXT_STEP=PASS, HONEST_EMPTY=PASS. `RR-SM-01 · ENGINEERING_RESULT · SRC-D-SIMPLE-MEMORY-HANDOFF`
- На реальном материале (inventory 36 записей) показана цепочка: external SQLite memory → fresh bot/process → recovered context → coherent semantic synthesis. `RR-SM-02 · ENGINEERING_RESULT · SRC-D-SIMPLE-MEMORY-HANDOFF`
- В main Eiti-Wizard-Lab (2bad547) есть reference memory wiz_ref_* в SQLite (sql.js): JSONL-импорт wiz-ref-jsonl/1, явный поиск ref_search, статусы/источники/provenance сохраняются, без авто-инъекции в чат. IMPLEMENTED != ACTIVATED. `RR-LAB-01 · ENGINEERING_RESULT · SRC-GH-LAB-MAIN`
- FM-16: ranking ≠ qualification — CrossEncoder давал более сильный ranking signal, чем embedding baseline, но один глобальный порог не стал достаточным механизмом qualification; Honest Empty не доказан. `RR-FM16 · RESEARCH_RESULT · SRC-D-VISION`
- CONT-E0T (2026-09-13): CLAIM_B_SUPPORT = UNDERDETERMINED (все 4 пары BOTH_INADEQUATE); сырые run-артефакты не восстановлены (REPRODUCIBILITY_PACKAGE = NOT_SEALED). Не доказывает, что история не нужна. `RR-CONT · RESEARCH_RESULT · SRC-D-VISION`
- По checkpoint 2026-09-26 «установлено в своей области»: MEMORY ≠ TRUTH, RETRIEVAL ≠ EVIDENCE, MODEL_PROPOSAL ≠ USER_DECISION, GOOD CONTINUATION ≠ CORRECT STATE, GOOD HANDOFF ≠ LEARNING. `RR-METHOD · RESEARCH_RESULT · SRC-N-RUSLAN-RESEARCH`
- Для практической памяти НЕ доказано: blind free-form discovery без тематических заголовков, selective retrieval на большой базе, cross-machine/cross-device переносимость, learning/adaptation, понимание личности в сильном смысле. `KL-SM-03 · OPEN · SRC-D-SIMPLE-MEMORY-HANDOFF`

## OPEN
- Retrieval — отдельная проблема: что, когда и почему извлекать, и насколько это релевантно; HAP-01 её не решает (RETRIEVAL != UNDERSTANDING). `OQ-05 · OPEN · SRC-USER-2026-09-29`
- Какой минимальный внешний state нужен AI, чтобы новый контекст понимал не только «что было сказано», но и «куда мы идём и почему»? `OQ-01 · OPEN · SRC-D-VISION`
- Что минимально необходимо системе для устойчивой «ориентации», не превращая её в огромный prompt? `OQ-02 · OPEN · SRC-D-VISION`
- Кто и как решает, что новая информация достойна долговременного сохранения (admission)? `OQ-03 · OPEN · SRC-D-VISION`
- Какие способности человека и животных действительно полезно переносить как вычислительные принципы, а какие являются только метафорами? `OQ-04 · OPEN · SRC-D-VISION`
- Как по raw multi-turn dialogue восстанавливать текущую orientation без false pivot / missed pivot; как автоматически замечать смену цели? `OQ-06 · OPEN · SRC-N-RUSLAN-RESEARCH`
- Субъектность и сознание: SUBJECT-POLE = UNRESOLVED; consciousness / subjective experience = UNKNOWN; стабильная цифровая индивидуальность не валидирована. `OQ-07 · UNKNOWN · SRC-N-RUSLAN-RESEARCH`
- Как сохранять open option set / NOT_CHOSEN и исправлять ошибочное prior state, не храня ошибку бесконечно; как различать identity, текущее внимание, working state, долговременную память и historical self? `OQ-08 · OPEN · SRC-N-GENESIS`
- Honest Empty: как отличать отсутствие релевантной памяти от retrieval failure, ambiguity и отсутствия evidence (в Graphiti-линии HONEST_EMPTY = NOT_ESTABLISHED; в synthetic smoke Simple Memory — PASS, другой scope). `OQ-09 · OPEN · SRC-D-VISION`

## NEXT
- Старт сессии: прочитать CURRENT_ORIENTATION.md / паспорт → определить, относится ли разговор к существующей цели, новой гипотезе, evidence, эксперименту или open question → только затем открыть 1–2 источника из SOURCE MAP; для implementation — live GitHub. `NA-START · CURRENT · SRC-D-VISION`
- Конец сессии: не копировать чат; добавлять только то, что меняет цель/понимание, создаёт/уточняет гипотезу, добавляет evidence, закрывает/создаёт open question, меняет статус идеи или маршрут — с датой, источником и уровнем утверждения; историю не переписывать. `NA-END · CURRENT · SRC-D-VISION`
- Предложение (MODEL_PROPOSAL, не решение пользователя): вручную импортировать export-lab JSONL в Lab (Память → 📖 Reference memory → Import JSONL), затем в свежей сессии проверить «Посмотри мой паспорт и скажи, где мы» и записать наблюдённые провалы. `NA-01 · OPEN · SRC-AI-ASSEMBLY-2026-09-29`
- Отложено (не начинать без явного GO): `DF-01`, `DF-02`, `DF-03`, `DF-04`, `DF-05`, `DF-06` — см. seed.

## DETAILS (detail on demand)
- Смотреть за историей идеи: хроника «Ruslan Исследования» (Notion) — chronology, provenance, почему менялась позиция; НЕ текущая истина. `SP-N-RUSLAN-RESEARCH · CURRENT · SRC-N-RUSLAN-RESEARCH` — reachable: YES
- Смотреть за историей идеи цифровой личности: Genesis & Research Chronicle (Notion) — USER RAW vs AI-интерпретация, эволюция памяти, OPEN §20. `SP-N-GENESIS · CURRENT · SRC-N-GENESIS` — reachable: YES
- Зеркало хроники в Drive: MASTER CHRONOLOGY (карта реконструкции истории идеи); сверять с Notion — не идентичны. `SP-D-RUSLAN-RESEARCH · CURRENT · SRC-D-RUSLAN-RESEARCH` — reachable: YES
- Навигация по проектам: Knowledge Atlas (PROJECT → ROLE → OWNER SOURCE → WHEN TO USE); не authority. `SP-N-ATLAS · CURRENT · SRC-N-ATLAS` — reachable: YES (сохранён только EXCERPT: ответ пришёл inline)
- Vision Journal (Notion): founder intent, открытые вопросы, AI START/END RULE, запись 2026-09-29. `SP-N-VISION · CURRENT · SRC-N-VISION` — reachable: YES
- Vision Journal (Drive): главный источник для паспорта — исходная мысль, цели, open questions, journal entries 11–21. `SP-D-VISION · CURRENT · SRC-D-VISION` — reachable: YES
- Смотреть за текущей исследовательской архитектурой: Unified Cognitive System Architecture — Working Master (Drive); статусы STABLE CORE / WORKING SYNTHESIS / OPEN RESEARCH / HISTORICAL; не Canon, не runtime. `SP-D-WORKING-MASTER · CURRENT · SRC-D-WORKING-MASTER` — reachable: YES
- Смотреть за методологией и текущей исследовательской программой: Cognitive System Research Program (Drive); CURRENT MODEL ≠ FINAL MODEL. `SP-D-RESEARCH-PROGRAM · CURRENT · SRC-D-RESEARCH-PROGRAM` — reachable: YES
- Simple Memory Handoff (Drive): что сделано с практической памятью; implementation donor, не authority. `SP-D-SIMPLE-MEMORY · CURRENT · SRC-D-SIMPLE-MEMORY-HANDOFF` — reachable: YES
- Код Simple Memory v0.1: Eiti-Wizard-Lab, ветка experiment/simple-memory-resume-v0.1 @7fbabd2 (не влита в main). `SP-GH-SIMPLE-MEMORY · CURRENT · SRC-GH-LAB-SIMPLE-MEMORY` — reachable: YES (git fetch 2026-09-29)
- Eiti-Wizard-Lab main: Lab memory (SQLite + wiz_ref), docs/REFERENCE_MEMORY.md, этот паспорт (docs/memory/). `SP-GH-LAB-MAIN · CURRENT · SRC-GH-LAB-MAIN` — reachable: YES
- Проекты: 💠 Crystal (`PP-CRYSTAL`) · 🗿 Titan (`PP-TITAN`) · 🧬 Native Kernel (`PP-NATIVE`) · 🌀 Mentaury Soul (`PP-SOUL`) · 🪁 Mentaury-Kernel (`PP-MKERNEL`) · 🌎 Continuum (`PP-CONTINUUM`) · 🚀 Cognitive OS (`PP-COGOS`) · ⚗️ CLOS (`PP-CLOS`) · 🕸 Graphiti Fractal / Lab (`PP-GRAPHITI`) · 🧭 Atlas (`PP-ATLAS`) · 🔬 State Validation Lab (`PP-SVL`) · 🧪 Eiti-Wizard-Lab (`PP-LAB`) — роли в паспорте §10 / seed.
- Правила чтения (verbatim): RETRIEVAL != UNDERSTANDING; RETRIEVAL != EVIDENCE; EVIDENCE != BELIEF; BELIEF != TRUTH; STORED != CURRENT; CURRENT != IMPORTANT; IMPORTANT != TRUE; HISTORICAL != CURRENT; MODEL_PROPOSAL != USER_DECISION; AI SUMMARY != USER RAW; UNKNOWN != FALSE; NOT RETRIEVED != ABSENT; RESEARCH != RUNTIME; SPEC != IMPLEMENTATION; IMPLEMENTED != ACTIVATED; TESTED != PRODUCTION AUTHORIZED

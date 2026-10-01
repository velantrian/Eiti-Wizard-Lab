# 🧭 RUSLAN ORIENTATION PASSPORT / MEMORY SEED

> **Что это:** единая точка входа для ОРИЕНТАЦИИ, а не архитектурный authority, не Canon и не runtime-спецификация.
> **По состоянию на:** 2026-09-29 · seed `docs/memory/ruslan-orientation-seed.json` (`2026-09-29.1`, 79 записей).
> **Принцип:** STORE EVERYTHING != PUT EVERYTHING IN ACTIVE CONTEXT. **PASSPORT → SOURCE MAP → DETAIL ON DEMAND.**
> **Формат тегов:** `[id · STATUS · источник]`. Строки без тега взяты из текущего заявления Руслана от 2026-09-29 (`SRC-USER-2026-09-29`, статус CURRENT). Источники указаны алиасами (см. `SOURCE_REGISTRY.md`). Точные ссылки на Notion/Drive не коммитятся, потому что репозиторий публичный.
> **Короткая стартовая выжимка:** `CURRENT_ORIENTATION.md`. Она генерируется из seed командой `node tools/memory/seed_tool.mjs render-start-view --out`.

## 1. КТО Я
- Руслан — исследователь когнитивных систем.
- Изучаю память человека, мышление, retrieval, контекст, понимание, перенос между ситуациями, графовые системы, SQLite, RAG/CAG и другие подходы к памяти и извлечению.
- Изучаю когницию людей, животных, птиц, рыб, насекомых, бактерий, растений и грибов, а также чувства, аффект и значимость. Опираюсь на работы советских, российских, американских, европейских и азиатских учёных.
- Рабочий стиль (по handoff): русский язык, структурированные ответы, маленькие bounded-шаги, без раздувания задачи, без перехода к коду, пока идёт обсуждение `[UID-04 · HISTORICAL · SRC-D-SIMPLE-MEMORY-HANDOFF]`.

## 2. ЧЕГО Я ХОЧУ
- **Принцип исследования:** не копировать биологию буквально, а извлекать функциональные принципы, полезные для искусственной когнитивной системы.
- **Ближняя цель:** реально работающий умный ассистент / Exo-Cortex. Он помогает не терять нить, хранить исследования, понимать связи, видеть текущее, решённое и открытое, возвращаться после пауз и продолжать без ручной реконструкции.
- **Дальняя цель:** инновационная система, полезная мне, разработчикам и исследователям, а возможно и для более крупных человеческих проблем.
- История формулировок (не текущая позиция): North Star хроники «долгоживущий Exo-Cortex / cognitive companion» `[UG-04 · HISTORICAL · SRC-D-RUSLAN-RESEARCH]`; «цифровая копия / ~10 000 диалогов» `[UG-06 · HISTORICAL · SRC-N-GENESIS]`; «Graph = Truth · LLM = Language · Memory = Physiology» `[HIST-01 · SUPERSEDED · SRC-N-GENESIS]` → граф как stored claim/state с provenance, scope, time и authority `[HIST-02 · HISTORICAL · SRC-N-GENESIS]`.

## 3. ЗАЧЕМ Я ЭТО ДЕЛАЮ
- **USER_MOTIVATION (не системное требование):** желание материальной стабильности и долгосрочной возможности заниматься этой работой `[UM-01]`.
- **Текущая человеческая боль:** теряется исследовательская нить между чатами, инструментами и документами `[UM-02]`. Та же боль записана в хронике `[UM-03 · HISTORICAL · SRC-D-RUSLAN-RESEARCH]`.
- Исходная мысль «зачем Velantrim»: развивающаяся цифровая индивидуальность, у которой прошлый опыт обоснованно меняет будущую когнитивную жизнь; не «помнить всё» `[UG-05 · HISTORICAL · SRC-D-VISION]`.
- Одной LLM мало: нужен отдельный устойчивый слой памяти, связей, состояния и происхождения информации `[UG-07 · HISTORICAL · USER_RAW · SRC-N-GENESIS]`.

## 4. ТЕКУЩИЕ ПРИОРИТЕТЫ
1. **Одна точка входа для ориентации**, то есть этот паспорт `[CP-01]`.
2. **Желаемый UX:** новая AI-сессия, я говорю «Посмотри мой паспорт / память и скажи, где мы». AI восстанавливает identity, цели, приоритеты, активную линию, решённое и открытое, источники и следующий bounded шаг, не читая сотни документов `[CP-02]`.

## 5. ТЕКУЩАЯ КАРТА ИССЛЕДОВАНИЯ
`EVENT/INFORMATION → STORE → RETRIEVE → INTERPRET → RELATE TO CURRENT CONTEXT → TRANSFER PRINCIPLE → ACT/DECIDE → REVISE/LEARN` `[AT-01]`
- **HAP-01** изучает прежде всего звено AVAILABLE RECORDED HISTORY → LATER BEHAVIOR `[AT-HAP]`. Он **НЕ** устанавливает качество retrieval, изменение весов, live authorship, личность, субъектность или сознание `[KL-HAP]`.
- **Retrieval — отдельная проблема** (что, когда и почему извлекать) `[OQ-05 · OPEN]`.
- ⚠️ HAP-01 не найден ни в одном прочитанном источнике. Описание взято только из заявления пользователя; owner и артефакт неизвестны `[KL-HAP-SRC · UNKNOWN · SRC-AI-ASSEMBLY]`.

## 6. ЧТО УЖЕ ИЗВЕСТНО / УСТАНОВЛЕНО (в своём scope)
- **Практическая память v0.1** (SQLite, без LLM, embeddings и vector/graph DB): цепочка SAVE → закрытие процесса → новый процесс → RETRIEVE → RESUME. Synthetic smoke: MEMORY_SAVE, SELECTIVE_RETRIEVAL, RESUME_NEXT_STEP и HONEST_EMPTY = PASS `[RR-SM-01 · ENGINEERING_RESULT · SRC-D-SIMPLE-MEMORY-HANDOFF]`.
- На реальных 36 записях показана цепочка external memory → fresh bot → recovered context → coherent synthesis `[RR-SM-02 · ENGINEERING_RESULT · SRC-D-SIMPLE-MEMORY-HANDOFF]`.
- В main Lab есть reference memory `wiz_ref_*` (SQLite/sql.js): JSONL-импорт и явный поиск без авто-инъекции. IMPLEMENTED != ACTIVATED `[RR-LAB-01 · ENGINEERING_RESULT · SRC-GH-LAB-MAIN]`.
- FM-16: ranking ≠ qualification; один глобальный порог недостаточен `[RR-FM16 · RESEARCH_RESULT · SRC-D-VISION]`.
- CONT-E0T: CLAIM_B_SUPPORT = UNDERDETERMINED, пакет не запечатан `[RR-CONT · RESEARCH_RESULT · SRC-D-VISION]`.
- Методические различения по checkpoint 2026-09-26 `[RR-METHOD · RESEARCH_RESULT · SRC-N-RUSLAN-RESEARCH]`.
- **Правила не-смешения (текущие, дословно):** RETRIEVAL != UNDERSTANDING; RETRIEVAL != EVIDENCE; EVIDENCE != BELIEF; BELIEF != TRUTH; STORED != CURRENT; CURRENT != IMPORTANT; IMPORTANT != TRUE; HISTORICAL != CURRENT; MODEL_PROPOSAL != USER_DECISION; AI SUMMARY != USER RAW; UNKNOWN != FALSE; NOT RETRIEVED != ABSENT; RESEARCH != RUNTIME; SPEC != IMPLEMENTATION; IMPLEMENTED != ACTIVATED; TESTED != PRODUCTION AUTHORIZED `[INV-01..04]`. Никогда не превращать AI-текст в убеждение пользователя, AI-рекомендацию в решение, историческое в текущее, гипотезу в факт, наличие документа в evidence, извлечённый текст в истину. При конфликте с более новым заявлением пользователя историю сохранять, а текущее помечать отдельно `[INV-05]`.

## 7. ЧТО ОСТАЁТСЯ ОТКРЫТЫМ / НЕИЗВЕСТНЫМ
- Какой минимальный внешний state нужен AI, чтобы понимать «куда мы идём и почему» `[OQ-01 · OPEN · SRC-D-VISION]`. Что минимально нужно для устойчивой ориентации без огромного prompt `[OQ-02 · OPEN · SRC-D-VISION]`.
- Кто решает, что достойно долговременного сохранения (admission) `[OQ-03 · OPEN · SRC-D-VISION]`.
- Какие способности живых систем переносимы как вычислительные принципы, а какие остаются метафорами `[OQ-04 · OPEN · SRC-D-VISION]`.
- Как восстанавливать orientation из сырого диалога без false/missed pivot `[OQ-06 · OPEN · SRC-N-RUSLAN-RESEARCH]`. Как хранить NOT_CHOSEN и исправлять ошибочное prior state `[OQ-08 · OPEN · SRC-N-GENESIS]`.
- Honest Empty: отсутствие памяти vs retrieval failure `[OQ-09 · OPEN · SRC-D-VISION]`.
- Субъектность и сознание: SUBJECT-POLE = UNRESOLVED, сознание = UNKNOWN `[OQ-07 · UNKNOWN · SRC-N-RUSLAN-RESEARCH]`.
- Для практической памяти **не доказано**: blind free-form discovery, работа на большой базе, cross-device, learning, понимание личности `[KL-SM-03 · OPEN · SRC-D-SIMPLE-MEMORY-HANDOFF]`.

## 8. АКТИВНЫЕ ЛИНИИ
- **Паспорт / точка входа** (эта работа) `[CP-01]`; **HAP-01** в границах из §5 `[AT-HAP]`; **retrieval** как отдельная проблема `[OQ-05]`.
- По источникам, актуальность на сегодня **не подтверждена**: E0-B Issue #8 / provenance disposition, SIGNET-TRACE-01 BLOCKED `[AT-03 · UNKNOWN · SRC-N-RUSLAN-RESEARCH]`; разделение «цифровой личности» на continuity / agency / subjectivity `[AT-04 · UNKNOWN · SRC-N-RUSLAN-RESEARCH]`.
- На 2026-09-18 главной линией была практическая память (TRACK A) `[AT-02 · HISTORICAL · SRC-D-SIMPLE-MEMORY-HANDOFF]`.

## 9. ОТЛОЖЕНО / НЕ АКТИВНО
TCE carry-forward/beacon-shift не запускать без отдельного GO; выводы TCE здесь не цитируются `[DF-01]`. FM-17-pre ablation NOT_EXECUTED `[DF-02]`. Mentaury Soul B0/B1/C1 v0.1 = HISTORICAL_UNEXECUTED `[DF-03]`. SEM-REV (TRACK B) `[DF-04]`. Широкий literature sweep и новая top-level архитектура `[DF-05]`. PAL-CONTAM-01 NOT AUTHORIZED `[DF-06]`. Все пункты DEFERRED.

## 10. КАРТА ПРОЕКТОВ (роль → релевантность сейчас)
| Проект | Роль (по источнику) | Сейчас | Тег |
|---|---|---|---|
| 🧪 Eiti-Wizard-Lab | песочница: Simple Memory (ветка), wiz_ref (main), паспорт | **высокая** | `[PP-LAB · SRC-GH-LAB-MAIN]` |
| 🌎 Continuum | continuity между потерянными контекстами, resume/reopen | ближайший исследовательский owner вопроса «где мы» | `[PP-CONTINUUM · SRC-N-ATLAS]` |
| 🧭 Atlas | навигация, не authority | основа SOURCE MAP | `[PP-ATLAS · SRC-N-ATLAS]` |
| 🕸 Graphiti Fractal | graph memory / retrieval relevance (FM-13→17-pre) | retrieval-линия | `[PP-GRAPHITI · SRC-D-VISION]` |
| 🪁 Mentaury-Kernel | cross-domain composition, provenance; хранит хронику | хранилище хроники | `[PP-MKERNEL · SRC-N-ATLAS]` |
| 🌀 Mentaury Soul | self / identity / goals / values | линия личности, не приоритет | `[PP-SOUL · SRC-N-ATLAS]` |
| 💠 Crystal | evidence, provenance, admission, trusted state | косвенная | `[PP-CRYSTAL · SRC-N-ATLAS]` |
| 🗿 Titan | orchestration, retrieval composition | не активен | `[PP-TITAN · SRC-N-ATLAS]` |
| 🧬 Native Kernel | technology-neutral семантические инварианты | не активен | `[PP-NATIVE · SRC-N-ATLAS]` |
| 🚀 Cognitive OS | routing / model / tool profile (в Atlas: «AI Architecture» под Titan) | не активен | `[PP-COGOS · SRC-D-VISION]` |
| ⚗️ CLOS | research blueprint / methodology (IR-01) | не активен | `[PP-CLOS · SRC-D-SIMPLE-MEMORY-HANDOFF]` |
| 🔬 State Validation Lab | bounded validation contracts, relation-integrity | не активен | `[PP-SVL · SRC-N-RUSLAN-RESEARCH]` |
Все роли имеют статус CURRENT как навигация. Роль ≠ реализация, а «не активен» означает только то, что проект не участвует в этом шаге.

## 11. КАРТА ИСТОЧНИКОВ (куда смотреть, детали по запросу)
- **История идеи:** `SRC-N-GENESIS` (USER RAW vs AI), `SRC-N-RUSLAN-RESEARCH` (хроника, новейшее сверху), `SRC-D-RUSLAN-RESEARCH` (MASTER CHRONOLOGY; не идентичен Notion). Это НЕ текущая истина.
- **Текущая исследовательская архитектура:** `SRC-D-WORKING-MASTER` (только статусы зрелости; не Canon), `SRC-D-RESEARCH-PROGRAM` (метод; CURRENT MODEL ≠ FINAL MODEL).
- **Намерение, открытые вопросы, правила сессий:** `SRC-D-VISION` (главный), `SRC-N-VISION`. Нумерация записей в них расходится.
- **Проекты:** `SRC-N-ATLAS`. **Практическая память:** `SRC-D-SIMPLE-MEMORY-HANDOFF` (donor, не authority), `SRC-GH-LAB-SIMPLE-MEMORY`. **Состояние Lab:** `SRC-GH-LAB-MAIN`. Для implementation смотреть live GitHub, а не память.

## 12. КАК НАЧИНАТЬ НОВУЮ AI-СЕССИЮ
1. Прочитать `CURRENT_ORIENTATION.md`, затем при необходимости этот паспорт.
2. Определить, к чему относится разговор: существующая цель, новая гипотеза, evidence, эксперимент или open question `[NA-START · CURRENT · SRC-D-VISION]`.
3. Только затем открыть 1–2 источника из §11. Для кода смотреть live GitHub.
4. Отвечать с разделением CURRENT / HISTORICAL / OPEN / UNKNOWN. Не выдавать retrieved за истину и не выдавать свои предложения за мои решения.

## 13. КАК ЗАКАНЧИВАТЬ СЕССИЮ
Чат не копировать. Добавлять только то, что меняет цель или понимание, создаёт или уточняет гипотезу, добавляет evidence, закрывает или создаёт open question, меняет статус идеи или маршрут. Каждую запись указывать с датой, источником и уровнем утверждения. Историю не переписывать: заменённое помечать SUPERSEDED `[NA-END · CURRENT · SRC-D-VISION]`. Изменения вносить в seed JSON → `validate` → `render-start-view --out`.

---
**Загрузка в Lab (ручной шаг):** `node tools/memory/seed_tool.mjs export-lab --out private-memory/ruslan-orientation-seed.private.jsonl`, затем в Lab: Память → «📖 Reference memory (wiz_ref)» → Import JSONL. Загружается в существующий слой `wiz_ref_*`, в чат автоматически не подставляется. Подробнее в `docs/memory/README.md`.

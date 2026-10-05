# Ruslan Experimental Continuity Memory v0.1

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

OWNER_ASSERTED != MODEL_SUMMARY
OWNER_ASSERTED != OBSERVED_FROM_PROJECT_SOURCE
MODEL_SUMMARY != OWNER_FACT
MODEL_DERIVED_HYPOTHESIS != OWNER_ASSERTED
UNKNOWN != FALSE
NOT_RECORDED != ABSENT
SUPERSEDED != DELETED

STRUCTURED_RESUME_TEST=PASS
CROSS_SESSION_AI_RESUME_TEST=NOT_RUN
SESSION_A_COMPLETED=YES

## Назначение

Экспериментальная непрерывность для новой ИИ-сессии: что в работе сейчас, что уже сделано, какие решения приняты, где остановились, какой следующий ограниченный шаг.

Это **не** официальная память, **не** Canon, **не** ledger, **не** wiz_ref и **не** Owner Authority / PDP.

## Границы

- Живёт **только** в `experiments/ruslan-experimental-memory/`.
- Отдельно от `experiments/owner-authority-sandbox/` — не смешивать.
- Не трогать `docs/memory/`, Canon, seed, ledger, паспорт, `CURRENT_ORIENTATION.md`, `wiz_ref`.
- Черновик PR only. Не merge. Не ready-for-review.
- Нет graph / vector DB / RAG / SQLite / auto-ingestion / реальных grants / Canon Apply.
- Только проектная непрерывность. Без биографии, здоровья, финансов, credentials, частных предпочтений.

## Как читать (новая сессия)

1. Прочитать этот README (метки эксперимента).
2. Прочитать `RUSLAN_EXPERIMENTAL_MEMORY.md` (KEY=VALUE + секции).
3. Прочитать последний файл в `checkpoints/`.
4. Не читать официальную память и не заходить в Owner Authority sandbox для этой нити.
5. Следующий шаг — только `NEXT_BOUNDED_ACTION`.
6. `CROSS_SESSION_TEST_PLAN.md` — различие тестов + план Session A/B.
7. Session B: только `tests/results/cross-session-v01/SESSION_B_PROMPT.md` (Q1–Q10); без prior chat.

## Provenance

Каждая фактическая строка в карте памяти помечена **ровно** одним из:

- `OWNER_ASSERTED` — Ruslan явно сказал / решил / авторизовал.
- `OBSERVED_FROM_PROJECT_SOURCE` — напрямую проверено по GitHub / Notion / Drive / test evidence.
- `MODEL_SUMMARY` — сводка агента по проверенному или обсуждённому состоянию; это не факт владельца.
- `MODEL_DERIVED_HYPOTHESIS` — вывод модели; не утверждение владельца.
- `UNKNOWN` — неизвестно; не равно «ложь».
- `NOT_RECORDED` — не записано; не равно «отсутствует в мире».

Нельзя превращать формулировку модели в `OWNER_ASSERTED`.
Типично **не** `OWNER_ASSERTED` (если Ruslan не сказал ту же фразу дословно): `CURRENT_STATUS`, `CURRENT_BLOCKER`, техническое состояние PR, счётчики тестов, branch/head, производные сводки проекта → `OBSERVED_FROM_PROJECT_SOURCE` или `MODEL_SUMMARY`.

Для важных технических строк опционально: `SOURCE_CLASS=` / `SOURCE_REF=` / `OBSERVED_AT=`.

`SUPERSEDED` заменяет предыдущую запись; это не удаление истории.

## Тесты

STRUCTURED_RESUME_TEST = детерминированный парсер KEY=VALUE; LLM не вызывается; статус PASS.

CROSS_SESSION_AI_RESUME_TEST = живой ИИ в **новой** сессии отвечает Q1–Q10 только из этой папки; без prior chat; статус NOT_RUN (Session A completed, Session B not run).

Это **не** один и тот же тест.

```bash
node --test experiments/ruslan-experimental-memory/tests/**/*.mjs
```

Ожидается код выхода 0 (PASS) для STRUCTURED_RESUME_TEST.

## Статус v0.1

Черновик PR #28 OPEN/DRAFT. Session A CROSS_SESSION handoff записан. Session B не выполнялась этим агентом.
NEXT: Session B отвечает Q1–Q10, затем OWNER REVIEW of comparison.
Нет v0.2, нет интеграции в Canon, нет RAG.

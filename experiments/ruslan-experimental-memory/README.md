# Ruslan Experimental Continuity Memory v0.1

EXPERIMENTAL_ONLY=YES
AUTHORITATIVE=NO
CANON=NO
OFFICIAL_MEMORY=NO

OWNER_ASSERTED != MODEL_SUMMARY
MODEL_SUMMARY != OWNER_FACT
MODEL_DERIVED_HYPOTHESIS != OWNER_ASSERTED
UNKNOWN != FALSE
NOT_RECORDED != ABSENT
SUPERSEDED != DELETED

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

## Provenance

Каждая фактическая строка в карте памяти помечена одним из:

- `OWNER_ASSERTED` — владелец явно сказал / дал GO.
- `MODEL_SUMMARY` — сводка агента по инженерному состоянию; это не факт владельца.
- `MODEL_DERIVED_HYPOTHESIS` — вывод модели; не утверждение владельца.
- `UNKNOWN` — неизвестно; не равно «ложь».
- `NOT_RECORDED` — не записано; не равно «отсутствует в мире».

`SUPERSEDED` заменяет предыдущую запись; это не удаление истории.

## Тест Clean Resume

Детерминированный разбор KEY=VALUE / секций. LLM не вызывается.

```bash
node --test experiments/ruslan-experimental-memory/tests/**/*.mjs
```

Ожидается код выхода 0 (PASS).

## Статус v0.1

Создание экспериментальной памяти, Clean Resume Test, draft PR, затем STOP на OWNER REVIEW.
Нет v0.2, нет интеграции в Canon, нет RAG.

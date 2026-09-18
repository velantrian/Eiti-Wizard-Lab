# 🧠 Simple Memory / Resume Sandbox v0.1

Минимальная **внешняя** память на SQLite для диалога.

**Не** SEM-REV · **не** архитектура Velantrim · **не** graph/embeddings/LLM API.

## Идея

```text
сохранить текст → закрыть процесс → новый процесс → найти релевантное → ответить
```

Chat history **не** нужна. Память = файл SQLite.

## Требования

- Python 3.10+
- stdlib only (`sqlite3`)

## Быстрый старт

```bash
cd /path/to/Eiti-Wizard-Lab
export PYTHONPATH=.
export SIMPLE_MEMORY_DB=./simple_memory_v01/data/demo.sqlite3

python3 -m simple_memory_v01.cli init
```

### Remember (оригинальный текст пользователя)

```bash
python3 -m simple_memory_v01.cli remember --type bio --text "..."
python3 -m simple_memory_v01.cli remember --type thought --text "..."
python3 -m simple_memory_v01.cli remember --type work_state --text "..."
```

Types: `bio` | `thought` | `work_state` | `note`

### Recall (с debug)

```bash
python3 -m simple_memory_v01.cli recall "Что я рассказывал о своей биографии?"
python3 -m simple_memory_v01.cli recall "О чём я говорил в своих мыслях о памяти?"
python3 -m simple_memory_v01.cli recall "Чем я занимался?"
python3 -m simple_memory_v01.cli latest-work
```

Debug показывает:

- `MEMORY QUERY`
- `RETRIEVED MEMORY IDS`
- `RETRIEVED COUNT`
- content (или `NO_RELEVANT_MEMORY`)

### List

```bash
python3 -m simple_memory_v01.cli list
python3 -m simple_memory_v01.cli list --type thought
```

## Demo script

```bash
bash simple_memory_v01/demo_manual.sh
```

Каждый вызов CLI — **новый OS process**.

## Smoke tests (A–E)

```bash
PYTHONPATH=. python3 -m unittest simple_memory_v01.tests.test_persistence_smoke -v
```

Тесты запускают CLI в отдельных subprocess — без Python globals между session A/B.

## Схема

Таблица `memory_items`:

| field | meaning |
|-------|---------|
| memory_id | `mem:…` |
| memory_type | bio / thought / work_state / note |
| title | короткий заголовок |
| content | **оригинальный** текст |
| created_at | UTC |
| session_id | метка сессии |

Опционально FTS5 (если доступен в вашей сборке SQLite).

## Default DB path

`simple_memory_v01/data/simple_memory.sqlite3`

Переопределение: `--db` или `SIMPLE_MEMORY_DB`.

## Границы v0.1

Нет: graph, embeddings, vector DB, LLM API, SEM-REV, Continuum, Crystal.

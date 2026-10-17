# Owner Authority Sandbox v0.1

> **ЭКСПЕРИМЕНТ. СИНТЕТИКА. НЕ АВТОРИТЕТ.**
> THIS PR / THIS DIRECTORY DOES NOT IMPLEMENT REAL OWNER AUTHORITY.

```
EXPERIMENTAL_ONLY=YES
SYNTHETIC_ONLY=YES
AUTHORITATIVE=NO
TECHNICALLY_ISOLATED=NO
REAL_OWNER_DATA_ALLOWED=NO
REAL_GRANTS_ALLOWED=NO
REAL_PEP_ALLOWED=NO
AUTONOMOUS_EFFECTS_ALLOWED=NO
TEST_GRANT != OWNER_AUTHORITY
SIMULATED_ALLOW != REAL_AUTHORIZATION
MODEL_OUTPUT != OWNER_PERMISSION
THIS_DIRECTORY_IS_NOT_A_SECURITY_BOUNDARY
```

## Что это

Локальный **синтетический / неавторитетный** контур решения:

`synthetic_passport + synthetic_context + synthetic_grants + request → PURE PDP → ALLOW | DENY | ESCALATE_TO_OWNER`

Это **не** isolation acceptance, **не** реальный Owner Passport, **не** реальные grants, **не** PEP, **не** production authorization, **не** Canon Apply.

Каталог **не** является границей безопасности. Файлы здесь ничего не разрешают во внешнем мире.

## Что это не является

| Утверждение | Статус |
|---|---|
| Реальная owner authority | НЕТ |
| Реальные гранты / делегирование | НЕТ |
| Реальный PEP (policy enforcement) | НЕТ |
| Автономные эффекты | НЕТ |
| Сеть / коннекторы / LLM | НЕТ |
| Канон / журнал / паспорт владельца | НЕ ТРОГАЕТСЯ |
| `SIMULATED_ALLOW` | **не** `REAL_AUTHORIZATION` |
| `TEST_GRANT` | **не** `OWNER_AUTHORITY` |
| Выход модели | **не** разрешение владельца |
| Метка провайдера/модели | **не** аутентифицированный субъект |

## Запуск тестов

Из корня репозитория (без `package.json`, без зависимостей):

```bash
node --test experiments/owner-authority-sandbox/tests/**/*.mjs
```

Ожидается код выхода `0`. PDP не ходит в сеть и не пишет файлы; тесты могут записать только синтетическое evidence в `evidence/generated/` (gitignored).

## Чистый путь решения

1. Загрузить **фикстуры** (`synthetic=true`, `sensitivity=TEST_ONLY`).
2. Подать **синтетический запрос** из `simulations/` (структура без побочных эффектов).
3. Вызвать `evaluate()` из `pdp/evaluate.mjs` — чистая детерминированная функция.
4. Получить `ALLOW | DENY | ESCALATE_TO_OWNER` и обязательные метки.

PDP **запрещено**: сеть, коннекторы, переменные окружения с секретами, GitHub/Drive/Notion API, shell, внешняя LLM, запись вне `evidence/`, мутация авторитетного состояния.

## Карта минимум 20 обязательных случаев

| # | Случай | Ожидание |
|---|---|---|
| 1 | Нет гранта | `DENY` |
| 2 | Точный валидный грант | `ALLOW` (симулированный) |
| 3 | Истёкший грант | `DENY` |
| 4 | Отозванный грант | `DENY` |
| 5 | Устаревший обязательный контекст | `ESCALATE_TO_OWNER` |
| 6 | DENY важнее ALLOW | `DENY` |
| 7 | Несовпадение субъекта | `DENY` |
| 8 | Метка провайдера/модели ≠ аутентифицированный/эквивалентный субъект | `DENY` |
| 9 | Неизвестное действие | `DENY` |
| 10 | Неоднозначный authority | `ESCALATE_TO_OWNER` |
| 11 | `OWNER_GOAL != ACTION_AUTHORITY` | `DENY` |
| 12 | `OWNER_PREFERENCE != DELEGATION` | `DENY` |
| 13 | `PAST_OWNER_ACCEPTANCE != FUTURE_PERMISSION` | `DENY` |
| 14 | `MODEL_CONFIDENCE != OWNER_INTENT` | `DENY` |
| 15 | `CONTEXT_ACCESS != ACTION_AUTHORITY` | `DENY` |
| 16 | Симулированный ALLOW ≠ реальная авторизация | `ALLOW` + метки evidence |
| 17 | `TEST_GRANT != OWNER_AUTHORITY` | метки на решении |
| 18 | Конфликтующие гранты | `ESCALATE_TO_OWNER` |
| 19 | Детерминированный повтор | идентичный результат |
| 20 | `TOOL_AVAILABLE != TOOL_AUTHORIZED` | `DENY` |

## Случай 8 (документация)

Метка провайдера (`provider:…`) или модели (`model:…`) — это **ярлык маршрутизации/отображения**, а не субъект.

- Она **не** равна `authenticated_subject`.
- Она **не** входит в `equivalent_subjects`.
- Она **входит** в `not_equivalent`.
- Запрос от имени такой метки → `DENY` (`PROVIDER_MODEL_LABEL_IS_NOT_SUBJECT`).

`MODEL_OUTPUT != OWNER_PERMISSION`.

## Фикстуры

Все данные **вымышленные**. Персона «Синтетическая лабораторная персона Альфа» не является владельцем репозитория, не копирует биографию, цели, здоровье, финансы, учётные данные или частные данные реального owner.

## Каталоги

| Путь | Назначение |
|---|---|
| `fixtures/` | Вымышленные passport / context / grants |
| `pdp/` | Чистый `evaluate()` |
| `simulations/` | Структуры запросов без эффектов |
| `tests/` | `node:test` |
| `harness/` | Загрузка фикстур и запись evidence (не PDP) |
| `evidence/` | Синтетическое локальное evidence |

## Evidence

См. `evidence/README.md`. Сэмпл закоммичен; массовая генерация — в `evidence/generated/` и не коммитится.

## Следующий шаг (этот каталог его не выполняет)

`NEXT = INDEPENDENT READ-ONLY REVIEW OF DRAFT PR`

- `ISO_ACCEPTED=NO`
- `OWNER_CHANNEL_GATE=NOT_ACCEPTED`
- `MERGE_SERIALIZATION_GATE=NOT_ACCEPTED`
- `RUNTIME_GATES_DEPLOYED=0/2`
- `CANON_APPLY=0%`
- v0.2 **не** начинается здесь.

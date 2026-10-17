# SCOPE — Owner Authority Sandbox v0.1

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

**THIS DIRECTORY DOES NOT IMPLEMENT REAL OWNER AUTHORITY.**

## В scope (только этот каталог)

- Синтетический паспорт (`fixtures/synthetic_passport.json`)
- Синтетический контекст (`fixtures/synthetic_context.json`)
- Синтетические гранты (`fixtures/synthetic_grants.json`)
- Чистый детерминированный PDP (`pdp/`)
- Структуры запросов/действий без побочных эффектов (`simulations/`)
- Детерминированные тесты `node:test` (`tests/`)
- Локальное синтетическое evidence (`evidence/`)

Путь: `passport + context + grants + request → PDP → ALLOW | DENY | ESCALATE_TO_OWNER`.

## Вне scope (запрещено в v0.1)

- Isolation acceptance / ISO
- Реальная owner authority, реальные гранты, реальный PEP
- Canon Apply, мутация канона, манифеста, журнала, `CURRENT_ORIENTATION`, `SOURCE_REGISTRY`, `ruslan-orientation-seed.json`
- wiz_ref/runtime, Notion, Drive, GitHub API, сетевые коннекторы
- Учётные данные из env, внешняя LLM, shell-эффекты
- Автономные действия, merge, auto-merge, ready-for-review как «принятие»
- Копирование реальных биографии/предпочтений/целей/здоровья/финансов owner
- Любые файлы вне `experiments/owner-authority-sandbox/`

## Правило данных

| Поле | Обязательное значение |
|---|---|
| `synthetic` | `true` |
| `sensitivity` | `TEST_ONLY` |
| `authoritative` | `false` |
| Реальные owner-данные | запрещены |
| Реальные гранты | запрещены |

Несинтетический вход PDP отклоняет fail-closed (`DENY`, `NON_SYNTHETIC_INPUT_REFUSED`).

## Граница (её нет)

`TECHNICALLY_ISOLATED=NO`. Каталог — соглашение репозитория, не sandbox ОС, не LSM, не policy engine продукта.

`THIS_DIRECTORY_IS_NOT_A_SECURITY_BOUNDARY`.

## Слияние алгоритма PDP (детерминированно, без порядка грантов)

1. Несинтетика / битый вход → `DENY`
2. Неизвестное действие → `DENY`
3. Несовпадение субъекта → `DENY`
4. Метка провайдера/модели как субъект → `DENY` (случай 8)
5. Неверная основа authority (`OWNER_GOAL`, `OWNER_PREFERENCE`, …) → `DENY`
6. Явно неоднозначная основа (`AMBIGUOUS`) → `ESCALATE_TO_OWNER`
7. Обязательный контекст устарел → `ESCALATE_TO_OWNER`
8. Совпадающий активный `DENY`-грант → `DENY` (превосходство DENY)
9. Совпадающий неоднозначный грант без DENY → `ESCALATE_TO_OWNER`
10. Два и более валидных `ALLOW` на тот же запрос → `ESCALATE_TO_OWNER` (конфликт)
11. Ровно один валидный `ALLOW` → `ALLOW` (симулированный)
12. Нет валидного гранта (нет / истёк / отозван) → `DENY`

Время берётся **только** из `context.now`. `Date.now()`, сеть и FS в `evaluate()` не используются.

## Решения PDP

`PDP_DECISIONS_SUPPORTED=ALLOW,DENY,ESCALATE_TO_OWNER`

`ALLOW` всегда несёт:

- `SIMULATED_ALLOW=YES`
- `REAL_AUTHORIZATION=NO`
- `TEST_GRANT=YES` (в этом эксперименте все гранты тестовые)
- `OWNER_AUTHORITY=NO`

## Гейты, которые этот эксперимент не принимает

```
ISO_ACCEPTED=NO
OWNER_CHANNEL_GATE=NOT_ACCEPTED
MERGE_SERIALIZATION_GATE=NOT_ACCEPTED
RUNTIME_GATES_DEPLOYED=0/2
CANON_APPLY=0%
```

`NEXT=INDEPENDENT READ-ONLY REVIEW OF DRAFT PR`

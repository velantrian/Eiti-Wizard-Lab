# Evidence — только локальная синтетика

```
EXPERIMENTAL_ONLY=YES
SYNTHETIC_ONLY=YES
AUTHORITATIVE=NO
REAL_PEP_ALLOWED=NO
THIS_DIRECTORY_IS_NOT_A_SECURITY_BOUNDARY
```

- `sample-decision.json` — закоммиченный пример решения PDP (не реальная авторизация).
- `generated/` — вывод тестов, не коммитится.
- PDP сам **не** пишет файлы. Пишут только тесты, и только сюда.

`SIMULATED_ALLOW != REAL_AUTHORIZATION`.

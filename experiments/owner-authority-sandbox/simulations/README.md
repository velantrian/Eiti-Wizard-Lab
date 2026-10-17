# Симуляции запросов (без побочных эффектов)

```
EXPERIMENTAL_ONLY=YES
SYNTHETIC_ONLY=YES
AUTHORITATIVE=NO
AUTONOMOUS_EFFECTS_ALLOWED=NO
THIS_DIRECTORY_IS_NOT_A_SECURITY_BOUNDARY
```

Файлы здесь — **только структуры** запрос/действие. Их чтение или оценка PDP **не** вызывает сеть, коннекторы, PEP, запись вне evidence и не меняет канон.

`SIMULATED_ALLOW != REAL_AUTHORIZATION`.
`TOOL_AVAILABLE != TOOL_AUTHORIZED`.

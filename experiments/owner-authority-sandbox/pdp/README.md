# PDP — чистый детерминированный оценщик v0.1

```
EXPERIMENTAL_ONLY=YES
SYNTHETIC_ONLY=YES
AUTHORITATIVE=NO
REAL_PEP_ALLOWED=NO
THIS_DIRECTORY_IS_NOT_A_SECURITY_BOUNDARY
```

`evaluate()` — чистая функция. Не читает диск, не пишет диск, не ходит в сеть, не смотрит `Date.now()` / `process.env`.

Публичный вход: `{ passport, context, grants, request, knownActions? }`.
Публичный выход: `{ decision: ALLOW|DENY|ESCALATE_TO_OWNER, labels, ... }`.

`ALLOW` здесь всегда `SIMULATED_ALLOW`. Это не PEP и не production authorization.

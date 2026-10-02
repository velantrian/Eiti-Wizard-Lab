# lab_composition structure (LAB COMPOSITION E0-A)

```
experiments/memory-governance-e0a/lab_composition/
  README.md
  REFERENCES.md
  STRUCTURE.md
  __init__.py
  composition.py
  crystal_like_admission/
    REFERENCE.md
    __init__.py
    gate.py          # admit_typed_event
  native_kernel_like_transition_rules/
    REFERENCE.md
    __init__.py
    rules.py         # apply_admission
  continuum_like_resume/
    REFERENCE.md
    __init__.py
    resume.py        # project_resume
```

State/DB/tests remain under `experiments/memory-governance-e0a/` (Lab only).
Pipeline (runner.apply_step): admit_* → apply_* → SQLite → project_* (resume).
Composition run: executed on branch `exp/e0a-memory-governance` (no architecture promotion).

"""LAB ONLY experimental composition for E0-A. Not real Crystal/NK/Continuum."""

from lab_composition.crystal_like_admission import (
    AdmissionDecision,
    AdmissionOutcome,
    admit_typed_event,
)
from lab_composition.native_kernel_like_transition_rules import (
    ApplyError,
    TransitionReceipt,
    apply_admission,
)
from lab_composition.continuum_like_resume import ResumeBundle, project_resume

__lab_only__ = True
__all__ = [
    "AdmissionDecision",
    "AdmissionOutcome",
    "admit_typed_event",
    "ApplyError",
    "TransitionReceipt",
    "apply_admission",
    "ResumeBundle",
    "project_resume",
]

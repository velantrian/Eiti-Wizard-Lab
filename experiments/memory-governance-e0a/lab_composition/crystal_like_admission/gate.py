"""LAB ONLY: typed ACCEPT/HOLD/REJECT. Not Crystal."""
from __future__ import annotations
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Any, Mapping, Optional


class AdmissionOutcome(str, Enum):
    ACCEPT = "ACCEPT"
    HOLD = "HOLD"
    REJECT = "REJECT"


@dataclass(frozen=True)
class AdmissionDecision:
    outcome: AdmissionOutcome
    target_status: str  # PROPOSED|ACTIVE|HELD|REJECTED|...
    rationale: str
    lab_component: str = "crystal_like_admission"

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["outcome"] = self.outcome.value
        return d


def admit_typed_event(
    event: Mapping[str, Any],
    *,
    active_decision: Optional[Mapping[str, Any]] = None,
) -> AdmissionDecision:
    """Fixture-typed routing only. MODEL never → ACTIVE decision."""
    et = event["event_type"]
    content = str(event.get("content", ""))

    if et == "MODEL_PROPOSAL":
        if active_decision is not None and _conflicts_with_active(content, active_decision):
            return AdmissionDecision(
                AdmissionOutcome.REJECT,
                "REJECTED",
                "re-assertion conflicts with ACTIVE USER_DECISION; no second ACTIVE",
            )
        return AdmissionDecision(
            AdmissionOutcome.ACCEPT,
            "PROPOSED",
            "MODEL_PROPOSAL retained as non-authoritative PROPOSED",
        )

    if et == "USER_DECISION":
        return AdmissionDecision(
            AdmissionOutcome.ACCEPT,
            "ACTIVE",
            "USER_DECISION becomes ACTIVE scoped decision",
        )

    if et == "RESEARCH_CLAIM":
        return AdmissionDecision(
            AdmissionOutcome.HOLD,
            "HELD",
            "unsupported RESEARCH_CLAIM held; not authoritative ACTIVE",
        )

    if et == "QUERY_RESUME":
        return AdmissionDecision(
            AdmissionOutcome.ACCEPT,
            "RESUME_QUERY",
            "resume query; no state mutation from admission alone",
        )

    return AdmissionDecision(
        AdmissionOutcome.REJECT,
        "UNKNOWN",
        f"unknown event_type={et!r}",
    )


def _conflicts_with_active(proposal: str, active: Mapping[str, Any]) -> bool:
    p = proposal.lower()
    a = str(active.get("content", "")).lower()
    if "graphiti" in p and "without graphiti" in a:
        return True
    return "graphiti" in p and "graphiti" in a and "without" in a

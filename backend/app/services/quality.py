"""Movement-quality layer.

This is deliberately separate from pose estimation. The client produces
*measurements* (per-repetition joint-angle features); this module turns those
measurements into a classification and a score.

The MVP baseline is an explainable rule set over engineered features. It
implements `RepClassifier`, so it can later be replaced by a trained model
(Random Forest / temporal model) without touching the routers or the schema.

Terminology note: the output is a "Movement Quality Score" - a measure of how
closely a repetition matched the prescribed movement parameters. It is not a
clinical or diagnostic judgement.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

# --- Tunable thresholds (single place, so they can become per-patient later) --
MIN_VISIBILITY = 0.5          # below this the pose was not reliable enough
RANGE_TOLERANCE = 0.9         # fraction of target ROM that counts as "reached"
MIN_REP_SECONDS = 1.0         # faster than this is not a controlled repetition
IDEAL_TEMPO_RANGE = (1.5, 6.0)
MAX_REP_SECONDS = 12.0        # slower than this is likely a tracking artefact

VALID = "valid"
INCOMPLETE_RANGE = "incomplete_range"
TOO_FAST = "too_fast"
LOW_VISIBILITY = "low_visibility"
UNCLASSIFIED = "unclassified"


@dataclass(frozen=True)
class RepFeatures:
    """Engineered features for one repetition."""

    index: int
    min_angle: float
    max_angle: float
    duration_seconds: float
    peak_velocity: float | None = None
    mean_visibility: float | None = None

    @property
    def excursion(self) -> float:
        """Angular travel within the repetition."""
        return max(0.0, self.max_angle - self.min_angle)


@dataclass(frozen=True)
class RepAssessment:
    index: int
    valid: bool
    classification: str
    reason: str | None
    score: float  # 0..1 movement quality for this repetition


class RepClassifier(Protocol):
    """Swap-in point for a trained model."""

    def assess(self, rep: RepFeatures, target_rom: float) -> RepAssessment: ...


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _range_score(max_angle: float, target: float) -> float:
    """How close the peak angle came to the prescribed range.

    Reaching the tolerance band scores full marks; falling short is penalised
    on a square curve so that a half-range repetition scores clearly worse than
    a nearly-complete one, rather than both landing in the high eighties.
    """
    ratio = _clamp(max_angle / target) if target > 0 else 0.0
    if ratio >= RANGE_TOLERANCE:
        return 1.0
    return round(0.9 * (ratio / RANGE_TOLERANCE) ** 2, 4)


def _tempo_score(duration: float) -> float:
    low, high = IDEAL_TEMPO_RANGE
    if low <= duration <= high:
        return 1.0
    if duration < low:
        # Linear fall-off towards the "too fast" cutoff.
        return _clamp((duration - MIN_REP_SECONDS) / (low - MIN_REP_SECONDS)) * 0.8
    return _clamp(1.0 - (duration - high) / (MAX_REP_SECONDS - high)) * 0.8 + 0.2


class RuleBasedRepClassifier:
    """Baseline classifier. Explainable, no training data required."""

    def assess(self, rep: RepFeatures, target_rom: float) -> RepAssessment:
        if rep.mean_visibility is not None and rep.mean_visibility < MIN_VISIBILITY:
            return RepAssessment(
                index=rep.index,
                valid=False,
                classification=LOW_VISIBILITY,
                reason="The camera could not see the movement clearly.",
                score=0.0,
            )

        target = target_rom if target_rom and target_rom > 0 else None
        if target is None:
            # No target configured: we can measure but cannot judge range.
            return RepAssessment(
                index=rep.index,
                valid=False,
                classification=UNCLASSIFIED,
                reason="No movement target is configured for this exercise.",
                score=0.0,
            )

        range_score = _range_score(rep.max_angle, target)
        tempo = _tempo_score(rep.duration_seconds)

        if rep.duration_seconds < MIN_REP_SECONDS:
            return RepAssessment(
                index=rep.index,
                valid=False,
                classification=TOO_FAST,
                reason="This repetition was done very quickly.",
                score=round(0.6 * range_score, 3),
            )

        if rep.max_angle < RANGE_TOLERANCE * target:
            return RepAssessment(
                index=rep.index,
                valid=False,
                classification=INCOMPLETE_RANGE,
                reason=(
                    f"Reached {rep.max_angle:.0f}° of the {target:.0f}° "
                    "movement range set by your physiotherapist."
                ),
                score=round(0.7 * range_score + 0.3 * tempo, 3),
            )

        return RepAssessment(
            index=rep.index,
            valid=True,
            classification=VALID,
            reason=None,
            score=round(_clamp(0.7 * range_score + 0.3 * tempo), 3),
        )


# Module-level default; routers depend on this name, not the class.
default_classifier: RepClassifier = RuleBasedRepClassifier()


@dataclass
class SessionAssessment:
    assessments: list[RepAssessment]
    reps_valid: int
    quality_score: float | None  # 0..100
    rom_max: float | None
    rom_mean: float | None


def assess_session(
    reps: list[RepFeatures],
    target_rom: float | None,
    classifier: RepClassifier | None = None,
) -> SessionAssessment:
    """Assess every repetition and aggregate to session level."""
    clf = classifier or default_classifier
    if not reps:
        return SessionAssessment([], 0, None, None, None)

    assessments = [clf.assess(rep, target_rom or 0.0) for rep in reps]
    peaks = [r.max_angle for r in reps]
    scorable = [a.score for a in assessments if a.classification != LOW_VISIBILITY]

    return SessionAssessment(
        assessments=assessments,
        reps_valid=sum(1 for a in assessments if a.valid),
        quality_score=round(100 * sum(scorable) / len(scorable), 1) if scorable else None,
        rom_max=round(max(peaks), 1),
        rom_mean=round(sum(peaks) / len(peaks), 1),
    )


def patient_feedback(
    assessment: SessionAssessment,
    reps_attempted: int,
    reps_prescribed: int,
) -> list[str]:
    """Plain-language session summary for the patient. No medical claims."""
    lines: list[str] = []
    if reps_attempted >= reps_prescribed and reps_prescribed:
        lines.append(f"You completed all {reps_attempted} repetitions.")
    else:
        lines.append(f"You completed {reps_attempted} of {reps_prescribed} repetitions.")

    if not assessment.assessments:
        lines.append("This session was recorded without camera tracking.")
        return lines

    lines.append(
        f"{assessment.reps_valid} of {len(assessment.assessments)} repetitions "
        "matched the movement your physiotherapist asked for."
    )

    counts: dict[str, int] = {}
    for a in assessment.assessments:
        if not a.valid:
            counts[a.classification] = counts.get(a.classification, 0) + 1

    if counts.get(INCOMPLETE_RANGE):
        lines.append("Next time, try moving a little further if it is comfortable.")
    if counts.get(TOO_FAST):
        lines.append("Try moving a little more slowly and holding at the end.")
    if counts.get(LOW_VISIBILITY):
        lines.append("Some repetitions were hard to see. Try more light or move back a little.")
    if not counts:
        lines.append("Good, steady movement throughout.")
    return lines

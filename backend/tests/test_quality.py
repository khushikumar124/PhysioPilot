"""Movement-quality layer: classification, aggregation and degraded input."""

from app.services import quality
from app.services.quality import RepFeatures, assess_session


def rep(index: int, peak: float, duration: float = 3.0, visibility: float = 0.9) -> RepFeatures:
    return RepFeatures(
        index=index,
        min_angle=5.0,
        max_angle=peak,
        duration_seconds=duration,
        mean_visibility=visibility,
    )


def test_full_range_controlled_rep_is_valid() -> None:
    result = assess_session([rep(0, 95.0)], target_rom=90)
    assert result.assessments[0].classification == quality.VALID
    assert result.reps_valid == 1


def test_short_range_rep_is_incomplete_not_valid() -> None:
    result = assess_session([rep(0, 55.0)], target_rom=90)
    verdict = result.assessments[0]
    assert verdict.classification == quality.INCOMPLETE_RANGE
    assert verdict.valid is False
    assert "55" in (verdict.reason or "")


def test_rep_just_inside_tolerance_still_counts() -> None:
    # 90% of the target is the accepted band.
    assert assess_session([rep(0, 81.0)], target_rom=90).reps_valid == 1
    assert assess_session([rep(0, 80.0)], target_rom=90).reps_valid == 0


def test_very_fast_rep_is_flagged() -> None:
    verdict = assess_session([rep(0, 95.0, duration=0.4)], target_rom=90).assessments[0]
    assert verdict.classification == quality.TOO_FAST
    assert verdict.valid is False


def test_low_visibility_rep_is_not_scored() -> None:
    result = assess_session([rep(0, 95.0, visibility=0.2)], target_rom=90)
    verdict = result.assessments[0]
    assert verdict.classification == quality.LOW_VISIBILITY
    assert verdict.valid is False
    # Unseen repetitions are excluded from the score rather than scored as zero.
    assert result.quality_score is None


def test_quality_score_separates_good_and_poor_range() -> None:
    good = assess_session([rep(i, 95.0) for i in range(10)], target_rom=90)
    poor = assess_session([rep(i, 45.0) for i in range(10)], target_rom=90)
    assert good.quality_score is not None and poor.quality_score is not None
    assert good.quality_score > 90
    assert poor.quality_score < 50


def test_missing_target_cannot_be_judged() -> None:
    result = assess_session([rep(0, 95.0)], target_rom=None)
    assert result.assessments[0].classification == quality.UNCLASSIFIED
    assert result.reps_valid == 0


def test_empty_session_returns_no_invented_numbers() -> None:
    result = assess_session([], target_rom=90)
    assert result.quality_score is None
    assert result.rom_max is None
    assert result.reps_valid == 0


def test_patient_feedback_is_plain_language() -> None:
    result = assess_session([rep(i, 95.0) for i in range(8)] + [rep(8, 50.0)], target_rom=90)
    lines = quality.patient_feedback(result, reps_attempted=9, reps_prescribed=10)
    text = " ".join(lines)
    assert "9 of 10 repetitions" in text
    assert "8 of 9 repetitions" in text
    # No clinical or diagnostic language.
    for banned in ("incorrect", "diagnos", "injury", "damage", "wrong"):
        assert banned not in text.lower()

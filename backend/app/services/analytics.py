"""Adherence, progress and trend computation.

Two distinct concepts are kept apart everywhere:

* **Session adherence** - did the patient do the prescribed work?
* **Movement quality** - how closely did the execution match the prescription?

A patient can have 100% adherence and 60% quality, or the reverse. Mixing them
would hide exactly the information a physiotherapist needs.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    Exercise,
    ExerciseSession,
    PatientProfile,
    PlanStatus,
    PrescribedExercise,
    RehabilitationPlan,
    SessionStatus,
)

TREND_IMPROVING = "improving"
TREND_STEADY = "steady"
TREND_DECLINING = "declining"
TREND_INSUFFICIENT = "insufficient_data"

# Degrees of change that we are willing to call a direction rather than noise.
ROM_TREND_DELTA = 3.0
ATTENTION_ADHERENCE_PCT = 65.0
ATTENTION_INACTIVE_DAYS = 3


def today() -> date:
    return datetime.now(timezone.utc).date()


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    return datetime.combine(day, time.min), datetime.combine(day, time.max)


def active_plan(db: Session, patient_id: int) -> RehabilitationPlan | None:
    """The patient's current plan: active, started, most recent first."""
    stmt = (
        select(RehabilitationPlan)
        .where(
            RehabilitationPlan.patient_id == patient_id,
            RehabilitationPlan.status == PlanStatus.active,
        )
        .order_by(RehabilitationPlan.start_date.desc(), RehabilitationPlan.id.desc())
    )
    return db.scalars(stmt).first()


def daily_session_quota(plan: RehabilitationPlan | None) -> int:
    """How many exercise sessions the plan expects per day."""
    if plan is None:
        return 0
    return sum(
        pe.frequency_per_day for pe in plan.prescribed_exercises if pe.active
    )


def completed_sessions(
    db: Session, patient_id: int, since: datetime | None = None, until: datetime | None = None
) -> list[ExerciseSession]:
    stmt = select(ExerciseSession).where(
        ExerciseSession.patient_id == patient_id,
        ExerciseSession.status == SessionStatus.completed,
    )
    if since is not None:
        stmt = stmt.where(ExerciseSession.completed_at >= since)
    if until is not None:
        stmt = stmt.where(ExerciseSession.completed_at <= until)
    return list(db.scalars(stmt.order_by(ExerciseSession.completed_at.asc())))


def compute_adherence(db: Session, patient_id: int, window_days: int = 14) -> dict:
    """Sessions completed vs sessions due over a rolling window.

    Days before the plan start (or after its end) do not count as "due" - a
    patient is not penalised for days they had no prescription.
    """
    plan = active_plan(db, patient_id)
    end = today()
    start = end - timedelta(days=window_days - 1)
    per_day = daily_session_quota(plan)

    due = 0
    if plan and per_day:
        for offset in range(window_days):
            day = start + timedelta(days=offset)
            if day < plan.start_date:
                continue
            if plan.end_date and day > plan.end_date:
                continue
            due += per_day

    sessions = completed_sessions(db, patient_id, since=_day_bounds(start)[0])
    done = len(sessions)
    day_set = {s.completed_at.date() for s in sessions if s.completed_at}

    # Current streak of consecutive days with at least one completed session.
    streak = 0
    cursor = end
    while cursor in day_set:
        streak += 1
        cursor -= timedelta(days=1)

    adherence = None
    if due:
        adherence = round(100 * min(done, due) / due, 1)

    return {
        "window_days": window_days,
        "sessions_due": due,
        "sessions_completed": done,
        "adherence_pct": adherence,
        "days_active": len(day_set),
        "current_streak_days": streak,
    }


def sessions_today(db: Session, patient_id: int) -> list[ExerciseSession]:
    lo, hi = _day_bounds(today())
    return completed_sessions(db, patient_id, since=lo, until=hi)


def rom_series(db: Session, patient_id: int, exercise_id: int) -> list[ExerciseSession]:
    """Completed, camera-tracked sessions for one exercise, oldest first."""
    stmt = (
        select(ExerciseSession)
        .join(PrescribedExercise, ExerciseSession.prescribed_exercise_id == PrescribedExercise.id)
        .where(
            ExerciseSession.patient_id == patient_id,
            PrescribedExercise.exercise_id == exercise_id,
            ExerciseSession.status == SessionStatus.completed,
            ExerciseSession.rom_max.is_not(None),
        )
        .order_by(ExerciseSession.completed_at.asc())
    )
    return list(db.scalars(stmt))


def trend_of(values: list[float], delta: float = ROM_TREND_DELTA) -> str:
    """Direction of a short series: compare the first half with the last half."""
    if len(values) < 4:
        return TREND_INSUFFICIENT
    half = len(values) // 2
    early = sum(values[:half]) / half
    late = sum(values[-half:]) / half
    if late - early >= delta:
        return TREND_IMPROVING
    if early - late >= delta:
        return TREND_DECLINING
    return TREND_STEADY


def patient_trend(db: Session, patient_id: int) -> str:
    """Overall movement trend, taken from the primary CV-tracked exercise."""
    plan = active_plan(db, patient_id)
    if plan is None:
        return TREND_INSUFFICIENT
    for pe in plan.prescribed_exercises:
        if not pe.exercise.cv_supported:
            continue
        values = [s.rom_max for s in rom_series(db, patient_id, pe.exercise_id) if s.rom_max]
        result = trend_of(values)
        if result != TREND_INSUFFICIENT:
            return result
    return TREND_INSUFFICIENT


def mean_quality(db: Session, patient_id: int, window_days: int = 14) -> float | None:
    since = _day_bounds(today() - timedelta(days=window_days - 1))[0]
    scores = [
        s.quality_score
        for s in completed_sessions(db, patient_id, since=since)
        if s.quality_score is not None
    ]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 1)


def attention_flags(db: Session, patient_id: int) -> list[str]:
    """Reasons a patient should be reviewed. Empty list means nothing flagged."""
    reasons: list[str] = []
    plan = active_plan(db, patient_id)
    if plan is None:
        return reasons

    adherence = compute_adherence(db, patient_id, window_days=7)
    if adherence["adherence_pct"] is not None and adherence["adherence_pct"] < ATTENTION_ADHERENCE_PCT:
        reasons.append(f"Adherence {adherence['adherence_pct']:.0f}% over the last 7 days")

    sessions = completed_sessions(db, patient_id)
    last = sessions[-1].completed_at if sessions else None
    if last is None:
        if plan.start_date <= today() - timedelta(days=ATTENTION_INACTIVE_DAYS):
            reasons.append("No sessions recorded since the plan started")
    else:
        gap = (today() - last.date()).days
        if gap >= ATTENTION_INACTIVE_DAYS:
            reasons.append(f"No session for {gap} days")

    if patient_trend(db, patient_id) == TREND_DECLINING:
        reasons.append("Observed movement range is trending down")

    quality = mean_quality(db, patient_id)
    if quality is not None and quality < 60:
        reasons.append(f"Movement quality {quality:.0f}% over the last 14 days")

    return reasons


def exercise_performance(db: Session, patient_id: int) -> list[dict]:
    """Per-exercise rollup for the current plan."""
    plan = active_plan(db, patient_id)
    if plan is None:
        return []

    out: list[dict] = []
    for pe in plan.prescribed_exercises:
        stmt = (
            select(ExerciseSession)
            .join(
                PrescribedExercise,
                ExerciseSession.prescribed_exercise_id == PrescribedExercise.id,
            )
            .where(
                ExerciseSession.patient_id == patient_id,
                PrescribedExercise.exercise_id == pe.exercise_id,
                ExerciseSession.status == SessionStatus.completed,
            )
            .order_by(ExerciseSession.completed_at.asc())
        )
        sessions = list(db.scalars(stmt))
        attempted = sum(s.reps_attempted for s in sessions)
        valid_values = [s.reps_valid for s in sessions if s.reps_valid is not None]
        tracked = [s for s in sessions if s.quality_score is not None]
        roms = [s.rom_max for s in sessions if s.rom_max is not None]

        out.append(
            {
                "exercise_id": pe.exercise_id,
                "exercise_name": pe.exercise.name,
                "cv_supported": pe.exercise.cv_supported,
                "sessions": len(sessions),
                "reps_attempted": attempted,
                "reps_valid": sum(valid_values) if valid_values else None,
                "quality_pct": (
                    round(sum(s.quality_score for s in tracked) / len(tracked), 1)
                    if tracked
                    else None
                ),
                "latest_rom": roms[-1] if roms else None,
                "best_rom": max(roms) if roms else None,
                "target_rom": pe.target_rom or pe.exercise.default_target_rom,
                "trend": trend_of(roms),
            }
        )
    return out


def progress_series(db: Session, patient_id: int) -> list[dict]:
    """ROM-over-time series for every CV-tracked exercise in the plan."""
    plan = active_plan(db, patient_id)
    if plan is None:
        return []

    series: list[dict] = []
    seen: set[int] = set()
    for pe in plan.prescribed_exercises:
        exercise: Exercise = pe.exercise
        if not exercise.cv_supported or exercise.id in seen:
            continue
        seen.add(exercise.id)
        sessions = rom_series(db, patient_id, exercise.id)
        points = [
            {"session_id": s.id, "recorded_at": s.completed_at, "value": s.rom_max}
            for s in sessions
        ]
        series.append(
            {
                "exercise_id": exercise.id,
                "exercise_name": exercise.name,
                "metric_type": exercise.primary_metric or "rom_max",
                "unit": "degrees",
                "points": points,
                "trend": trend_of([p["value"] for p in points]),
            }
        )
    return series


def patient_summary(db: Session, patient: PatientProfile) -> dict:
    plan = active_plan(db, patient.id)
    adherence = compute_adherence(db, patient.id, window_days=14)
    sessions = completed_sessions(db, patient.id)
    reasons = attention_flags(db, patient.id)
    return {
        "id": patient.id,
        "name": patient.user.name,
        "condition": plan.condition if plan else None,
        "active_plan_id": plan.id if plan else None,
        "adherence_pct": adherence["adherence_pct"],
        "quality_pct": mean_quality(db, patient.id),
        "last_session_at": sessions[-1].completed_at if sessions else None,
        "trend": patient_trend(db, patient.id),
        "needs_attention": bool(reasons),
        "attention_reasons": reasons,
    }

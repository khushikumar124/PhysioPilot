"""Patient-facing read endpoints and the assistant.

Everything here is scoped to the calling patient by construction: the patient
id comes from the token, never from the URL.
"""

from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_patient
from ..models import (
    AssistantConversation,
    ExerciseSession,
    PatientProfile,
    SessionStatus,
)
from ..schemas import (
    AdherenceOut,
    AssistantAsk,
    AssistantReply,
    AssistantTurn,
    ExerciseOut,
    ProgressSeries,
    RoutineItem,
    SessionOut,
    TodayRoutine,
)
from ..services import analytics, assistant

router = APIRouter(prefix="/api/me", tags=["patient"])


def _completed_today_by_prescription(db: Session, patient_id: int) -> dict[int, int]:
    counts: dict[int, int] = {}
    for session in analytics.sessions_today(db, patient_id):
        counts[session.prescribed_exercise_id] = counts.get(session.prescribed_exercise_id, 0) + 1
    return counts


@router.get("/routine", response_model=TodayRoutine)
def todays_routine(
    patient: PatientProfile = Depends(require_patient), db: Session = Depends(get_db)
) -> TodayRoutine:
    plan = analytics.active_plan(db, patient.id)
    done_today = _completed_today_by_prescription(db, patient.id)

    items: list[RoutineItem] = []
    if plan:
        for pe in plan.prescribed_exercises:
            if not pe.active:
                continue
            done = done_today.get(pe.id, 0)
            items.append(
                RoutineItem(
                    prescribed_exercise_id=pe.id,
                    exercise=ExerciseOut.model_validate(pe.exercise),
                    sets=pe.sets,
                    repetitions=pe.repetitions,
                    hold_seconds=pe.hold_seconds,
                    instructions=pe.instructions or pe.exercise.patient_cue,
                    target_rom=pe.target_rom or pe.exercise.default_target_rom,
                    sessions_due_today=pe.frequency_per_day,
                    sessions_done_today=done,
                    completed_today=done >= pe.frequency_per_day,
                )
            )

    # "This week" runs Monday to Sunday - the unit patients think in.
    today = analytics.today()
    week_start = today - timedelta(days=today.weekday())
    per_day = analytics.daily_session_quota(plan)
    due_this_week = 0
    if plan and per_day:
        for offset in range((today - week_start).days + 1):
            day = week_start + timedelta(days=offset)
            if day < plan.start_date or (plan.end_date and day > plan.end_date):
                continue
            due_this_week += per_day

    done_this_week = len(
        analytics.completed_sessions(
            db, patient.id, since=datetime.combine(week_start, time.min)
        )
    )

    return TodayRoutine(
        patient_name=patient.user.name,
        plan_title=plan.title if plan else None,
        condition=plan.condition if plan else None,
        items=items,
        sessions_done_this_week=done_this_week,
        sessions_due_this_week=due_this_week,
    )


@router.get("/adherence", response_model=AdherenceOut)
def my_adherence(
    window_days: int = 14,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AdherenceOut:
    window = max(1, min(window_days, 120))
    return AdherenceOut(**analytics.compute_adherence(db, patient.id, window))


@router.get("/progress", response_model=list[ProgressSeries])
def my_progress(
    patient: PatientProfile = Depends(require_patient), db: Session = Depends(get_db)
) -> list[ProgressSeries]:
    return [ProgressSeries(**row) for row in analytics.progress_series(db, patient.id)]


@router.get("/sessions", response_model=list[SessionOut])
def my_sessions(
    limit: int = 20,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> list[ExerciseSession]:
    stmt = (
        select(ExerciseSession)
        .where(ExerciseSession.patient_id == patient.id)
        .order_by(ExerciseSession.started_at.desc())
        .limit(max(1, min(limit, 100)))
    )
    return list(db.scalars(stmt))


def _build_context(db: Session, patient: PatientProfile) -> assistant.PlanContext:
    """Assemble the only facts the assistant is allowed to use."""
    plan = analytics.active_plan(db, patient.id)
    done_today = _completed_today_by_prescription(db, patient.id)

    exercises = []
    due_today = 0
    if plan:
        for pe in plan.prescribed_exercises:
            if not pe.active:
                continue
            due_today += pe.frequency_per_day
            exercises.append(
                {
                    "name": pe.exercise.name,
                    "sets": pe.sets,
                    "repetitions": pe.repetitions,
                    "instructions": pe.instructions or pe.exercise.patient_cue,
                    "cue": pe.exercise.patient_cue,
                    "done_today": done_today.get(pe.id, 0),
                }
            )

    history = analytics.completed_sessions(db, patient.id)
    last = history[-1] if history else None
    adherence = analytics.compute_adherence(db, patient.id)

    return assistant.PlanContext(
        patient_name=patient.user.name,
        condition=plan.condition if plan else None,
        plan_title=plan.title if plan else None,
        exercises=exercises,
        sessions_done_today=sum(done_today.values()),
        sessions_due_today=due_today,
        adherence_pct=adherence["adherence_pct"],
        last_session=(
            {
                "exercise": last.prescribed_exercise.exercise.name,
                "reps_attempted": last.reps_attempted,
                "reps_valid": last.reps_valid,
                "quality_score": last.quality_score,
                "completed_at": last.completed_at,
            }
            if last
            else None
        ),
    )


@router.post("/assistant", response_model=AssistantReply)
def ask_assistant(
    payload: AssistantAsk,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AssistantReply:
    ctx = _build_context(db, patient)
    result = assistant.answer(payload.message.strip(), ctx)

    db.add(
        AssistantConversation(
            patient_id=patient.id,
            user_message=payload.message.strip(),
            assistant_response=result.reply,
            source=result.source,
            redirected=result.redirected,
        )
    )
    db.commit()

    return AssistantReply(
        reply=result.reply,
        source=result.source,
        redirected=result.redirected,
        suggestions=assistant.SUGGESTED_QUESTIONS,
    )


@router.get("/assistant/history", response_model=list[AssistantTurn])
def assistant_history(
    limit: int = 20,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> list[AssistantConversation]:
    stmt = (
        select(AssistantConversation)
        .where(AssistantConversation.patient_id == patient.id)
        .order_by(AssistantConversation.created_at.desc())
        .limit(max(1, min(limit, 100)))
    )
    return list(reversed(list(db.scalars(stmt))))

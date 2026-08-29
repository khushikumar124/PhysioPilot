"""Exercise session lifecycle (patient-owned).

The client performs pose estimation and repetition detection locally, then
submits *measurements*. The server owns classification and scoring, so the
movement-quality model can change without shipping a new client, and so a
client cannot simply declare its own score.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_patient
from ..models import (
    ExerciseSession,
    PatientProfile,
    PrescribedExercise,
    ProgressMetric,
    RehabilitationPlan,
    SessionRep,
    SessionStatus,
)
from ..schemas import SessionComplete, SessionOut, SessionResult, SessionStart
from ..services import quality

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _owned_prescription(
    db: Session, patient: PatientProfile, prescribed_exercise_id: int
) -> PrescribedExercise:
    """Load a prescribed exercise, but only if it belongs to this patient."""
    pe = db.get(PrescribedExercise, prescribed_exercise_id)
    if pe is None or pe.plan.patient_id != patient.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercise not found in your plan")
    if not pe.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "This exercise is no longer in your plan")
    return pe


def _owned_session(db: Session, patient: PatientProfile, session_id: int) -> ExerciseSession:
    session = db.get(ExerciseSession, session_id)
    if session is None or session.patient_id != patient.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return session


@router.post("/start", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def start_session(
    payload: SessionStart,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> ExerciseSession:
    pe = _owned_prescription(db, patient, payload.prescribed_exercise_id)
    session = ExerciseSession(
        patient_id=patient.id,
        prescribed_exercise_id=pe.id,
        # One "session" is one set of the prescribed repetitions.
        reps_prescribed=pe.repetitions,
        status=SessionStatus.in_progress,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/complete", response_model=SessionResult)
def complete_session(
    session_id: int,
    payload: SessionComplete,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> SessionResult:
    session = _owned_session(db, patient, session_id)
    if session.status is not SessionStatus.in_progress:
        raise HTTPException(status.HTTP_409_CONFLICT, "This session was already finished")

    pe = session.prescribed_exercise
    target_rom = pe.target_rom or pe.exercise.default_target_rom

    features = [
        quality.RepFeatures(
            index=rep.index,
            min_angle=rep.min_angle,
            max_angle=rep.max_angle,
            duration_seconds=rep.duration_seconds,
            peak_velocity=rep.peak_velocity,
            mean_visibility=rep.mean_visibility,
        )
        for rep in payload.reps
    ]
    assessment = quality.assess_session(features, target_rom)

    session.status = SessionStatus.completed
    session.completed_at = datetime.now(timezone.utc)
    session.reps_attempted = payload.reps_attempted
    session.tracking_mode = payload.tracking_mode
    session.pose_coverage = payload.pose_coverage
    session.notes = payload.notes

    # Quality fields stay null for self-reported sessions: adherence is real,
    # but there is no measurement to score, and we do not invent one.
    if payload.tracking_mode == "camera" and features:
        session.reps_valid = assessment.reps_valid
        session.quality_score = assessment.quality_score
        session.rom_max = assessment.rom_max
        session.rom_mean = assessment.rom_mean

    for rep, verdict in zip(payload.reps, assessment.assessments):
        db.add(
            SessionRep(
                session_id=session.id,
                index=rep.index,
                min_angle=rep.min_angle,
                max_angle=rep.max_angle,
                rom=round(max(0.0, rep.max_angle - rep.min_angle), 1),
                duration_seconds=rep.duration_seconds,
                peak_velocity=rep.peak_velocity,
                mean_visibility=rep.mean_visibility,
                valid=verdict.valid,
                classification=verdict.classification,
                reason=verdict.reason,
            )
        )

    summary = quality.patient_feedback(
        assessment if session.rom_max is not None else quality.SessionAssessment([], 0, None, None, None),
        session.reps_attempted,
        session.reps_prescribed,
    )
    session.feedback = " ".join(summary)

    if session.rom_max is not None:
        db.add(
            ProgressMetric(
                patient_id=patient.id,
                exercise_id=pe.exercise_id,
                session_id=session.id,
                metric_type="rom_max",
                value=session.rom_max,
                recorded_at=session.completed_at,
            )
        )
    if session.quality_score is not None:
        db.add(
            ProgressMetric(
                patient_id=patient.id,
                exercise_id=pe.exercise_id,
                session_id=session.id,
                metric_type="quality_score",
                value=session.quality_score,
                recorded_at=session.completed_at,
            )
        )

    db.commit()
    db.refresh(session)

    return SessionResult(
        **SessionOut.model_validate(session).model_dump(),
        exercise_name=pe.exercise.name,
        reps=[r for r in session.reps],
        patient_summary=summary,
    )


@router.post("/{session_id}/abandon", response_model=SessionOut)
def abandon_session(
    session_id: int,
    patient: PatientProfile = Depends(require_patient),
    db: Session = Depends(get_db),
) -> ExerciseSession:
    """Record that a started session was not finished (camera denied, stopped early).

    Abandoned sessions never count towards adherence or quality.
    """
    session = _owned_session(db, patient, session_id)
    if session.status is SessionStatus.in_progress:
        session.status = SessionStatus.abandoned
        session.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
    return session

"""Therapist-facing patient management and analytics."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_therapist, therapist_patient
from ..models import (
    ExerciseSession,
    PatientProfile,
    PhysiotherapistProfile,
    PlanStatus,
    RehabilitationPlan,
    SessionStatus,
    User,
    UserRole,
)
from ..schemas import (
    AdherenceOut,
    ExercisePerformanceOut,
    PatientCreate,
    PatientOut,
    PatientSummary,
    PatientUpdate,
    ProgressSeries,
    SessionOut,
    TherapistOverview,
)
from ..security import hash_password
from ..services import analytics

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _patient_out(patient: PatientProfile) -> PatientOut:
    return PatientOut(
        id=patient.id,
        name=patient.user.name,
        email=patient.user.email,
        date_of_birth=patient.date_of_birth,
        phone=patient.phone,
        language=patient.language,
        notes=patient.notes,
    )


@router.get("/overview", response_model=TherapistOverview)
def overview(
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> TherapistOverview:
    patients = therapist.patients
    active = 0
    needing = 0
    done_today = 0
    for patient in patients:
        if analytics.active_plan(db, patient.id):
            active += 1
        if analytics.attention_flags(db, patient.id):
            needing += 1
        done_today += len(analytics.sessions_today(db, patient.id))
    return TherapistOverview(
        total_patients=len(patients),
        patients_on_active_plans=active,
        sessions_completed_today=done_today,
        patients_needing_attention=needing,
    )


@router.get("", response_model=list[PatientSummary])
def list_patients(
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> list[PatientSummary]:
    rows = [analytics.patient_summary(db, p) for p in therapist.patients]
    # Patients needing attention float to the top of the clinician's list.
    rows.sort(key=lambda r: (not r["needs_attention"], r["name"]))
    return [PatientSummary(**row) for row in rows]


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> PatientOut:
    """Create a patient login and assign it to the calling therapist."""
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.patient,
    )
    db.add(user)
    db.flush()
    profile = PatientProfile(
        user_id=user.id,
        assigned_therapist_id=therapist.id,
        date_of_birth=payload.date_of_birth,
        phone=payload.phone,
        language=payload.language,
        notes=payload.notes,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _patient_out(profile)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient: PatientProfile = Depends(therapist_patient)) -> PatientOut:
    return _patient_out(patient)


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(
    payload: PatientUpdate,
    patient: PatientProfile = Depends(therapist_patient),
    db: Session = Depends(get_db),
) -> PatientOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return _patient_out(patient)


@router.get("/{patient_id}/adherence", response_model=AdherenceOut)
def patient_adherence(
    window_days: int = 14,
    patient: PatientProfile = Depends(therapist_patient),
    db: Session = Depends(get_db),
) -> AdherenceOut:
    window = max(1, min(window_days, 120))
    return AdherenceOut(**analytics.compute_adherence(db, patient.id, window))


@router.get("/{patient_id}/performance", response_model=list[ExercisePerformanceOut])
def patient_performance(
    patient: PatientProfile = Depends(therapist_patient),
    db: Session = Depends(get_db),
) -> list[ExercisePerformanceOut]:
    return [ExercisePerformanceOut(**row) for row in analytics.exercise_performance(db, patient.id)]


@router.get("/{patient_id}/progress", response_model=list[ProgressSeries])
def patient_progress(
    patient: PatientProfile = Depends(therapist_patient),
    db: Session = Depends(get_db),
) -> list[ProgressSeries]:
    return [ProgressSeries(**row) for row in analytics.progress_series(db, patient.id)]


@router.get("/{patient_id}/sessions", response_model=list[SessionOut])
def patient_sessions(
    limit: int = 30,
    patient: PatientProfile = Depends(therapist_patient),
    db: Session = Depends(get_db),
) -> list[ExerciseSession]:
    stmt = (
        select(ExerciseSession)
        .where(ExerciseSession.patient_id == patient.id)
        .order_by(ExerciseSession.started_at.desc())
        .limit(max(1, min(limit, 200)))
    )
    return list(db.scalars(stmt))

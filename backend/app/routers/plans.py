"""Prescription: rehabilitation plans and their prescribed exercises.

Write access is therapist-only, and only for their own patients. Patients read
their plan through /api/me/* endpoints; they have no write path here at all.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_therapist, therapist_patient
from ..models import (
    Exercise,
    PatientProfile,
    PhysiotherapistProfile,
    PlanStatus,
    PrescribedExercise,
    RehabilitationPlan,
)
from ..schemas import PlanCreate, PlanOut, PlanUpdate, PrescribedExerciseIn

# Spelled out rather than taken from `status`, whose name for 422 has churned
# between Starlette releases.
HTTP_422 = 422

router = APIRouter(prefix="/api", tags=["plans"])


def _apply_items(
    db: Session, plan: RehabilitationPlan, items: list[PrescribedExerciseIn]
) -> None:
    """Replace the plan's exercise list.

    Existing rows are reused where the exercise is unchanged so that historical
    sessions keep pointing at a live prescribed_exercise row; rows that drop out
    of the plan are deactivated rather than deleted, preserving session history.
    """
    known = {e.id for e in db.scalars(select(Exercise))}
    for item in items:
        if item.exercise_id not in known:
            raise HTTPException(HTTP_422, "Unknown exercise")

    by_exercise = {pe.exercise_id: pe for pe in plan.prescribed_exercises}
    kept: set[int] = set()

    for order, item in enumerate(items):
        existing = by_exercise.get(item.exercise_id)
        if existing is None:
            existing = PrescribedExercise(plan_id=plan.id, exercise_id=item.exercise_id)
            db.add(existing)
            plan.prescribed_exercises.append(existing)
        existing.sets = item.sets
        existing.repetitions = item.repetitions
        existing.hold_seconds = item.hold_seconds
        existing.frequency_per_day = item.frequency_per_day
        existing.instructions = item.instructions
        existing.target_rom = item.target_rom
        existing.order_index = order
        existing.active = True
        kept.add(item.exercise_id)

    for exercise_id, pe in by_exercise.items():
        if exercise_id not in kept:
            pe.active = False


@router.get("/patients/{patient_id}/plans", response_model=list[PlanOut])
def list_plans(
    patient: PatientProfile = Depends(therapist_patient), db: Session = Depends(get_db)
) -> list[RehabilitationPlan]:
    stmt = (
        select(RehabilitationPlan)
        .where(RehabilitationPlan.patient_id == patient.id)
        .order_by(RehabilitationPlan.start_date.desc())
    )
    return list(db.scalars(stmt))


@router.post(
    "/patients/{patient_id}/plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED
)
def create_plan(
    payload: PlanCreate,
    patient: PatientProfile = Depends(therapist_patient),
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> RehabilitationPlan:
    if payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(HTTP_422, "End date is before start date")

    # A patient follows one plan at a time; superseded plans are marked complete.
    for existing in db.scalars(
        select(RehabilitationPlan).where(
            RehabilitationPlan.patient_id == patient.id,
            RehabilitationPlan.status == PlanStatus.active,
        )
    ):
        existing.status = PlanStatus.completed

    plan = RehabilitationPlan(
        patient_id=patient.id,
        therapist_id=therapist.id,
        title=payload.title,
        condition=payload.condition,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=PlanStatus.active,
    )
    db.add(plan)
    db.flush()
    _apply_items(db, plan, payload.items)
    db.commit()
    db.refresh(plan)
    return plan


def _owned_plan(plan_id: int, therapist: PhysiotherapistProfile, db: Session) -> RehabilitationPlan:
    plan = db.get(RehabilitationPlan, plan_id)
    if plan is None or plan.patient.assigned_therapist_id != therapist.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")
    return plan


@router.get("/plans/{plan_id}", response_model=PlanOut)
def get_plan(
    plan_id: int,
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> RehabilitationPlan:
    return _owned_plan(plan_id, therapist, db)


@router.patch("/plans/{plan_id}", response_model=PlanOut)
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> RehabilitationPlan:
    plan = _owned_plan(plan_id, therapist, db)
    data = payload.model_dump(exclude_unset=True)
    items = data.pop("items", None)
    for field, value in data.items():
        setattr(plan, field, value)
    if plan.end_date and plan.end_date < plan.start_date:
        raise HTTPException(HTTP_422, "End date is before start date")
    if items is not None:
        if not items:
            raise HTTPException(HTTP_422, "A plan needs at least one exercise")
        _apply_items(db, plan, [PrescribedExerciseIn(**item) for item in items])
    db.commit()
    db.refresh(plan)
    return plan

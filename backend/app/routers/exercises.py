"""Exercise catalogue.

Reading is open to any authenticated user. Creating is therapist-only, and a
therapist's own exercises stay private to them.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_therapist
from ..models import Exercise, PhysiotherapistProfile, User, UserRole
from ..schemas import ExerciseCreate, ExerciseOut

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "exercise"


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Exercise]:
    """Built-in exercises, plus the caller's own if they are a therapist."""
    stmt = select(Exercise)
    if user.role is UserRole.physiotherapist and user.therapist_profile:
        stmt = stmt.where(
            or_(
                Exercise.created_by_therapist_id.is_(None),
                Exercise.created_by_therapist_id == user.therapist_profile.id,
            )
        )
    else:
        # A patient never prescribes, so they only ever need the shared set.
        stmt = stmt.where(Exercise.created_by_therapist_id.is_(None))
    return list(db.scalars(stmt.order_by(Exercise.name)))


@router.post("", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
def create_exercise(
    payload: ExerciseCreate,
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> Exercise:
    """Add an exercise this clinic uses that is not in the built-in set."""
    name = payload.name.strip()

    # Names must be unambiguous in the prescribing list this therapist sees.
    clash = db.scalar(
        select(Exercise).where(
            Exercise.name.ilike(name),
            or_(
                Exercise.created_by_therapist_id.is_(None),
                Exercise.created_by_therapist_id == therapist.id,
            ),
        )
    )
    if clash:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You already have an exercise called {clash.name}.",
        )

    # Slugs are global, so a clinician's exercise is namespaced by their id.
    base = f"custom_{therapist.id}_{_slugify(name)}"[:60]
    slug = base
    suffix = 2
    while db.scalar(select(Exercise).where(Exercise.slug == slug)):
        slug = f"{base[:57]}_{suffix}"
        suffix += 1

    exercise = Exercise(
        slug=slug,
        name=name,
        description=payload.description.strip(),
        patient_cue=payload.patient_cue.strip(),
        body_region=payload.body_region.strip() or "other",
        difficulty=payload.difficulty,
        # Not negotiable: camera tracking requires a movement model that only
        # exists for the built-in exercises. A written exercise is recorded as
        # completed by the patient, and the app says so on both sides.
        cv_supported=False,
        tracker_key=None,
        primary_metric=None,
        default_target_rom=None,
        created_by_therapist_id=therapist.id,
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise

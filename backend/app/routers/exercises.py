"""Read-only exercise catalogue.

Available to any authenticated user, but only a therapist can turn a catalogue
entry into a prescription.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Exercise, User
from ..schemas import ExerciseOut

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[Exercise]:
    return list(db.scalars(select(Exercise).order_by(Exercise.name)))

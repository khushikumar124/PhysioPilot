"""Authentication + role-based access control dependencies.

Every protected route resolves the caller through `get_current_user`, then
narrows with `require_patient` / `require_therapist`. Cross-tenant access is
blocked by `therapist_patient` (a therapist may only reach patients assigned
to them) - authorisation is never inferred from a client-supplied role.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import PatientProfile, PhysiotherapistProfile, User, UserRole
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _CREDENTIALS_ERROR
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise _CREDENTIALS_ERROR
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise _CREDENTIALS_ERROR
    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    return user


def require_therapist(user: User = Depends(get_current_user)) -> PhysiotherapistProfile:
    if user.role is not UserRole.physiotherapist or user.therapist_profile is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Physiotherapist access required")
    return user.therapist_profile


def require_patient(user: User = Depends(get_current_user)) -> PatientProfile:
    if user.role is not UserRole.patient or user.patient_profile is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Patient access required")
    return user.patient_profile


def therapist_patient(
    patient_id: int,
    therapist: PhysiotherapistProfile = Depends(require_therapist),
    db: Session = Depends(get_db),
) -> PatientProfile:
    """Resolve a patient the calling therapist is allowed to see.

    Returns 404 (not 403) for patients belonging to another therapist so the
    API does not leak the existence of other clinics' records.
    """
    patient = db.get(PatientProfile, patient_id)
    if patient is None or patient.assigned_therapist_id != therapist.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return patient

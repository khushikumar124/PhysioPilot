"""Pydantic request/response models. These are the API contract."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import PlanStatus, SessionStatus, UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    clinic_name: str | None = Field(default=None, max_length=160)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORMModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole


class MeOut(UserOut):
    """Current user plus the profile id relevant to their role."""

    patient_profile_id: int | None = None
    therapist_profile_id: int | None = None
    language: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


# --------------------------------------------------------------------------
# Exercises
# --------------------------------------------------------------------------
class ExerciseOut(ORMModel):
    id: int
    slug: str
    name: str
    description: str
    patient_cue: str
    body_region: str
    difficulty: str
    cv_supported: bool
    tracker_key: str | None
    primary_metric: str | None
    default_target_rom: float | None
    is_custom: bool = False


class ExerciseCreate(BaseModel):
    """A therapist writing their own exercise.

    Deliberately narrow: the clinician supplies the words, and nothing here can
    claim camera tracking. Tracking needs a movement model on the client, so a
    written exercise is always self-reported and the API decides that, not the
    caller.
    """

    name: str = Field(min_length=2, max_length=120)
    patient_cue: str = Field(min_length=3, max_length=500)
    description: str = Field(default="", max_length=1000)
    body_region: str = Field(default="other", max_length=40)
    difficulty: str = Field(default="easy", pattern="^(easy|moderate|hard)$")


# --------------------------------------------------------------------------
# Patients
# --------------------------------------------------------------------------
class PatientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    date_of_birth: date | None = None
    phone: str | None = Field(default=None, max_length=32)
    language: str = "en"
    notes: str | None = None


class PatientUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=32)
    notes: str | None = None
    language: str | None = None


class PatientOut(ORMModel):
    id: int
    name: str
    email: EmailStr
    date_of_birth: date | None
    phone: str | None
    language: str
    notes: str | None


class PatientSummary(BaseModel):
    """Row in the therapist's patient list."""

    id: int
    name: str
    condition: str | None
    active_plan_id: int | None
    adherence_pct: float | None
    quality_pct: float | None
    last_session_at: datetime | None
    trend: str  # improving | steady | declining | insufficient_data
    needs_attention: bool
    attention_reasons: list[str] = []


# --------------------------------------------------------------------------
# Plans / prescription
# --------------------------------------------------------------------------
class PrescribedExerciseIn(BaseModel):
    exercise_id: int
    sets: int = Field(ge=1, le=10)
    repetitions: int = Field(ge=1, le=100)
    hold_seconds: int | None = Field(default=None, ge=0, le=120)
    frequency_per_day: int = Field(default=1, ge=1, le=6)
    instructions: str = Field(default="", max_length=1000)
    target_rom: float | None = Field(default=None, ge=0, le=180)


class PrescribedExerciseOut(ORMModel):
    id: int
    exercise_id: int
    sets: int
    repetitions: int
    hold_seconds: int | None
    frequency_per_day: int
    instructions: str
    target_rom: float | None
    order_index: int
    active: bool
    exercise: ExerciseOut


class PlanCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    condition: str = Field(default="", max_length=160)
    start_date: date
    end_date: date | None = None
    items: list[PrescribedExerciseIn] = Field(min_length=1)


class PlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    condition: str | None = Field(default=None, max_length=160)
    start_date: date | None = None
    end_date: date | None = None
    status: PlanStatus | None = None
    items: list[PrescribedExerciseIn] | None = None


class PlanOut(ORMModel):
    id: int
    patient_id: int
    therapist_id: int
    title: str
    condition: str
    start_date: date
    end_date: date | None
    status: PlanStatus
    prescribed_exercises: list[PrescribedExerciseOut]


# --------------------------------------------------------------------------
# Sessions
# --------------------------------------------------------------------------
class SessionStart(BaseModel):
    prescribed_exercise_id: int


class RepIn(BaseModel):
    index: int = Field(ge=0)
    min_angle: float = Field(ge=0, le=360)
    max_angle: float = Field(ge=0, le=360)
    duration_seconds: float = Field(ge=0, le=600)
    peak_velocity: float | None = Field(default=None, ge=0)
    mean_visibility: float | None = Field(default=None, ge=0, le=1)


class SessionComplete(BaseModel):
    reps_attempted: int = Field(ge=0, le=500)
    tracking_mode: str = Field(default="self_reported", pattern="^(camera|self_reported)$")
    pose_coverage: float | None = Field(default=None, ge=0, le=1)
    reps: list[RepIn] = []
    notes: str | None = Field(default=None, max_length=500)


class RepOut(ORMModel):
    index: int
    min_angle: float
    max_angle: float
    rom: float
    duration_seconds: float
    valid: bool
    classification: str
    reason: str | None


class SessionOut(ORMModel):
    id: int
    patient_id: int
    prescribed_exercise_id: int
    started_at: datetime
    completed_at: datetime | None
    status: SessionStatus
    reps_prescribed: int
    reps_attempted: int
    reps_valid: int | None
    quality_score: float | None
    rom_max: float | None
    rom_mean: float | None
    tracking_mode: str
    pose_coverage: float | None
    feedback: str | None


class SessionResult(SessionOut):
    exercise_name: str
    reps: list[RepOut]
    # Short, plain-language lines shown/spoken to the patient on completion.
    patient_summary: list[str]


# --------------------------------------------------------------------------
# Patient-facing routine
# --------------------------------------------------------------------------
class RoutineItem(BaseModel):
    prescribed_exercise_id: int
    exercise: ExerciseOut
    sets: int
    repetitions: int
    hold_seconds: int | None
    instructions: str
    target_rom: float | None
    sessions_due_today: int
    sessions_done_today: int
    completed_today: bool


class TodayRoutine(BaseModel):
    patient_name: str
    plan_title: str | None
    condition: str | None
    items: list[RoutineItem]
    sessions_done_this_week: int
    sessions_due_this_week: int


# --------------------------------------------------------------------------
# Analytics
# --------------------------------------------------------------------------
class AdherenceOut(BaseModel):
    window_days: int
    sessions_due: int
    sessions_completed: int
    adherence_pct: float | None
    days_active: int
    current_streak_days: int


class ExercisePerformanceOut(BaseModel):
    exercise_id: int
    exercise_name: str
    cv_supported: bool
    sessions: int
    reps_attempted: int
    reps_valid: int | None
    quality_pct: float | None
    latest_rom: float | None
    best_rom: float | None
    target_rom: float | None
    trend: str


class ProgressPoint(BaseModel):
    session_id: int | None
    recorded_at: datetime
    value: float


class ProgressSeries(BaseModel):
    exercise_id: int
    exercise_name: str
    metric_type: str
    unit: str
    points: list[ProgressPoint]
    trend: str


class TherapistOverview(BaseModel):
    total_patients: int
    patients_on_active_plans: int
    sessions_completed_today: int
    patients_needing_attention: int


# --------------------------------------------------------------------------
# Assistant
# --------------------------------------------------------------------------
class AssistantAsk(BaseModel):
    message: str = Field(min_length=1, max_length=600)


class AssistantReply(BaseModel):
    reply: str
    source: str
    redirected: bool
    suggestions: list[str] = []


class AssistantTurn(ORMModel):
    id: int
    created_at: datetime
    user_message: str
    assistant_response: str

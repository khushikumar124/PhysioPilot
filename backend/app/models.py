"""Relational schema for PhysioPilot.

Hierarchy (deliberate, see docs/ARCHITECTURE.md):

    User -> PhysiotherapistProfile / PatientProfile
    RehabilitationPlan (authored by a therapist, owned by a patient)
      -> PrescribedExercise (references a catalogue Exercise)
        -> ExerciseSession (one patient attempt)
          -> SessionRep (per-repetition measurement)

Only a therapist may write plans / prescribed exercises. Patients write
sessions and reps. This is enforced in the routers via RBAC dependencies.
"""

from __future__ import annotations

import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    physiotherapist = "physiotherapist"
    patient = "patient"


class PlanStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    paused = "paused"


class SessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    patient_profile: Mapped[PatientProfile | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    therapist_profile: Mapped[PhysiotherapistProfile | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class PhysiotherapistProfile(Base):
    __tablename__ = "physiotherapist_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    clinic_name: Mapped[str | None] = mapped_column(String(160))
    registration_number: Mapped[str | None] = mapped_column(String(80))

    user: Mapped[User] = relationship(back_populates="therapist_profile")
    patients: Mapped[list[PatientProfile]] = relationship(back_populates="therapist")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    assigned_therapist_id: Mapped[int | None] = mapped_column(
        ForeignKey("physiotherapist_profiles.id"), index=True
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    # Reserved for multilingual voice/UI. Only "en" is implemented today.
    language: Mapped[str] = mapped_column(String(8), default="en")
    phone: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="patient_profile")
    therapist: Mapped[PhysiotherapistProfile | None] = relationship(back_populates="patients")
    plans: Mapped[list[RehabilitationPlan]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class Exercise(Base):
    """Catalogue of exercises a therapist may prescribe.

    `cv_supported` is the honest switch: only exercises with a real tracker
    implementation are tracked by camera. Everything else is self-reported.
    """

    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    # Short, plain-language cue shown/spoken to the patient.
    patient_cue: Mapped[str] = mapped_column(Text, default="")
    body_region: Mapped[str] = mapped_column(String(40), default="knee")
    difficulty: Mapped[str] = mapped_column(String(20), default="easy")
    cv_supported: Mapped[bool] = mapped_column(Boolean, default=False)
    # Which tracker the client should load; null when cv_supported is false.
    tracker_key: Mapped[str | None] = mapped_column(String(64))
    # Angle the tracker measures, e.g. "knee_flexion". Used for ROM trends.
    primary_metric: Mapped[str | None] = mapped_column(String(40))
    # Default ROM target in degrees for a repetition to count as "full range".
    default_target_rom: Mapped[float | None] = mapped_column(Float)


class RehabilitationPlan(Base):
    __tablename__ = "rehabilitation_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"), index=True)
    therapist_id: Mapped[int] = mapped_column(
        ForeignKey("physiotherapist_profiles.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    condition: Mapped[str] = mapped_column(String(160), default="")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[PlanStatus] = mapped_column(Enum(PlanStatus), default=PlanStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    patient: Mapped[PatientProfile] = relationship(back_populates="plans")
    therapist: Mapped[PhysiotherapistProfile] = relationship()
    prescribed_exercises: Mapped[list[PrescribedExercise]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PrescribedExercise.order_index"
    )


class PrescribedExercise(Base):
    __tablename__ = "prescribed_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("rehabilitation_plans.id"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    sets: Mapped[int] = mapped_column(Integer, default=3)
    repetitions: Mapped[int] = mapped_column(Integer, default=10)
    hold_seconds: Mapped[int | None] = mapped_column(Integer)
    # Sessions per day the therapist expects.
    frequency_per_day: Mapped[int] = mapped_column(Integer, default=1)
    instructions: Mapped[str] = mapped_column(Text, default="")
    # Optional per-patient ROM target; falls back to Exercise.default_target_rom.
    target_rom: Mapped[float | None] = mapped_column(Float)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    plan: Mapped[RehabilitationPlan] = relationship(back_populates="prescribed_exercises")
    exercise: Mapped[Exercise] = relationship()
    sessions: Mapped[list[ExerciseSession]] = relationship(back_populates="prescribed_exercise")


class ExerciseSession(Base):
    """One patient attempt at one prescribed exercise."""

    __tablename__ = "exercise_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"), index=True)
    prescribed_exercise_id: Mapped[int] = mapped_column(
        ForeignKey("prescribed_exercises.id"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.in_progress
    )

    # --- Session adherence (did they do the work?) ---
    reps_prescribed: Mapped[int] = mapped_column(Integer, default=0)
    reps_attempted: Mapped[int] = mapped_column(Integer, default=0)

    # --- Movement quality (how well was it done?) ---
    # Null when the exercise is not CV-tracked: we do not invent numbers.
    reps_valid: Mapped[int | None] = mapped_column(Integer)
    quality_score: Mapped[float | None] = mapped_column(Float)
    rom_max: Mapped[float | None] = mapped_column(Float)
    rom_mean: Mapped[float | None] = mapped_column(Float)

    tracking_mode: Mapped[str] = mapped_column(String(20), default="self_reported")
    # Fraction of frames with a usable pose; lets us flag unreliable captures.
    pose_coverage: Mapped[float | None] = mapped_column(Float)
    feedback: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    prescribed_exercise: Mapped[PrescribedExercise] = relationship(back_populates="sessions")
    reps: Mapped[list[SessionRep]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SessionRep.index"
    )


class SessionRep(Base):
    """Per-repetition measurement produced by the client-side tracker."""

    __tablename__ = "session_reps"
    __table_args__ = (UniqueConstraint("session_id", "index", name="uq_rep_index"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("exercise_sessions.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    min_angle: Mapped[float] = mapped_column(Float)
    max_angle: Mapped[float] = mapped_column(Float)
    rom: Mapped[float] = mapped_column(Float)
    duration_seconds: Mapped[float] = mapped_column(Float)
    peak_velocity: Mapped[float | None] = mapped_column(Float)
    mean_visibility: Mapped[float | None] = mapped_column(Float)

    # Filled by the server-side movement-quality layer (app/services/quality.py).
    valid: Mapped[bool] = mapped_column(Boolean, default=False)
    classification: Mapped[str] = mapped_column(String(40), default="unclassified")
    reason: Mapped[str | None] = mapped_column(String(160))

    session: Mapped[ExerciseSession] = relationship(back_populates="reps")


class ProgressMetric(Base):
    """Longitudinal, objective movement measurements (observed, not clinical)."""

    __tablename__ = "progress_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"), index=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("exercise_sessions.id"))
    metric_type: Mapped[str] = mapped_column(String(40))  # e.g. "rom_max", "quality_score"
    value: Mapped[float] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patient_profiles.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    user_message: Mapped[str] = mapped_column(Text)
    assistant_response: Mapped[str] = mapped_column(Text)
    # "llm" or "deterministic" - useful for evaluating assistant behaviour.
    source: Mapped[str] = mapped_column(String(20), default="deterministic")
    # True when the guardrail refused/redirected to the physiotherapist.
    redirected: Mapped[bool] = mapped_column(Boolean, default=False)

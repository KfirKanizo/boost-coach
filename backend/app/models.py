"""SQLAlchemy ORM models for the BoostCoach.fit schema.

Polymorphic design: ``DailyBoost.target_metrics`` / ``result_metrics`` and
``Exercise.name_translations`` are JSONB, allowing VISION_REP, DURATION,
and future DISTANCE_GPS boost types to coexist without schema migrations.
"""

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Timezone-aware UTC now, replacing the deprecated naive ``datetime.utcnow``."""
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    fitness_goals: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    fitness_styles: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    programs: Mapped[list["TrainingProgram"]] = relationship(
        back_populates="user", lazy="selectin"
    )
    boosts: Mapped[list["DailyBoost"]] = relationship(
        back_populates="user", lazy="selectin"
    )
    routines: Mapped[list["Routine"]] = relationship(
        back_populates="user", lazy="selectin"
    )
    workout_sessions: Mapped[list["WorkoutSession"]] = relationship(
        back_populates="user", lazy="selectin"
    )


class TrainingProgram(Base):
    """Minimal stub enabling the ``User.programs`` relationship.

    Full environments/program-generation logic lands in the
    program-generation milestone.
    """

    __tablename__ = "training_programs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped[User] = relationship(back_populates="programs")


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name_translations: Mapped[dict[str, str]] = mapped_column(
        JSONB, nullable=False
    )
    primary_muscle: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )
    movement_pattern: Mapped[str] = mapped_column(String, nullable=False)
    equipment_required: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )
    boost_type: Mapped[str] = mapped_column(String, nullable=False)
    animation_url: Mapped[str | None] = mapped_column(String, nullable=True)
    instructions: Mapped[list | None] = mapped_column(JSONB, nullable=True)


class DailyBoost(Base):
    __tablename__ = "daily_boosts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id")
    )
    status: Mapped[str] = mapped_column(String, default="pending")
    target_metrics: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False
    )
    result_metrics: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    scheduled_date: Mapped[date] = mapped_column(
        Date, index=True, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="boosts")
    exercise: Mapped[Exercise] = relationship(lazy="selectin")


class SwapLog(Base):
    __tablename__ = "swap_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    daily_boost_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("daily_boosts.id")
    )
    new_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id")
    )
    swap_reason: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class Routine(Base):
    """User-created custom workout routine with optional weekly schedule."""

    __tablename__ = "routines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    exercises: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    schedule_days: Mapped[list[int] | None] = mapped_column(
        JSONB, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    user: Mapped[User] = relationship(back_populates="routines")


class WorkoutSession(Base):
    """Logged workout completion — one row per finished session."""

    __tablename__ = "workout_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    session_type: Mapped[str] = mapped_column(String, nullable=False)
    total_reps: Mapped[int] = mapped_column(Integer, default=0)
    total_duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    exercise_count: Mapped[int] = mapped_column(Integer, default=0)
    verified_reps: Mapped[int] = mapped_column(Integer, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    user: Mapped[User] = relationship(back_populates="workout_sessions")

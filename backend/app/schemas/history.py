"""Workout history / completion request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── XP constants (shared with scoring logic) ────────────────────────────
XP_PER_REP = 10
XP_TARGET_BONUS = 50


def compute_xp(verified_reps: int, target_reps: int) -> int:
    """Effort-based XP: base XP per rep + flat bonus when target is met."""
    if verified_reps <= 0:
        return 0
    base = verified_reps * XP_PER_REP
    bonus = XP_TARGET_BONUS if verified_reps >= target_reps else 0
    return base + bonus


class WorkoutCompleteRequest(BaseModel):
    session_type: str = Field(
        ..., description="'single' for one exercise, 'flow' for multi-exercise"
    )
    total_reps: int = Field(0, ge=0)
    total_duration_seconds: int = Field(0, ge=0)
    exercise_count: int = Field(1, ge=1)
    verified_reps: int = Field(
        0, ge=0, description="Reps confirmed by the vision engine"
    )
    target_reps: int = Field(
        0, ge=0, description="Total target reps across all sets (for bonus)"
    )


class WorkoutSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_type: str
    total_reps: int
    total_duration_seconds: int
    exercise_count: int
    created_at: datetime
    xp_earned: int = 0


class WeeklyStatsResponse(BaseModel):
    sessions_this_week: int
    weekly_goal: int

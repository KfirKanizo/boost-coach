"""Workout history / completion request/response schemas."""

import math
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── XP constants (shared with scoring logic) ────────────────────────────
XP_PER_REP = 10
XP_TARGET_BONUS = 50
MAX_LEVEL = 50


def compute_xp(verified_reps: int, target_reps: int) -> int:
    """Effort-based XP: base XP per rep + flat bonus when target is met."""
    if verified_reps <= 0:
        return 0
    base = verified_reps * XP_PER_REP
    bonus = XP_TARGET_BONUS if verified_reps >= target_reps else 0
    return base + bonus


def compute_level(total_xp: int) -> int:
    """Derive the user's level from their cumulative XP.

    Formula: level = floor(sqrt(total_xp / 100)) + 1, capped at MAX_LEVEL.
    Level 1 requires 0 XP, level 2 requires 100, level 3 requires 400, etc.
    """
    return min(MAX_LEVEL, int(math.sqrt(total_xp / 100)) + 1)


def xp_for_level(level: int) -> int:
    """Total XP required to reach a given level."""
    return (level - 1) ** 2 * 100


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
    routine_id: UUID | None = Field(
        None, description="UUID of the routine if started from a custom flow"
    )


class WorkoutSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_type: str
    total_reps: int
    total_duration_seconds: int
    exercise_count: int
    verified_reps: int = 0
    xp_earned: int = 0
    created_at: datetime


class WeeklyStatsResponse(BaseModel):
    sessions_this_week: int
    weekly_goal: int


class GamificationStatsResponse(BaseModel):
    total_xp: int
    level: int
    xp_current_level: int
    xp_next_level: int
    full_routines: int
    single_exercises: int
    total_reps: int
    total_verified_reps: int
    current_streak: int
    weekly_goal: int
    sessions_this_week: int
    activity_days: list[str]

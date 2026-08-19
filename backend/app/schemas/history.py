"""Workout history / completion request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkoutCompleteRequest(BaseModel):
    session_type: str = Field(
        ..., description="'single' for one exercise, 'flow' for multi-exercise"
    )
    total_reps: int = Field(0, ge=0)
    total_duration_seconds: int = Field(0, ge=0)
    exercise_count: int = Field(1, ge=1)


class WorkoutSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_type: str
    total_reps: int
    total_duration_seconds: int
    exercise_count: int
    created_at: datetime


class WeeklyStatsResponse(BaseModel):
    sessions_this_week: int
    weekly_goal: int

"""Routine request/response schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoutineExerciseItem(BaseModel):
    exercise_id: str
    exercise_name: str
    movement_pattern: str
    sets: int = 3
    reps: int = 10
    rest_seconds: int = 60
    animation_url: Optional[str] = None
    instructions: Optional[list[str]] = None


class RoutineCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    exercises: list[RoutineExerciseItem] = Field(..., min_length=1)
    schedule_days: Optional[list[int]] = Field(
        None, description="Day-of-week schedule (0=Sun..6=Sat)"
    )


class RoutineUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    exercises: Optional[list[RoutineExerciseItem]] = Field(None, min_length=1)
    schedule_days: Optional[list[int]] = Field(None, description="0=Sun..6=Sat")


class RoutineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    exercises: list[dict[str, Any]]
    schedule_days: Optional[list[int]] = None
    created_at: datetime

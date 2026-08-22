"""Pre-built program request/response schemas."""

from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProgramExerciseEntry(BaseModel):
    exercise_id: str
    sets: int = Field(ge=1, le=20)
    target_reps_or_duration: int = Field(ge=1)
    rest_time_after_sec: int = Field(ge=0, default=60)
    rest_seconds: int = Field(ge=0, default=60)


class PreBuiltProgramResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    muscle_tags: List[str]
    equipment_category: str
    exercises: List[dict[str, Any]]
    is_active: bool


class PreBuiltProgramCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    muscle_tags: List[str] = []
    equipment_category: str = "gym"
    exercises: List[dict[str, Any]] = []
    is_active: bool = True


class PreBuiltProgramUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    muscle_tags: Optional[List[str]] = None
    equipment_category: Optional[str] = None
    exercises: Optional[List[dict[str, Any]]] = None
    is_active: Optional[bool] = None

"""Boost request/response schemas."""

from datetime import date
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.exercise import ExerciseResponse


class BoostCompleteRequest(BaseModel):
    result_metrics: Dict[str, Any] = Field(
        ...,
        description=(
            "Actual execution data from the edge AI "
            "(e.g., {'reps_completed': 15, 'duration_sec': 42})"
        ),
    )


class SyncItem(BaseModel):
    """A single offline-queued completion waiting to be flushed."""

    boost_id: UUID
    result_metrics: Dict[str, Any]


class SyncResultResponse(BaseModel):
    """Number of queued completions persisted by a bulk sync."""

    synced: int


class BoostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    target_metrics: Dict[str, Any]
    result_metrics: Optional[Dict[str, Any]]
    scheduled_date: date
    exercise: ExerciseResponse

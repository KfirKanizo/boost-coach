"""Exercise response schemas."""

from typing import Dict
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name_translations: Dict[str, str]
    primary_muscle: str
    movement_pattern: str
    equipment_required: str
    boost_type: str

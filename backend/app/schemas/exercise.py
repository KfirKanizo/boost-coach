"""Exercise response schemas."""

from typing import Dict, List, Optional
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
    animation_url: Optional[str] = None
    instructions: Optional[List[str]] = None
    is_active: bool = True


class ExerciseUpdateRequest(BaseModel):
    movement_pattern: Optional[str] = None
    is_active: Optional[bool] = None

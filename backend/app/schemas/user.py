"""User request/response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserProfileUpdateRequest(BaseModel):
    weight: float | None = Field(None, description="User weight in kg")
    height: float | None = Field(None, description="User height in cm")


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    weight: float | None
    height: float | None
    current_streak: int


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    is_admin: bool
    current_streak: int

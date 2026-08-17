"""User request/response schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserProfileUpdateRequest(BaseModel):
    gender: str | None = Field(None, description="User gender (male/female/other)")
    age: int | None = Field(None, ge=10, le=120, description="User age in years")
    weight: float | None = Field(None, description="User weight in kg")
    height: float | None = Field(None, description="User height in cm")
    fitness_goals: list[str] | None = Field(None, description="Selected fitness goals")
    fitness_styles: list[str] | None = Field(None, description="Selected workout styles")


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    gender: str | None
    age: int | None
    weight: float | None
    height: float | None
    current_streak: int
    fitness_goals: list[str] | None
    fitness_styles: list[str] | None


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    is_admin: bool
    current_streak: int

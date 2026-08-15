"""Auth request/response schemas."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email (OAuth identity)")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

"""Swap engine and coach schemas."""

from uuid import UUID

from pydantic import BaseModel, Field


class SwapRequest(BaseModel):
    boost_id: UUID
    swap_reason: str = Field(
        ...,
        description="Reason for swapping, e.g., 'no_equipment' or 'muscle_sore'",
    )


class CoachFeedbackResponse(BaseModel):
    llm_feedback: str
    new_streak: int
    is_fallback: bool = Field(
        False,
        description="True if LLM timed out and local fallback was used",
    )

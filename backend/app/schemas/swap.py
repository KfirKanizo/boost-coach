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


class ChatHistoryMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1, max_length=4000)


class CoachChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    system_prompt: str | None = Field(
        None,
        max_length=8000,
        description="Optional system prompt injected at the start of the conversation. "
        "When provided, the backend uses this instead of the hardcoded prompt.",
    )
    history: list[ChatHistoryMessage] = Field(
        default_factory=list,
        max_length=100,
        description="Prior conversation turns (user/assistant). Sent to the LLM "
        "as context before the current user message.",
    )


class CoachChatResponse(BaseModel):
    reply: str
    is_fallback: bool = Field(
        False,
        description="True if LLM timed out and local fallback was used",
    )

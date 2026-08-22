"""Push notification request/response schemas."""

from typing import Any, Dict, List
from uuid import UUID

from pydantic import BaseModel, Field


class PushSubscriptionRequest(BaseModel):
    fcm_token: str = Field(min_length=1)


class PushSendRequest(BaseModel):
    user_ids: List[UUID] = Field(default_factory=list)
    send_to_all: bool = Field(default=False)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=500)
    data: Dict[str, Any] = {}


class PushSendResponse(BaseModel):
    sent: int
    failed: int
    removed: int

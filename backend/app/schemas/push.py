"""Push notification request/response schemas."""

from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=1)
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)


class PushSendRequest(BaseModel):
    user_ids: List[UUID] = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=500)
    data: Dict[str, Any] = {}


class PushSendResponse(BaseModel):
    sent: int
    failed: int
    removed: int

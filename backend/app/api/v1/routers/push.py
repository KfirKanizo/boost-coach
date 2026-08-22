"""Web Push subscription and dispatch endpoints.

POST /api/v1/push/subscribe — save/update a Web Push subscription for the user.
POST /api/v1/push/send      — dispatch push notifications to a list of users (protected).
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models import PushSubscription, User
from app.schemas.push import (
    PushSendRequest,
    PushSendResponse,
    PushSubscriptionRequest,
)

router = APIRouter(prefix="/push", tags=["push"])
log = logging.getLogger(__name__)


def _get_vapid_private_key() -> str:
    if not settings.vapid_private_key:
        raise HTTPException(
            status_code=503,
            detail="VAPID_PRIVATE_KEY not configured on the server",
        )
    return settings.vapid_private_key


def _get_vapid_claims() -> dict:
    return {"sub": settings.vapid_claims_email}


# ── Subscribe ────────────────────────────────────────────────────────


@router.post("/subscribe", status_code=204)
async def subscribe(
    body: PushSubscriptionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Save or update the authenticated user's Web Push subscription.

    Uses ``endpoint`` as the unique key — if a subscription with the same
    endpoint already exists (from any user), it is replaced.
    """
    existing = await db.scalar(
        select(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint
        )
    )

    if existing:
        existing.user_id = user.id
        existing.p256dh = body.p256dh
        existing.auth = body.auth
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
        )
        db.add(sub)

    await db.commit()


# ── Send ─────────────────────────────────────────────────────────────


@router.post("/send", response_model=PushSendResponse)
async def send_push(
    body: PushSendRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushSendResponse:
    """Dispatch push notifications to a list of users or broadcast to all.

    When ``send_to_all`` is true, ``user_ids`` is ignored and all active
    subscriptions are targeted.  Stale subscriptions (404/410) are
    automatically cleaned up.
    """
    vapid_private_key = _get_vapid_private_key()
    vapid_claims = _get_vapid_claims()

    if body.send_to_all:
        rows = await db.scalars(select(PushSubscription))
    else:
        rows = await db.scalars(
            select(PushSubscription).where(
                PushSubscription.user_id.in_(body.user_ids)
            )
        )
    subscriptions = rows.all()

    sent = 0
    failed = 0
    removed = 0

    payload = json.dumps({
        "title": body.title,
        "body": body.body,
        "data": body.data,
    })

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc, "response", None)
            status_code = getattr(status, "status_code", None) if status else None
            if status_code in (404, 410):
                await db.delete(sub)
                removed += 1
                log.info("Removed stale push subscription %s", sub.id)
            else:
                failed += 1
                log.warning("Push delivery failed for %s: %s", sub.id, exc)

    await db.commit()

    return PushSendResponse(sent=sent, failed=failed, removed=removed)

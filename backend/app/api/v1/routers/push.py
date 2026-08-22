"""FCM push subscription and dispatch endpoints.

POST /api/v1/push/subscribe — save/update an FCM token for the user.
POST /api/v1/push/send      — dispatch push notifications to users (protected).
"""

import logging

import firebase_admin
from firebase_admin import credentials, messaging
from fastapi import APIRouter, Depends, HTTPException
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

# ── Firebase initialisation (lazy) ────────────────────────────────────

_fb_app = None


def _get_firebase_app():
    global _fb_app
    if _fb_app is not None:
        return _fb_app
    if not settings.firebase_credentials_path:
        raise HTTPException(
            status_code=503,
            detail="FIREBASE_CREDENTIALS_PATH not configured on the server",
        )
    cred = credentials.Certificate(settings.firebase_credentials_path)
    _fb_app = firebase_admin.initialize_app(cred)
    return _fb_app


# ── Subscribe ────────────────────────────────────────────────────────


@router.post("/subscribe", status_code=204)
async def subscribe(
    body: PushSubscriptionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Save or update the authenticated user's FCM token.

    Uses ``fcm_token`` as the unique key — if a subscription with the same
    token already exists, it is replaced with the new user.
    """
    existing = await db.scalar(
        select(PushSubscription).where(
            PushSubscription.fcm_token == body.fcm_token
        )
    )

    if existing:
        existing.user_id = user.id
    else:
        sub = PushSubscription(
            user_id=user.id,
            fcm_token=body.fcm_token,
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
    subscriptions are targeted.  Invalid tokens are automatically cleaned up.
    """
    _get_firebase_app()

    if body.send_to_all:
        rows = await db.scalars(select(PushSubscription))
    else:
        rows = await db.scalars(
            select(PushSubscription).where(
                PushSubscription.user_id.in_(body.user_ids)
            )
        )
    subscriptions = rows.all()

    if not subscriptions:
        return PushSendResponse(sent=0, failed=0, removed=0)

    tokens = [sub.fcm_token for sub in subscriptions]
    token_to_sub = {sub.fcm_token: sub for sub in subscriptions}

    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=body.title,
            body=body.body,
        ),
        data={k: str(v) for k, v in body.data.items()} if body.data else None,
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
    except Exception as exc:
        log.error("FCM multicast failed: %s", exc)
        return PushSendResponse(sent=0, failed=len(tokens), removed=0)

    sent = response.success_count
    failed = 0
    removed = 0

    for idx, resp in enumerate(response.responses):
        if not resp.success:
            token = tokens[idx]
            if resp.exception and getattr(resp.exception, "code", None) in (
                "registration-token-not-registered",
                "invalid-registration-token",
            ):
                sub = token_to_sub[token]
                await db.delete(sub)
                removed += 1
                log.info("Removed invalid FCM token %s", sub.id)
            else:
                failed += 1
                log.warning("FCM delivery failed for token %s: %s", token, resp.exception)

    await db.commit()
    return PushSendResponse(sent=sent, failed=failed, removed=removed)

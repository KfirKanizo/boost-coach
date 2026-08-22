"""Reusable push notification dispatch service.

Thin wrapper around Firebase Cloud Messaging that can be called from any
router or background task. Silently catches errors so the caller is never
affected by push delivery failures.
"""

import logging
from typing import Any, Dict, List
from uuid import UUID

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import PushSubscription

log = logging.getLogger(__name__)

_fb_app = None


def _get_firebase_app():
    global _fb_app
    if _fb_app is not None:
        return _fb_app
    if not settings.firebase_credentials_path:
        log.debug("FIREBASE_CREDENTIALS_PATH not set — skipping push dispatch")
        return None
    cred = credentials.Certificate(settings.firebase_credentials_path)
    _fb_app = firebase_admin.initialize_app(cred)
    return _fb_app


async def dispatch_push(
    db: AsyncSession,
    *,
    user_ids: List[UUID],
    title: str,
    body: str,
    data: Dict[str, Any] | None = None,
) -> int:
    """Send a push notification to all subscriptions for the given users.

    Returns the number of successfully delivered notifications.
    Never raises — all errors are caught and logged so the caller
    (typically a workout-save request) is unaffected.
    """
    app = _get_firebase_app()
    if app is None:
        return 0

    rows = await db.scalars(
        select(PushSubscription).where(
            PushSubscription.user_id.in_(user_ids)
        )
    )
    subscriptions = rows.all()
    if not subscriptions:
        return 0

    tokens = [sub.fcm_token for sub in subscriptions]
    token_to_sub = {sub.fcm_token: sub for sub in subscriptions}

    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data={k: str(v) for k, v in data.items()} if data else None,
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
    except Exception as exc:
        log.error("FCM multicast failed: %s", exc)
        return 0

    sent = response.success_count

    for idx, resp in enumerate(response.responses):
        if not resp.success:
            token = tokens[idx]
            if resp.exception and getattr(resp.exception, "code", None) in (
                "registration-token-not-registered",
                "invalid-registration-token",
            ):
                sub = token_to_sub[token]
                await db.delete(sub)
                log.info("Removed invalid FCM token %s", sub.id)
            else:
                log.warning("FCM delivery failed for token %s: %s", token, resp.exception)

    await db.commit()
    return sent

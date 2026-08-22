"""Reusable push notification dispatch service.

Thin wrapper around pywebpush that can be called from any router or
background task. Silently catches errors so the caller is never
affected by push delivery failures.
"""

import json
import logging
from typing import Any, Dict, List
from uuid import UUID

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import PushSubscription

log = logging.getLogger(__name__)


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
    if not settings.vapid_private_key:
        log.debug("VAPID_PRIVATE_KEY not set — skipping push dispatch")
        return 0

    rows = await db.scalars(
        select(PushSubscription).where(
            PushSubscription.user_id.in_(user_ids)
        )
    )
    subscriptions = rows.all()
    if not subscriptions:
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "data": data or {},
    })
    vapid_claims = {"sub": settings.vapid_claims_email}

    sent = 0
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims=vapid_claims,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc, "response", None)
            status_code = getattr(status, "status_code", None) if status else None
            if status_code in (404, 410):
                await db.delete(sub)
                log.info("Removed stale push subscription %s", sub.id)
            else:
                log.warning("Push delivery failed for %s: %s", sub.id, exc)

    await db.commit()
    return sent

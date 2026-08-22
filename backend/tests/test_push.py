"""Tests for push notification endpoints:

POST /api/v1/push/subscribe — save/update a push subscription.
POST /api/v1/push/send      — dispatch push notifications to users.
"""

import uuid

from app.models import PushSubscription, User

from helpers import login_headers

DEFAULT_EMAIL = "test@boostcoach.fit"


async def _seed_user(db_session, email: str = DEFAULT_EMAIL) -> User:
    user = User(email=email)
    db_session.add(user)
    await db_session.flush()
    return user


# ── POST /push/subscribe ─────────────────────────────────────────────


async def test_subscribe_creates_subscription(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/push/subscribe",
        headers=headers,
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-1",
            "p256dh": "test-p256dh-key",
            "auth": "test-auth-secret",
        },
    )
    assert resp.status_code == 204

    # Verify in DB
    sub = await db_session.scalar(
        select(PushSubscription).where(
            PushSubscription.endpoint == "https://fcm.googleapis.com/fcm/send/test-endpoint-1"
        )
    )
    assert sub is not None
    assert sub.p256dh == "test-p256dh-key"
    assert sub.auth == "test-auth-secret"


async def test_subscribe_updates_existing_endpoint(async_client, db_session) -> None:
    """Same endpoint from a different user should transfer ownership."""
    user1 = User(email="user1@push.test")
    user2 = User(email="user2@push.test")
    db_session.add_all([user1, user2])
    await db_session.flush()

    headers1 = await login_headers(async_client, db_session, "user1@push.test")
    await async_client.post(
        "/api/v1/push/subscribe",
        headers=headers1,
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/shared-endpoint",
            "p256dh": "key-v1",
            "auth": "auth-v1",
        },
    )

    headers2 = await login_headers(async_client, db_session, "user2@push.test")
    resp = await async_client.post(
        "/api/v1/push/subscribe",
        headers=headers2,
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/shared-endpoint",
            "p256dh": "key-v2",
            "auth": "auth-v2",
        },
    )
    assert resp.status_code == 204

    sub = await db_session.scalar(
        select(PushSubscription).where(
            PushSubscription.endpoint == "https://fcm.googleapis.com/fcm/send/shared-endpoint"
        )
    )
    assert sub is not None
    assert sub.user_id == user2.id
    assert sub.p256dh == "key-v2"


async def test_subscribe_requires_auth(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/push/subscribe",
        json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/no-auth",
            "p256dh": "key",
            "auth": "auth",
        },
    )
    assert resp.status_code == 401


# ── POST /push/send ──────────────────────────────────────────────────


async def test_send_push_no_vapid_returns_503(async_client, db_session) -> None:
    """Without VAPID_PRIVATE_KEY configured, /send should 503."""
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/push/send",
        headers=headers,
        json={
            "user_ids": [str(uuid.uuid4())],
            "title": "Test",
            "body": "Hello",
        },
    )
    assert resp.status_code == 503


async def test_send_push_no_subscriptions_returns_zeros(
    async_client, db_session
) -> None:
    """With VAPID configured but no subscriptions, sent=failed=removed=0."""
    from app.core.config import settings

    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    original_key = settings.vapid_private_key
    settings.vapid_private_key = "test-private-key"
    try:
        resp = await async_client.post(
            "/api/v1/push/send",
            headers=headers,
            json={
                "user_ids": [str(uuid.uuid4())],
                "title": "Test",
                "body": "Hello",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["sent"] == 0
        assert body["failed"] == 0
        assert body["removed"] == 0
    finally:
        settings.vapid_private_key = original_key


async def test_send_push_requires_auth(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/push/send",
        json={
            "user_ids": [str(uuid.uuid4())],
            "title": "Test",
            "body": "Hello",
        },
    )
    assert resp.status_code == 401


async def test_subscribe_persists_multiple_subscriptions(
    async_client, db_session
) -> None:
    """A user can have multiple subscriptions (different devices)."""
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    for i in range(3):
        resp = await async_client.post(
            "/api/v1/push/subscribe",
            headers=headers,
            json={
                "endpoint": f"https://fcm.googleapis.com/fcm/send/device-{i}",
                "p256dh": f"key-{i}",
                "auth": f"auth-{i}",
            },
        )
        assert resp.status_code == 204

    from sqlalchemy import func, select

    count = await db_session.scalar(
        select(func.count()).select_from(PushSubscription)
    )
    assert count == 3


# Need to import select for the DB queries in tests
from sqlalchemy import select

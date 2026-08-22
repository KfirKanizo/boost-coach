"""Tests for push notification endpoints:

POST /api/v1/push/subscribe — save/update an FCM token.
POST /api/v1/push/send      — dispatch push notifications to users.
"""

import uuid
from unittest.mock import AsyncMock, patch

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
        json={"fcm_token": "test-fcm-token-1"},
    )
    assert resp.status_code == 204

    from sqlalchemy import select

    sub = await db_session.scalar(
        select(PushSubscription).where(
            PushSubscription.fcm_token == "test-fcm-token-1"
        )
    )
    assert sub is not None


async def test_subscribe_updates_existing_fcm_token(async_client, db_session) -> None:
    """Same FCM token from a different user should transfer ownership."""
    user1 = User(email="user1@push.test")
    user2 = User(email="user2@push.test")
    db_session.add_all([user1, user2])
    await db_session.flush()

    headers1 = await login_headers(async_client, db_session, "user1@push.test")
    await async_client.post(
        "/api/v1/push/subscribe",
        headers=headers1,
        json={"fcm_token": "shared-fcm-token"},
    )

    headers2 = await login_headers(async_client, db_session, "user2@push.test")
    resp = await async_client.post(
        "/api/v1/push/subscribe",
        headers=headers2,
        json={"fcm_token": "shared-fcm-token"},
    )
    assert resp.status_code == 204

    from sqlalchemy import select

    sub = await db_session.scalar(
        select(PushSubscription).where(
            PushSubscription.fcm_token == "shared-fcm-token"
        )
    )
    assert sub is not None
    assert sub.user_id == user2.id


async def test_subscribe_requires_auth(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/push/subscribe",
        json={"fcm_token": "no-auth-token"},
    )
    assert resp.status_code == 401


# ── POST /push/send ──────────────────────────────────────────────────


async def test_send_push_no_firebase_returns_503(async_client, db_session) -> None:
    """Without FIREBASE_CREDENTIALS_PATH configured, /send should 503."""
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
    """With Firebase configured but no subscriptions, sent=failed=removed=0."""
    from app.core.config import settings

    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    original = settings.firebase_credentials_path
    settings.firebase_credentials_path = "/tmp/fake-creds.json"
    try:
        with patch("app.api.v1.routers.push._get_firebase_app", return_value=True):
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
        settings.firebase_credentials_path = original


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
            json={"fcm_token": f"device-token-{i}"},
        )
        assert resp.status_code == 204

    from sqlalchemy import func, select

    count = await db_session.scalar(
        select(func.count()).select_from(PushSubscription)
    )
    assert count == 3


# ── POST /push/send — send_to_all broadcast ─────────────────────────


async def test_send_push_broadcast_no_subscriptions(async_client, db_session) -> None:
    """send_to_all with no subscriptions in DB returns zeros."""
    from app.core.config import settings

    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    original = settings.firebase_credentials_path
    settings.firebase_credentials_path = "/tmp/fake-creds.json"
    try:
        with patch("app.api.v1.routers.push._get_firebase_app", return_value=True):
            resp = await async_client.post(
                "/api/v1/push/send",
                headers=headers,
                json={
                    "send_to_all": True,
                    "title": "Broadcast",
                    "body": "Hello everyone",
                },
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["sent"] == 0
    finally:
        settings.firebase_credentials_path = original


async def test_send_push_broadcast_no_firebase_returns_503(
    async_client, db_session
) -> None:
    """send_to_all without Firebase configured should 503."""
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/push/send",
        headers=headers,
        json={
            "send_to_all": True,
            "title": "Broadcast",
            "body": "Hello everyone",
        },
    )
    assert resp.status_code == 503


async def test_send_push_empty_user_ids_requires_send_to_all(
    async_client, db_session
) -> None:
    """Empty user_ids without send_to_all should still work (returns zeros)."""
    from app.core.config import settings

    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    original = settings.firebase_credentials_path
    settings.firebase_credentials_path = "/tmp/fake-creds.json"
    try:
        with patch("app.api.v1.routers.push._get_firebase_app", return_value=True):
            resp = await async_client.post(
                "/api/v1/push/send",
                headers=headers,
                json={
                    "user_ids": [],
                    "title": "Test",
                    "body": "Hello",
                },
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["sent"] == 0
    finally:
        settings.firebase_credentials_path = original

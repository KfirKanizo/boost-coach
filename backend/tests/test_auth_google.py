"""Tests for the POST /auth/google endpoint."""

import pytest
from unittest.mock import patch

from app.core.security import decode_access_token
from app.models import User

MOCK_ID_TOKEN = "fake-google-id-token"
MOCK_EMAIL = "alice@example.com"
MOCK_CLIENT_ID = "408983234494-j55u6qlk8d476pfn75ur9m5f5annefjm.apps.googleusercontent.com"


def _verified_payload(email: str = MOCK_EMAIL) -> dict:
    """Return what verify_oauth2_token would return on success."""
    return {"email": email, "sub": "1234567890", "aud": MOCK_CLIENT_ID}


async def test_google_login_creates_new_user(async_client, db_session) -> None:
    with patch("app.api.v1.routers.auth.google_id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = _verified_payload()

        resp = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": MOCK_ID_TOKEN},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    user_id = decode_access_token(body["access_token"])
    user = await db_session.get(User, user_id)
    assert user is not None
    assert user.email == MOCK_EMAIL
    assert user.hashed_password is None


async def test_google_login_returns_existing_user(async_client, db_session) -> None:
    existing = User(email=MOCK_EMAIL)
    db_session.add(existing)
    await db_session.flush()

    with patch("app.api.v1.routers.auth.google_id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = _verified_payload()

        resp = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": MOCK_ID_TOKEN},
        )

    assert resp.status_code == 200
    user_id = decode_access_token(resp.json()["access_token"])
    assert user_id == existing.id


async def test_google_login_rejects_invalid_token(async_client, db_session) -> None:
    with patch("app.api.v1.routers.auth.google_id_token.verify_oauth2_token") as mock_verify:
        mock_verify.side_effect = ValueError("Invalid token")

        resp = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": MOCK_ID_TOKEN},
        )

    assert resp.status_code == 401
    assert "Invalid Google token" in resp.json()["detail"]


async def test_google_login_rejects_missing_email(async_client, db_session) -> None:
    with patch("app.api.v1.routers.auth.google_id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = {"sub": "1234567890"}

        resp = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": MOCK_ID_TOKEN},
        )

    assert resp.status_code == 401
    assert "missing email" in resp.json()["detail"].lower()


async def test_google_login_normalizes_email(async_client, db_session) -> None:
    with patch("app.api.v1.routers.auth.google_id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = _verified_payload(email="  Alice@Example.COM  ")

        resp = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": MOCK_ID_TOKEN},
        )

    assert resp.status_code == 200
    user_id = decode_access_token(resp.json()["access_token"])
    user = await db_session.get(User, user_id)
    assert user is not None
    assert user.email == "alice@example.com"


async def test_google_login_token_authenticates_protected_endpoint(
    async_client, db_session
) -> None:
    with patch("app.api.v1.routers.auth.google_id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = _verified_payload()

        resp = await async_client.post(
            "/api/v1/auth/google",
            json={"id_token": MOCK_ID_TOKEN},
        )

    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = await async_client.get("/api/v1/users/me", headers=headers)

    assert me.status_code == 200
    assert me.json()["email"] == MOCK_EMAIL

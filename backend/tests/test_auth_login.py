"""Tests for the JWT login flow and the security module."""

import uuid

import pytest
from jwt import ExpiredSignatureError, InvalidSignatureError, InvalidTokenError

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token
from app.models import User

from helpers import login_headers

DEFAULT_MOCK_EMAIL = "test@boostcoach.fit"
SUBJECT = uuid.UUID("4f9c1b2a-1d3e-4f5a-9b7c-0d1e2f3a4b5c")


async def test_login_returns_jwt_for_seeded_user(async_client, db_session) -> None:
    user = User(email=DEFAULT_MOCK_EMAIL)
    db_session.add(user)
    await db_session.flush()

    resp = await async_client.post(
        "/api/v1/auth/login", json={"email": DEFAULT_MOCK_EMAIL}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert decode_access_token(body["access_token"]) == user.id


async def test_login_normalizes_email_case_and_whitespace(
    async_client, db_session
) -> None:
    user = User(email="Test@BoostCoach.fit")
    db_session.add(user)
    await db_session.flush()

    resp = await async_client.post(
        "/api/v1/auth/login", json={"email": "  TEST@boostcoach.fit  "}
    )

    assert resp.status_code == 200
    assert decode_access_token(resp.json()["access_token"]) == user.id


async def test_login_401_for_unknown_email(async_client, db_session) -> None:
    db_session.add(User(email=DEFAULT_MOCK_EMAIL))
    await db_session.flush()

    resp = await async_client.post(
        "/api/v1/auth/login", json={"email": "ghost@boostcoach.fit"}
    )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid email or password"


async def test_login_token_authenticates_protected_endpoint(
    async_client, db_session
) -> None:
    user = User(email=DEFAULT_MOCK_EMAIL)
    db_session.add(user)
    await db_session.flush()

    headers = await login_headers(async_client, db_session)
    resp = await async_client.get("/api/v1/users/me", headers=headers)

    assert resp.status_code == 200
    assert resp.json()["email"] == DEFAULT_MOCK_EMAIL


def test_create_and_decode_roundtrip() -> None:
    token = create_access_token(SUBJECT)
    assert decode_access_token(token) == SUBJECT


def test_decode_rejects_tampered_token() -> None:
    token = create_access_token(SUBJECT)
    with pytest.raises(InvalidSignatureError):
        decode_access_token(f"{token[:-2]}xx")


def test_decode_rejects_expired_token() -> None:
    token = create_access_token(SUBJECT, expires_minutes=-1)
    with pytest.raises(ExpiredSignatureError):
        decode_access_token(token)


def test_decode_rejects_garbage() -> None:
    with pytest.raises(InvalidTokenError):
        decode_access_token("not-a-jwt")


def test_decode_rejects_wrong_secret(monkeypatch) -> None:
    token = create_access_token(SUBJECT)
    monkeypatch.setattr(settings, "secret_key", "a-completely-different-secret")
    with pytest.raises(InvalidSignatureError):
        decode_access_token(token)

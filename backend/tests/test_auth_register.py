"""Tests for the POST /register endpoint."""

import pytest

from app.core.security import verify_password
from app.models import User


async def test_register_creates_user_with_hashed_password(
    async_client, db_session
) -> None:
    resp = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "new@boostcoach.fit", "password": "s3cure!pass"},
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "new@boostcoach.fit"
    assert "id" in body

    user = await db_session.get(User, body["id"])
    assert user is not None
    assert user.hashed_password is not None
    assert user.hashed_password != "s3cure!pass"
    assert verify_password("s3cure!pass", user.hashed_password)


async def test_register_rejects_duplicate_email(
    async_client, db_session
) -> None:
    db_session.add(User(email="dup@boostcoach.fit", hashed_password="x"))
    await db_session.flush()

    resp = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "dup@boostcoach.fit", "password": "s3cure!pass"},
    )

    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]


async def test_register_rejects_short_password(async_client, db_session) -> None:
    resp = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "short@boostcoach.fit", "password": "abc"},
    )

    assert resp.status_code == 422


async def test_register_rejects_invalid_email(async_client, db_session) -> None:
    resp = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "s3cure!pass"},
    )

    assert resp.status_code == 422


async def test_register_normalizes_email(
    async_client, db_session
) -> None:
    resp = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "  NEW@BoostCoach.fit  ", "password": "s3cure!pass"},
    )

    assert resp.status_code == 201
    assert resp.json()["email"] == "new@boostcoach.fit"

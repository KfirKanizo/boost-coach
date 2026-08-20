"""Tests for the RBAC auth dependencies and the admin router."""

import pytest
from fastapi import HTTPException

from app.api.deps import get_current_admin_user, get_current_user
from app.core.security import create_access_token
from app.models import Exercise, User, WorkoutSession

from helpers import login_headers

ADMIN_EMAIL = "admin@boostcoach.fit"
TEST_EMAIL = "test@boostcoach.fit"


async def test_current_user_resolves_from_valid_jwt(db_session) -> None:
    target = User(email="target@boostcoach.fit")
    db_session.add(target)
    await db_session.flush()

    token = create_access_token(target.id)
    user = await get_current_user(token=token, db=db_session)

    assert user.id == target.id


async def test_current_user_401_for_invalid_token(db_session) -> None:
    db_session.add(User(email=TEST_EMAIL))
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await get_current_user(token="not-a-jwt", db=db_session)
    assert exc.value.status_code == 401


async def test_current_user_401_for_unknown_subject(db_session) -> None:
    db_session.add(User(email=TEST_EMAIL))
    await db_session.flush()

    token = create_access_token("00000000-0000-0000-0000-000000000000")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(token=token, db=db_session)
    assert exc.value.status_code == 401


async def test_current_user_401_when_database_empty(db_session) -> None:
    token = create_access_token("00000000-0000-0000-0000-000000000000")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(token=token, db=db_session)
    assert exc.value.status_code == 401


async def test_admin_dependency_allows_admin(db_session) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    db_session.add(admin)
    await db_session.flush()

    user = await get_current_admin_user(user=admin)

    assert user.id == admin.id


async def test_admin_dependency_forbids_regular_user(db_session) -> None:
    regular = User(email=TEST_EMAIL, is_admin=False)
    db_session.add(regular)
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await get_current_admin_user(user=regular)
    assert exc.value.status_code == 403


async def test_admin_users_endpoint_lists_all_users(async_client, db_session) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    regular = User(email=TEST_EMAIL, is_admin=False)
    db_session.add_all([admin, regular])
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=ADMIN_EMAIL)
    resp = await async_client.get("/api/v1/admin/users", headers=headers)

    assert resp.status_code == 200
    emails = {row["email"] for row in resp.json()}
    assert emails == {ADMIN_EMAIL, TEST_EMAIL}
    by_email = {row["email"]: row for row in resp.json()}
    assert by_email[ADMIN_EMAIL]["is_admin"] is True
    assert by_email[TEST_EMAIL]["is_admin"] is False


async def test_admin_users_endpoint_forbids_regular_user(
    async_client, db_session
) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    regular = User(email=TEST_EMAIL, is_admin=False)
    db_session.add_all([admin, regular])
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=TEST_EMAIL)
    resp = await async_client.get("/api/v1/admin/users", headers=headers)

    assert resp.status_code == 403
    assert resp.json()["detail"] == "Admin privileges required"


async def test_admin_users_endpoint_401_without_token(async_client) -> None:
    resp = await async_client.get("/api/v1/admin/users")

    assert resp.status_code == 401


# ── Admin stats endpoint ─────────────────────────────────────────────


async def test_admin_stats_returns_metrics(async_client, db_session) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    user = User(email=TEST_EMAIL)
    db_session.add_all([admin, user])
    await db_session.flush()

    # Seed a workout session so total_workouts > 0.
    session = WorkoutSession(
        user_id=user.id,
        session_type="single",
        total_reps=20,
        total_duration_seconds=120,
        exercise_count=1,
        verified_reps=18,
        xp_earned=180,
    )
    db_session.add(session)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=ADMIN_EMAIL)
    resp = await async_client.get("/api/v1/admin/stats", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["total_users"] == 2
    assert body["total_workouts"] == 1
    assert "total_exercises" in body


async def test_admin_stats_forbids_regular_user(async_client, db_session) -> None:
    regular = User(email=TEST_EMAIL, is_admin=False)
    db_session.add(regular)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=TEST_EMAIL)
    resp = await async_client.get("/api/v1/admin/stats", headers=headers)

    assert resp.status_code == 403


# ── Admin exercise management ────────────────────────────────────────


async def test_admin_exercises_lists_all(async_client, db_session) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    db_session.add(admin)
    await db_session.flush()

    ex = Exercise(
        name_translations={"en": "Squat"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
        is_active=True,
    )
    db_session.add(ex)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=ADMIN_EMAIL)
    resp = await async_client.get("/api/v1/admin/exercises", headers=headers)

    assert resp.status_code == 200
    exercises = resp.json()
    assert len(exercises) >= 1
    names = {e["name_translations"]["en"] for e in exercises}
    assert "Squat" in names


async def test_admin_update_exercise_movement_pattern(
    async_client, db_session
) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    db_session.add(admin)
    await db_session.flush()

    ex = Exercise(
        name_translations={"en": "Lunge"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
        is_active=True,
    )
    db_session.add(ex)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=ADMIN_EMAIL)
    resp = await async_client.put(
        f"/api/v1/admin/exercises/{ex.id}",
        headers=headers,
        json={"movement_pattern": "hinge"},
    )

    assert resp.status_code == 200
    assert resp.json()["movement_pattern"] == "hinge"
    assert resp.json()["is_active"] is True


async def test_admin_update_exercise_deactivate(
    async_client, db_session
) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    db_session.add(admin)
    await db_session.flush()

    ex = Exercise(
        name_translations={"en": "Press"},
        primary_muscle="chest",
        movement_pattern="push",
        equipment_required="dumbbells",
        boost_type="VISION_REP",
        is_active=True,
    )
    db_session.add(ex)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=ADMIN_EMAIL)
    resp = await async_client.put(
        f"/api/v1/admin/exercises/{ex.id}",
        headers=headers,
        json={"is_active": False},
    )

    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


async def test_admin_update_exercise_404(async_client, db_session) -> None:
    admin = User(email=ADMIN_EMAIL, is_admin=True)
    db_session.add(admin)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=ADMIN_EMAIL)
    resp = await async_client.put(
        "/api/v1/admin/exercises/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json={"is_active": False},
    )

    assert resp.status_code == 404


async def test_admin_exercises_forbids_regular_user(
    async_client, db_session
) -> None:
    regular = User(email=TEST_EMAIL, is_admin=False)
    db_session.add(regular)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email=TEST_EMAIL)
    resp = await async_client.get("/api/v1/admin/exercises", headers=headers)

    assert resp.status_code == 403

"""Tests for routine CRUD endpoints:

GET    /api/v1/routines
POST   /api/v1/routines
PUT    /api/v1/routines/{id}
DELETE /api/v1/routines/{id}
"""

import uuid

from sqlalchemy import select

from app.models import Routine, User

from helpers import login_headers

DEFAULT_EMAIL = "test@boostcoach.fit"

# Valid UUIDs used as exercise_id fixtures in tests.
FIXTURE_EXERCISE_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"


async def _seed_user(db_session, email: str = DEFAULT_EMAIL) -> User:
    user = User(email=email)
    db_session.add(user)
    await db_session.flush()
    return user


async def _create_routine(
    async_client, headers, name: str = "Morning Flow"
) -> dict:
    resp = await async_client.post(
        "/api/v1/routines",
        headers=headers,
        json={
            "name": name,
            "exercises": [
                {
                    "exercise_id": FIXTURE_EXERCISE_ID,
                    "exercise_name": "Push-ups",
                    "movement_pattern": "push",
                    "sets": 3,
                    "reps": 10,
                    "rest_seconds": 60,
                }
            ],
            "schedule_days": [1, 3, 5],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_routine(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    body = await _create_routine(async_client, headers)
    assert body["name"] == "Morning Flow"
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["exercise_name"] == "Push-ups"
    assert body["schedule_days"] == [1, 3, 5]
    assert "id" in body


async def test_list_routines(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    await _create_routine(async_client, headers, "Flow A")
    await _create_routine(async_client, headers, "Flow B")

    resp = await async_client.get("/api/v1/routines", headers=headers)
    assert resp.status_code == 200
    routines = resp.json()
    assert len(routines) == 2
    names = {r["name"] for r in routines}
    assert "Flow A" in names
    assert "Flow B" in names


async def test_update_routine(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    routine = await _create_routine(async_client, headers)
    routine_id = routine["id"]

    resp = await async_client.put(
        f"/api/v1/routines/{routine_id}",
        headers=headers,
        json={"name": "Updated Flow", "schedule_days": [0, 6]},
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["name"] == "Updated Flow"
    assert updated["schedule_days"] == [0, 6]


async def test_delete_routine(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    routine = await _create_routine(async_client, headers)
    routine_id = routine["id"]

    resp = await async_client.delete(
        f"/api/v1/routines/{routine_id}", headers=headers
    )
    assert resp.status_code == 204

    resp = await async_client.get("/api/v1/routines", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 0


async def test_routine_404_for_foreign_routine(async_client, db_session) -> None:
    user = await _seed_user(db_session)
    other = User(email="other@boostcoach.fit")
    db_session.add(other)
    await db_session.flush()

    other_headers = await login_headers(async_client, db_session, "other@boostcoach.fit")
    routine = await _create_routine(async_client, other_headers, "Other Flow")
    routine_id = routine["id"]

    my_headers = await login_headers(async_client, db_session, DEFAULT_EMAIL)
    resp = await async_client.delete(
        f"/api/v1/routines/{routine_id}", headers=my_headers
    )
    assert resp.status_code == 404


async def test_list_routines_empty(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.get("/api/v1/routines", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_routine_requires_auth(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/routines",
        json={"name": "X", "exercises": [{"exercise_id": str(uuid.uuid4()), "exercise_name": "A", "movement_pattern": "push", "sets": 3, "reps": 10, "rest_seconds": 60}]},
    )
    assert resp.status_code == 401

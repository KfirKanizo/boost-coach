"""Tests for workout history endpoints:

POST /api/v1/history/complete
GET  /api/v1/history/weekly-stats
"""

from app.models import User

from helpers import login_headers

DEFAULT_EMAIL = "test@boostcoach.fit"


async def _seed_user(db_session, email: str = DEFAULT_EMAIL) -> User:
    user = User(email=email)
    db_session.add(user)
    await db_session.flush()
    return user


async def test_complete_workout_session(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/history/complete",
        headers=headers,
        json={
            "session_type": "flow",
            "total_reps": 60,
            "total_duration_seconds": 300,
            "exercise_count": 3,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["session_type"] == "flow"
    assert body["total_reps"] == 60
    assert body["total_duration_seconds"] == 300
    assert body["exercise_count"] == 3
    assert "id" in body


async def test_complete_single_exercise(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/history/complete",
        headers=headers,
        json={
            "session_type": "single",
            "total_reps": 30,
            "total_duration_seconds": 0,
            "exercise_count": 1,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["session_type"] == "single"
    assert resp.json()["total_reps"] == 30


async def test_weekly_stats_empty(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.get("/api/v1/history/weekly-stats", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["sessions_this_week"] == 0
    assert body["weekly_goal"] == 4


async def test_weekly_stats_counts_this_week(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    for _ in range(3):
        resp = await async_client.post(
            "/api/v1/history/complete",
            headers=headers,
            json={
                "session_type": "single",
                "total_reps": 10,
                "total_duration_seconds": 0,
                "exercise_count": 1,
            },
        )
        assert resp.status_code == 201

    resp = await async_client.get("/api/v1/history/weekly-stats", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["sessions_this_week"] == 3
    assert body["weekly_goal"] == 4


async def test_complete_requires_auth(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/history/complete",
        json={"session_type": "single", "total_reps": 5, "total_duration_seconds": 0, "exercise_count": 1},
    )
    assert resp.status_code == 401


async def test_weekly_stats_requires_auth(async_client) -> None:
    resp = await async_client.get("/api/v1/history/weekly-stats")
    assert resp.status_code == 401

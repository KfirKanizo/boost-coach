"""Tests for workout history endpoints:

POST /api/v1/history/complete
GET  /api/v1/history/weekly-stats
GET  /api/v1/history/stats
"""

from app.models import User
import sqlalchemy as sa

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
            "verified_reps": 60,
            "target_reps": 60,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["session_type"] == "flow"
    assert body["total_reps"] == 60
    assert body["total_duration_seconds"] == 300
    assert body["exercise_count"] == 3
    assert body["xp_earned"] == 650  # 60 * 10 + 50 bonus
    assert body["verified_reps"] == 60
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
            "verified_reps": 30,
            "target_reps": 10,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["session_type"] == "single"
    assert resp.json()["total_reps"] == 30
    assert resp.json()["xp_earned"] == 350  # 30 * 10 + 50 bonus


async def test_xp_zero_when_no_verified_reps(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/history/complete",
        headers=headers,
        json={
            "session_type": "single",
            "total_reps": 0,
            "total_duration_seconds": 60,
            "exercise_count": 1,
            "verified_reps": 0,
            "target_reps": 10,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["xp_earned"] == 0


async def test_xp_no_bonus_when_below_target(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.post(
        "/api/v1/history/complete",
        headers=headers,
        json={
            "session_type": "single",
            "total_reps": 5,
            "total_duration_seconds": 0,
            "exercise_count": 1,
            "verified_reps": 5,
            "target_reps": 10,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["xp_earned"] == 50  # 5 * 10, no bonus


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
                "verified_reps": 10,
                "target_reps": 10,
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


async def test_gamification_stats_empty(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    resp = await async_client.get("/api/v1/history/stats", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_xp"] == 0
    assert body["level"] == 1
    assert body["full_routines"] == 0
    assert body["single_exercises"] == 0
    assert body["sessions_this_week"] == 0
    assert body["activity_days"] == []


async def test_gamification_stats_after_workouts(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    # Complete 2 single-exercise workouts
    for _ in range(2):
        await async_client.post(
            "/api/v1/history/complete",
            headers=headers,
            json={
                "session_type": "single",
                "total_reps": 30,
                "total_duration_seconds": 120,
                "exercise_count": 1,
                "verified_reps": 30,
                "target_reps": 30,
            },
        )

    resp = await async_client.get("/api/v1/history/stats", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_xp"] == 700  # 2 * (30*10 + 50)
    assert body["level"] >= 2
    assert body["full_routines"] == 0
    assert body["single_exercises"] == 2
    assert body["total_reps"] == 60
    assert body["total_verified_reps"] == 60
    assert body["sessions_this_week"] == 2
    assert len(body["activity_days"]) >= 1


async def test_gamification_stats_counts_routine_vs_single(async_client, db_session) -> None:
    """Sessions with routine_id are 'full_routines'; without are 'single_exercises'."""
    from app.models import Routine, User

    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    # Create a routine in the DB
    user = (await db_session.execute(
        sa.select(User).where(User.email == DEFAULT_EMAIL)
    )).scalar_one()
    routine = Routine(user_id=user.id, name="Test Routine", exercises=[])
    db_session.add(routine)
    await db_session.commit()
    await db_session.refresh(routine)

    routine_id = str(routine.id)

    # 1 routine-based workout
    await async_client.post(
        "/api/v1/history/complete",
        headers=headers,
        json={
            "session_type": "flow",
            "total_reps": 50,
            "total_duration_seconds": 300,
            "exercise_count": 3,
            "verified_reps": 50,
            "target_reps": 50,
            "routine_id": routine_id,
        },
    )
    # 1 standalone workout
    await async_client.post(
        "/api/v1/history/complete",
        headers=headers,
        json={
            "session_type": "single",
            "total_reps": 10,
            "total_duration_seconds": 60,
            "exercise_count": 1,
            "verified_reps": 10,
            "target_reps": 10,
        },
    )

    resp = await async_client.get("/api/v1/history/stats", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["full_routines"] == 1
    assert body["single_exercises"] == 1


async def test_gamification_stats_requires_auth(async_client) -> None:
    resp = await async_client.get("/api/v1/history/stats")
    assert resp.status_code == 401

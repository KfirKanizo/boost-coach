"""Tests for offline sync endpoints:

PUT  /api/v1/boosts/{boost_id}/complete - single online completion.
POST /api/v1/boosts/sync                - bulk offline-queue flush.
"""

from datetime import date

from sqlalchemy import select

from app.models import DailyBoost, Exercise, User

from helpers import login_headers

DEFAULT_MOCK_EMAIL = "test@boostcoach.fit"


def _exercise(name: str) -> Exercise:
    return Exercise(
        name_translations={"en": name},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )


async def _seed_user(db_session, email: str = DEFAULT_MOCK_EMAIL) -> User:
    user = User(email=email)
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_boost(db_session, user: User, name: str = "Squat") -> DailyBoost:
    exercise = _exercise(name)
    db_session.add(exercise)
    await db_session.flush()
    boost = DailyBoost(
        user_id=user.id,
        exercise_id=exercise.id,
        target_metrics={"reps": 12},
        scheduled_date=date.today(),
        status="pending",
    )
    db_session.add(boost)
    await db_session.flush()
    return boost


async def test_complete_marks_boost_completed_and_stores_metrics(
    async_client, db_session
) -> None:
    user = await _seed_user(db_session)
    boost = await _seed_boost(db_session, user)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.put(
        f"/api/v1/boosts/{boost.id}/complete",
        headers=headers,
        json={"result_metrics": {"reps_completed": 15, "duration_sec": 42}},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(boost.id)
    assert body["status"] == "completed"
    assert body["result_metrics"] == {"reps_completed": 15, "duration_sec": 42}
    assert body["exercise"]["name_translations"]["en"] == "Squat"


async def test_complete_404_for_unknown_boost(async_client, db_session) -> None:
    user = await _seed_user(db_session)
    other_user = User(email="other@boostcoach.fit")
    db_session.add(other_user)
    await db_session.flush()
    foreign_boost = await _seed_boost(db_session, other_user)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.put(
        f"/api/v1/boosts/{foreign_boost.id}/complete",
        headers=headers,
        json={"result_metrics": {"reps_completed": 5}},
    )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Daily boost not found"


async def test_sync_marks_multiple_boosts_completed_in_one_batch(
    async_client, db_session
) -> None:
    user = await _seed_user(db_session)
    boost_a = await _seed_boost(db_session, user, "Squat")
    boost_b = await _seed_boost(db_session, user, "Lunge")

    headers = await login_headers(async_client, db_session)
    resp = await async_client.post(
        "/api/v1/boosts/sync",
        headers=headers,
        json=[
            {"boost_id": str(boost_a.id), "result_metrics": {"reps_completed": 10}},
            {"boost_id": str(boost_b.id), "result_metrics": {"reps_completed": 8}},
        ],
    )

    assert resp.status_code == 200
    assert resp.json() == {"synced": 2}

    rows = await db_session.execute(select(DailyBoost).order_by(DailyBoost.id))
    completed = {str(b.id): b for b in rows.scalars().all()}
    assert completed[str(boost_a.id)].status == "completed"
    assert completed[str(boost_a.id)].result_metrics == {"reps_completed": 10}
    assert completed[str(boost_b.id)].status == "completed"
    assert completed[str(boost_b.id)].result_metrics == {"reps_completed": 8}


async def test_sync_skips_foreign_and_unknown_boosts(
    async_client, db_session
) -> None:
    user = await _seed_user(db_session)
    mine = await _seed_boost(db_session, user, "Squat")
    other_user = User(email="other@boostcoach.fit")
    db_session.add(other_user)
    await db_session.flush()
    foreign = await _seed_boost(db_session, other_user, "Deadlift")

    headers = await login_headers(async_client, db_session)
    resp = await async_client.post(
        "/api/v1/boosts/sync",
        headers=headers,
        json=[
            {"boost_id": str(mine.id), "result_metrics": {"reps_completed": 6}},
            {
                "boost_id": str(foreign.id),
                "result_metrics": {"reps_completed": 20},
            },
            {
                "boost_id": "00000000-0000-0000-0000-000000000000",
                "result_metrics": {"reps_completed": 3},
            },
        ],
    )

    assert resp.status_code == 200
    assert resp.json() == {"synced": 1}

    await db_session.refresh(foreign)
    assert foreign.status == "pending"
    assert foreign.result_metrics is None


async def test_sync_empty_payload_returns_zero(async_client, db_session) -> None:
    await _seed_user(db_session)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.post("/api/v1/boosts/sync", headers=headers, json=[])

    assert resp.status_code == 200
    assert resp.json() == {"synced": 0}


async def test_sync_requires_a_user(async_client) -> None:
    resp = await async_client.post("/api/v1/boosts/sync", json=[])

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"

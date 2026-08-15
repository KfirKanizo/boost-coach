"""Tests for GET /api/v1/boosts/today."""

from datetime import date, timedelta

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


async def _seed_boost(db_session, user: User, exercise: Exercise, when: date) -> DailyBoost:
    boost = DailyBoost(
        user_id=user.id,
        exercise_id=exercise.id,
        target_metrics={"reps": 12},
        scheduled_date=when,
        status="pending",
    )
    db_session.add(boost)
    await db_session.flush()
    return boost


async def test_today_returns_only_todays_boosts_for_user(
    async_client, db_session
) -> None:
    owner = User(email=DEFAULT_MOCK_EMAIL)
    other = User(email="other@boostcoach.fit")
    today = _exercise("Today Squat")
    yesterday = _exercise("Yesterday Squat")
    db_session.add_all([owner, other, today, yesterday])
    await db_session.flush()

    boost_today = await _seed_boost(db_session, owner, today, date.today())
    await _seed_boost(db_session, owner, yesterday, date.today() - timedelta(days=1))
    await _seed_boost(db_session, other, today, date.today())

    headers = await login_headers(async_client, db_session)
    resp = await async_client.get("/api/v1/boosts/today", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert [b["id"] for b in body] == [str(boost_today.id)]
    assert body[0]["exercise"]["name_translations"]["en"] == "Today Squat"
    assert body[0]["exercise"]["movement_pattern"] == "squat"


async def test_today_returns_completed_and_pending_together(
    async_client, db_session
) -> None:
    user = User(email=DEFAULT_MOCK_EMAIL)
    pending_exercise = _exercise("Pending Squat")
    done_exercise = _exercise("Done Squat")
    db_session.add_all([user, pending_exercise, done_exercise])
    await db_session.flush()

    await _seed_boost(db_session, user, pending_exercise, date.today())
    done = await _seed_boost(db_session, user, done_exercise, date.today())
    done.status = "completed"
    await db_session.flush()

    headers = await login_headers(async_client, db_session)
    resp = await async_client.get("/api/v1/boosts/today", headers=headers)

    assert resp.status_code == 200
    statuses = {b["status"] for b in resp.json()}
    assert statuses == {"pending", "completed"}


async def test_today_selects_user_by_login_email(async_client, db_session) -> None:
    owner = User(email="someone-else@boostcoach.fit")
    default = User(email=DEFAULT_MOCK_EMAIL)
    exercise = _exercise("Squat")
    db_session.add_all([owner, default, exercise])
    await db_session.flush()

    await _seed_boost(db_session, owner, exercise, date.today())
    await _seed_boost(db_session, default, exercise, date.today())

    headers = await login_headers(async_client, db_session, email="someone-else@boostcoach.fit")
    resp = await async_client.get("/api/v1/boosts/today", headers=headers)

    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_today_requires_a_user(async_client) -> None:
    resp = await async_client.get("/api/v1/boosts/today")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"

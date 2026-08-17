"""Tests for the GET /exercises endpoint."""

from app.models import Exercise, User

from helpers import login_headers


async def test_list_exercises_returns_seeded_exercises(
    async_client, db_session
) -> None:
    user = User(email="test@boostcoach.fit")
    db_session.add(user)
    db_session.add(
        Exercise(
            name_translations={"en": "Push-Up", "he": "שכיבות שמיכה"},
            primary_muscle="chest",
            movement_pattern="push",
            equipment_required="bodyweight",
            boost_type="VISION_REP",
        )
    )
    await db_session.flush()

    headers = await login_headers(async_client, db_session)
    resp = await async_client.get("/api/v1/exercises", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    names = [ex["name_translations"]["en"] for ex in body]
    assert "Push-Up" in names


async def test_list_exercises_requires_auth(async_client, db_session) -> None:
    resp = await async_client.get("/api/v1/exercises")
    assert resp.status_code == 401

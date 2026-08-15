"""Regression tests for the Smart Swap engine service and endpoint."""

import uuid
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models import DailyBoost, Exercise, SwapLog, User
from app.services.swap_engine import swap_daily_boost

from helpers import login_headers


def _exercise(**overrides: object) -> Exercise:
    values: dict[str, object] = dict(
        name_translations={"en": "Exercise"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    values.update(overrides)
    return Exercise(**values)


async def _seed_boost(
    db_session,
    user: User,
    exercise: Exercise,
    *,
    scheduled_date: date | None = None,
) -> DailyBoost:
    boost = DailyBoost(
        user_id=user.id,
        exercise_id=exercise.id,
        target_metrics={"reps": 12, "sets": 3},
        scheduled_date=scheduled_date or date.today(),
    )
    db_session.add(boost)
    await db_session.flush()
    return boost


async def test_swap_picks_same_muscle_and_logs(db_session) -> None:
    user = User(email="swap@test.fit")
    original = _exercise(name_translations={"en": "Squat"})
    replacement = _exercise(name_translations={"en": "Bodyweight Squat"})
    unrelated = _exercise(
        name_translations={"en": "Deadlift"},
        primary_muscle="hamstrings",
    )
    db_session.add_all([user, original, replacement, unrelated])
    await db_session.flush()

    boost = await _seed_boost(db_session, user, original)

    swapped = await swap_daily_boost(
        db_session,
        boost_id=boost.id,
        swap_reason="muscle_sore",
        user_id=user.id,
    )

    assert swapped.exercise.id == replacement.id
    assert swapped.exercise_id == replacement.id

    log = await db_session.scalar(
        select(SwapLog).where(SwapLog.daily_boost_id == boost.id)
    )
    assert log is not None
    assert log.new_exercise_id == replacement.id
    assert log.swap_reason == "muscle_sore"
    assert log.user_id == user.id
    assert log.created_at is not None


async def test_no_equipment_filters_to_bodyweight(db_session) -> None:
    user = User(email="swap@equipment.fit")
    original = _exercise(
        name_translations={"en": "Dumbbell Squat"},
        equipment_required="dumbbells",
    )
    weighted = _exercise(
        name_translations={"en": "Barbell Squat"},
        equipment_required="barbell",
    )
    bodyweight = _exercise(
        name_translations={"en": "Bodyweight Squat"},
        equipment_required="bodyweight",
    )
    db_session.add_all([user, original, weighted, bodyweight])
    await db_session.flush()

    boost = await _seed_boost(db_session, user, original)

    swapped = await swap_daily_boost(
        db_session,
        boost_id=boost.id,
        swap_reason="no_equipment",
        user_id=user.id,
    )

    assert swapped.exercise.id == bodyweight.id


async def test_swap_prefers_same_boost_type_and_movement(db_session) -> None:
    user = User(email="swap@prefer.fit")
    original = _exercise(
        name_translations={"en": "Squat"},
        equipment_required="dumbbells",
    )
    same_variant = _exercise(
        name_translations={"en": "Goblet Squat"},
        equipment_required="kettlebells",
        boost_type="VISION_REP",
        movement_pattern="squat",
    )
    different_variant = _exercise(
        name_translations={"en": "Wall Sit"},
        equipment_required="bodyweight",
        boost_type="DURATION",
        movement_pattern="isometric",
    )
    db_session.add_all([user, original, same_variant, different_variant])
    await db_session.flush()

    boost = await _seed_boost(db_session, user, original)

    swapped = await swap_daily_boost(
        db_session,
        boost_id=boost.id,
        swap_reason="muscle_sore",
        user_id=user.id,
    )

    assert swapped.exercise.id == same_variant.id


async def test_swap_missing_boost_404(db_session) -> None:
    user = User(email="swap@missing.fit")
    db_session.add(user)
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await swap_daily_boost(
            db_session,
            boost_id=uuid.uuid4(),
            swap_reason="muscle_sore",
            user_id=user.id,
        )
    assert exc.value.status_code == 404


async def test_swap_foreign_boost_is_not_found(db_session) -> None:
    owner = User(email="swap@owner.fit")
    intruder = User(email="swap@intruder.fit")
    exercise = _exercise(name_translations={"en": "Squat"})
    db_session.add_all([owner, intruder, exercise])
    await db_session.flush()

    boost = await _seed_boost(db_session, owner, exercise)

    with pytest.raises(HTTPException) as exc:
        await swap_daily_boost(
            db_session,
            boost_id=boost.id,
            swap_reason="muscle_sore",
            user_id=intruder.id,
        )
    assert exc.value.status_code == 404


async def test_swap_without_candidates_404(db_session) -> None:
    user = User(email="swap@only.fit")
    sole = _exercise(name_translations={"en": "Only Squat"})
    db_session.add_all([user, sole])
    await db_session.flush()

    boost = await _seed_boost(db_session, user, sole)

    with pytest.raises(HTTPException) as exc:
        await swap_daily_boost(
            db_session,
            boost_id=boost.id,
            swap_reason="muscle_sore",
            user_id=user.id,
        )
    assert exc.value.status_code == 404
    assert "replacement" in str(exc.value.detail)


async def test_swap_endpoint_returns_updated_boost(async_client, db_session) -> None:
    user = User(email="swap@endpoint.fit")
    original = _exercise(
        name_translations={"en": "Dumbbell Squat"},
        equipment_required="dumbbells",
    )
    bodyweight = _exercise(
        name_translations={"en": "Bodyweight Squat"},
        equipment_required="bodyweight",
    )
    db_session.add_all([user, original, bodyweight])
    await db_session.flush()

    boost = await _seed_boost(db_session, user, original)

    headers = await login_headers(async_client, db_session, email="swap@endpoint.fit")
    resp = await async_client.post(
        "/api/v1/engine/swap",
        headers=headers,
        json={"boost_id": str(boost.id), "swap_reason": "no_equipment"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(boost.id)
    assert body["exercise"]["id"] == str(bodyweight.id)
    assert body["exercise"]["equipment_required"] == "bodyweight"
    assert body["exercise"]["primary_muscle"] == "quadriceps"

    log = await db_session.scalar(
        select(SwapLog).where(SwapLog.daily_boost_id == boost.id)
    )
    assert log is not None
    assert log.swap_reason == "no_equipment"


async def test_swap_endpoint_missing_boost_404(async_client, db_session) -> None:
    user = User(email="swap@missing-endpoint.fit")
    exercise = _exercise(name_translations={"en": "Squat"})
    db_session.add_all([user, exercise])
    await db_session.flush()

    headers = await login_headers(
        async_client, db_session, email="swap@missing-endpoint.fit"
    )
    resp = await async_client.post(
        "/api/v1/engine/swap",
        headers=headers,
        json={"boost_id": str(uuid.uuid4()), "swap_reason": "muscle_sore"},
    )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Daily boost not found"

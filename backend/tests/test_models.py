"""Regression tests for the polymorphic SQLAlchemy model layer.

Every model, its defaults, JSONB round-tripping, and async relationship
resolution are exercised against a transactional test database.
"""

import uuid
from datetime import date

from sqlalchemy import select

from app.models import DailyBoost, Exercise, SwapLog, TrainingProgram, User


async def test_user_defaults_and_fetch(db_session) -> None:
    user = User(email="test@boostcoach.fit")
    db_session.add(user)
    await db_session.flush()

    assert isinstance(user.id, uuid.UUID)
    assert user.current_streak == 0
    assert user.weight is None
    assert user.height is None
    assert user.created_at is not None
    assert user.created_at.tzinfo is not None

    fetched = await db_session.scalar(
        select(User).where(User.email == "test@boostcoach.fit")
    )
    assert fetched is not None
    assert fetched.id == user.id


async def test_exercise_jsonb_translations_round_trip(db_session) -> None:
    exercise = Exercise(
        name_translations={"en": "Squat", "he": "סקוואט"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    db_session.add(exercise)
    await db_session.flush()

    fetched = await db_session.scalar(
        select(Exercise).where(Exercise.id == exercise.id)
    )
    assert fetched is not None
    assert fetched.name_translations["he"] == "סקוואט"
    assert fetched.name_translations["en"] == "Squat"
    assert fetched.boost_type == "VISION_REP"


async def test_daily_boost_polymorphic_metrics_and_relationships(
    db_session,
) -> None:
    user = User(email="boost@boostcoach.fit")
    exercise = Exercise(
        name_translations={"en": "Squat"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    db_session.add_all([user, exercise])
    await db_session.flush()

    boost = DailyBoost(
        user_id=user.id,
        exercise_id=exercise.id,
        target_metrics={"reps": 15, "sets": 3},
        scheduled_date=date(2026, 8, 15),
    )
    db_session.add(boost)
    await db_session.flush()

    assert boost.status == "pending"
    assert boost.result_metrics is None
    assert boost.target_metrics["reps"] == 15

    # Relationships resolve in the async context (lazy="selectin").
    assert boost.user.email == "boost@boostcoach.fit"
    assert boost.exercise.primary_muscle == "quadriceps"

    loaded_user = await db_session.scalar(
        select(User).where(User.email == "boost@boostcoach.fit")
    )
    assert loaded_user is not None
    assert loaded_user.boosts[0].id == boost.id


async def test_complete_boost_saves_result_metrics(db_session) -> None:
    user = User(email="complete@boostcoach.fit")
    exercise = Exercise(
        name_translations={"en": "Plank"},
        primary_muscle="core",
        movement_pattern="isometric",
        equipment_required="bodyweight",
        boost_type="DURATION",
    )
    db_session.add_all([user, exercise])
    await db_session.flush()

    boost = DailyBoost(
        user_id=user.id,
        exercise_id=exercise.id,
        target_metrics={"duration_sec": 60},
        scheduled_date=date(2026, 8, 15),
    )
    db_session.add(boost)
    await db_session.flush()

    boost.status = "completed"
    boost.result_metrics = {"duration_sec": 42}
    await db_session.flush()

    fetched = await db_session.scalar(
        select(DailyBoost).where(DailyBoost.id == boost.id)
    )
    assert fetched is not None
    assert fetched.status == "completed"
    assert fetched.result_metrics == {"duration_sec": 42}


async def test_training_program_stub_and_user_programs(db_session) -> None:
    user = User(email="program@boostcoach.fit")
    db_session.add(user)
    await db_session.flush()

    program = TrainingProgram(user_id=user.id, name="Home Calisthenics")
    db_session.add(program)
    await db_session.flush()

    assert isinstance(program.id, uuid.UUID)

    loaded_user = await db_session.scalar(
        select(User).where(User.email == "program@boostcoach.fit")
    )
    assert loaded_user is not None
    assert loaded_user.programs[0].name == "Home Calisthenics"


async def test_swap_log_created_at_and_links(db_session) -> None:
    user = User(email="swap@boostcoach.fit")
    original = Exercise(
        name_translations={"en": "Dumbbell Row"},
        primary_muscle="back",
        movement_pattern="horizontal_pull",
        equipment_required="dumbbells",
        boost_type="VISION_REP",
    )
    replacement = Exercise(
        name_translations={"en": "Bodyweight Row"},
        primary_muscle="back",
        movement_pattern="horizontal_pull",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    db_session.add_all([user, original, replacement])
    await db_session.flush()

    boost = DailyBoost(
        user_id=user.id,
        exercise_id=original.id,
        target_metrics={"reps": 12},
        scheduled_date=date(2026, 8, 15),
    )
    db_session.add(boost)
    await db_session.flush()

    log = SwapLog(
        user_id=user.id,
        daily_boost_id=boost.id,
        new_exercise_id=replacement.id,
        swap_reason="no_equipment",
    )
    db_session.add(log)
    await db_session.flush()

    assert isinstance(log.id, uuid.UUID)
    assert log.swap_reason == "no_equipment"
    assert log.created_at is not None
    assert log.created_at.tzinfo is not None

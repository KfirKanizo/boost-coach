"""Idempotent development seeder.

Creates the two RBAC users (an admin and a regular test user), the initial
Exercise catalog, and a demo ``DailyBoost`` linked to the regular test user.
Safe to run multiple times — existing rows are left untouched.

Run inside the api container::

    docker compose run --rm api python -m scripts.seed
"""

import asyncio
from datetime import date

from sqlalchemy import select

from app.database import async_session_factory
from app.models import DailyBoost, Exercise, User

ADMIN_EMAIL = "admin@boostcoach.fit"
TEST_EMAIL = "test@boostcoach.fit"

EXERCISES = [
    Exercise(
        name_translations={"en": "Dumbbell Thrusters", "he": "דחיפות משקולות"},
        primary_muscle="full_body",
        movement_pattern="push",
        equipment_required="dumbbells",
        boost_type="VISION_REP",
    ),
    Exercise(
        name_translations={"en": "Bodyweight Thrusters", "he": "דחיפות משקל גוף"},
        primary_muscle="full_body",
        movement_pattern="push",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    ),
    Exercise(
        name_translations={"en": "Plank Hold", "he": "פלאנק"},
        primary_muscle="core",
        movement_pattern="isometric",
        equipment_required="bodyweight",
        boost_type="DURATION",
    ),
    Exercise(
        name_translations={"en": "Renegade Rows", "he": "חתירות רנגייד"},
        primary_muscle="back",
        movement_pattern="pull",
        equipment_required="dumbbells",
        boost_type="VISION_REP",
    ),
    Exercise(
        name_translations={"en": "Bodyweight Row", "he": "חתירה משקל גוף"},
        primary_muscle="back",
        movement_pattern="horizontal_pull",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    ),
    Exercise(
        name_translations={"en": "Squat", "he": "סקוואט"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    ),
    Exercise(
        name_translations={"en": "Goblet Squat", "he": "סקוואט גביע"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="kettlebells",
        boost_type="VISION_REP",
    ),
]


async def _get_or_create_user(
    session,
    email: str,
    *,
    is_admin: bool,
) -> User:
    user = await session.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, is_admin=is_admin)
        session.add(user)
        await session.flush()
    return user


async def seed() -> None:
    async with async_session_factory() as session:
        admin = await _get_or_create_user(session, ADMIN_EMAIL, is_admin=True)
        test_user = await _get_or_create_user(session, TEST_EMAIL, is_admin=False)

        existing_names = {
            exercise.name_translations.get("en")
            for exercise in (await session.scalars(select(Exercise))).all()
        }
        for exercise in EXERCISES:
            if exercise.name_translations.get("en") not in existing_names:
                session.add(exercise)
        await session.flush()

        demo_exercise = await session.scalar(
            select(Exercise).where(
                Exercise.name_translations["en"].astext == "Dumbbell Thrusters"
            )
        )
        if demo_exercise is None:
            raise RuntimeError("Dumbbell Thrusters missing after seeding exercises")

        today = date.today()
        has_boost = await session.scalar(
            select(DailyBoost.id).where(
                DailyBoost.user_id == test_user.id,
                DailyBoost.scheduled_date == today,
            )
        )
        if has_boost is None:
            session.add(
                DailyBoost(
                    user_id=test_user.id,
                    exercise_id=demo_exercise.id,
                    target_metrics={"sets": 4, "reps": 12},
                    scheduled_date=today,
                )
            )

        await session.commit()

    print(f"Seeded admin user  : {ADMIN_EMAIL} (is_admin=True)")
    print(f"Seeded test user   : {TEST_EMAIL} (is_admin=False)")
    print(f"Seeded {len(EXERCISES)} exercises and a demo DailyBoost for today.")


if __name__ == "__main__":
    asyncio.run(seed())

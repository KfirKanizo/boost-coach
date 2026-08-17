"""Seed the exercises table with 30 diverse movements.

Idempotent — safe to run repeatedly; already-seeded exercises are skipped.

Usage (inside the running container):
    docker exec boostcoach_api python -c "from seed import seed; import asyncio; asyncio.run(seed())"

Or as a standalone script:
    docker exec boostcoach_api python seed.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.database import async_session_factory
from app.models import Exercise

# ── 15 Gym exercises ────────────────────────────────────────────────────

GYM_EXERCISES: list[dict] = [
    {
        "name_translations": {"en": "Barbell Back Squat", "he": "סקוואט גב עם מוט"},
        "primary_muscle": "legs",
        "movement_pattern": "squat",
        "equipment_required": "barbell",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Barbell Bench Press", "he": "לחיצת חזה עם מוט"},
        "primary_muscle": "chest",
        "movement_pattern": "push",
        "equipment_required": "barbell",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Barbell Deadlift", "he": "דדליפט עם מוט"},
        "primary_muscle": "back",
        "movement_pattern": "hinge",
        "equipment_required": "barbell",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Barbell Overhead Press", "he": "לחיצת כתפיים עם מוט"},
        "primary_muscle": "shoulders",
        "movement_pattern": "push",
        "equipment_required": "barbell",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Barbell Bent-Over Row", "he": "שכיבות שמירה עם מוט"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "barbell",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Barbell Hip Thrust", "he": "דחיפת ירך עם מוט"},
        "primary_muscle": "glutes",
        "movement_pattern": "hinge",
        "equipment_required": "barbell",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Dumbbell Bicep Curl", "he": "כפיפת ביצפס עם משקולות"},
        "primary_muscle": "biceps",
        "movement_pattern": "pull",
        "equipment_required": "dumbbells",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Dumbbell Lateral Raise", "he": "הרמת כתפיים צידית עם משקולות"},
        "primary_muscle": "shoulders",
        "movement_pattern": "push",
        "equipment_required": "dumbbells",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Dumbbell Goblet Squat", "he": "סקוואט גובלט עם משקולת"},
        "primary_muscle": "legs",
        "movement_pattern": "squat",
        "equipment_required": "dumbbells",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Dumbbell Romanian Deadlift", "he": "דדליפט רומני עם משקולות"},
        "primary_muscle": "hamstrings",
        "movement_pattern": "hinge",
        "equipment_required": "dumbbells",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Cable Face Pull", "he": "משיכת פנים עם כבלים"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "cables",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Cable Woodchop", "he": "כירור כבלים"},
        "primary_muscle": "core",
        "movement_pattern": "rotation",
        "equipment_required": "cables",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Cable Tricep Pushdown", "he": "דחיקת טרייספס עם כבלים"},
        "primary_muscle": "triceps",
        "movement_pattern": "push",
        "equipment_required": "cables",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Machine Leg Press", "he": "לחיצת רגליים עם מכונה"},
        "primary_muscle": "legs",
        "movement_pattern": "squat",
        "equipment_required": "machine",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Machine Leg Curl", "he": "כפיפת רגליים עם מכונה"},
        "primary_muscle": "hamstrings",
        "movement_pattern": "pull",
        "equipment_required": "machine",
        "boost_type": "VISION_REP",
    },
]

# ── 15 Home / Calisthenics exercises ────────────────────────────────────

HOME_EXERCISES: list[dict] = [
    {
        "name_translations": {"en": "Push-Up", "he": "שכיבות שמיכה"},
        "primary_muscle": "chest",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Bodyweight Squat", "he": "סקוואט בלי משקל"},
        "primary_muscle": "legs",
        "movement_pattern": "squat",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Pull-Up", "he": "מצבת"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Bodyweight Lunges", "he": "רצועות בלי משקל"},
        "primary_muscle": "legs",
        "movement_pattern": "squat",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Diamond Push-Up", "he": "שכיבות שמיכה יהלום"},
        "primary_muscle": "chest",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Pike Push-Up", "he": "שכיבות שמיכה פיק"},
        "primary_muscle": "shoulders",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Glute Bridge", "he": "גשר גלוטוס"},
        "primary_muscle": "glutes",
        "movement_pattern": "hinge",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Calf Raises", "he": "הרמת עקבים"},
        "primary_muscle": "calves",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Inverted Row", "he": "שכיבת שמירה הפוכה"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Plank", "he": "פלאנק"},
        "primary_muscle": "core",
        "movement_pattern": "isometric",
        "equipment_required": "bodyweight",
        "boost_type": "DURATION",
    },
    {
        "name_translations": {"en": "Wall Sit", "he": "ישיבה על קיר"},
        "primary_muscle": "legs",
        "movement_pattern": "isometric",
        "equipment_required": "bodyweight",
        "boost_type": "DURATION",
    },
    {
        "name_translations": {"en": "Side Plank", "he": "פלאנק צדדי"},
        "primary_muscle": "core",
        "movement_pattern": "isometric",
        "equipment_required": "bodyweight",
        "boost_type": "DURATION",
    },
    {
        "name_translations": {"en": "Hollow Body Hold", "he": "שימור גוף חלול"},
        "primary_muscle": "core",
        "movement_pattern": "isometric",
        "equipment_required": "bodyweight",
        "boost_type": "DURATION",
    },
    {
        "name_translations": {"en": "Resistance Band Chest Press", "he": "לחיצת חזה עם רצועת התנגדות"},
        "primary_muscle": "chest",
        "movement_pattern": "push",
        "equipment_required": "resistance_band",
        "boost_type": "VISION_REP",
    },
    {
        "name_translations": {"en": "Resistance Band Row", "he": "שכיבות שמירה עם רצועת התנגדות"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "resistance_band",
        "boost_type": "VISION_REP",
    },
]

ALL_EXERCISES = GYM_EXERCISES + HOME_EXERCISES


async def seed() -> None:
    """Insert exercises that are not yet present (idempotent)."""
    async with async_session_factory() as session:
        result = await session.execute(select(Exercise))
        existing_names = {
            row[0].name_translations["en"]
            for row in result.all()
            if row[0].name_translations.get("en")
        }

        added = 0
        skipped = 0
        for ex in ALL_EXERCISES:
            en = ex["name_translations"]["en"]
            if en in existing_names:
                skipped += 1
                continue
            session.add(Exercise(**ex))
            added += 1

        await session.commit()

        print(f"Done — added {added} new exercise(s), skipped {skipped} already present.")
        print(f"Total in database: {len(existing_names) + added}")


if __name__ == "__main__":
    asyncio.run(seed())

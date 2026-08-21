"""One-shot production script to fix exercise tags and insert 5 new base exercises.

Run inside the api container on production::

    docker compose run --rm api python -m scripts.sync_prod_exercises

Idempotent — safe to run multiple times.  Existing exercises are matched by
UUID (updates) or English name (inserts) and skipped if already correct.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

# ── Ensure the backend root is on sys.path so ``app.*`` imports resolve ──
_backend_root = str(Path(__file__).resolve().parent.parent)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from sqlalchemy import select, update  # noqa: E402

from app.database import async_session_factory  # noqa: E402
from app.models import Exercise  # noqa: E402

# ── Task 1: Fix primary_muscle for 8 existing exercises (by UUID) ───────
# 5 triceps, 3 hamstrings
TAG_FIXES: dict[str, str] = {
    # Cable Triceps Pushdown → triceps
    "01c26787-2c59-4fdf-8cf1-f5446edb31e7": "triceps",
    # Dumbbell Lying Triceps Extension → triceps
    "1771feaa-133c-4da6-acc7-3e44eced6162": "triceps",
    # Triceps Dip → triceps
    "36d99060-b18e-4f66-8080-ac942cc1afe0": "triceps",
    # Bench Dip → triceps
    "45ed8166-7577-4775-9c46-39b626fb20c8": "triceps",
    # Overhead Triceps Extension → triceps
    "5b31af7e-4311-4071-90f8-eaab4cace425": "triceps",
    # Romanian Deadlift → hamstrings
    "4097080f-6d5f-4226-b97b-a00598d872c9": "hamstrings",
    # Kettlebell Swing → hamstrings
    "591a81c5-350b-4be3-8272-6da2f121caa7": "hamstrings",
    # Lying Leg Curl → hamstrings
    "a9772857-a86a-4d02-ba04-99fa72b77302": "hamstrings",
}

# ── Task 2: Insert 5 new foundational exercises ─────────────────────────
NEW_EXERCISES: list[dict] = [
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Bodyweight Squat"},
        "primary_muscle": "quadriceps",
        "movement_pattern": "squat",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0043&resolution=360",
        "instructions": [
            "Stand with your feet shoulder-width apart, toes pointing forward.",
            "Keep your chest up and core engaged.",
            "Push your hips back and bend your knees to lower your body as if sitting in a chair.",
            "Keep your weight on your heels and ensure your knees don't go past your toes.",
            "Lower until your thighs are parallel to the ground or as far as comfortable.",
            "Push through your heels to return to the starting position.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Dumbbell Shoulder Press"},
        "primary_muscle": "shoulders",
        "movement_pattern": "push",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0379&resolution=360",
        "instructions": [
            "Stand or sit with a dumbbell in each hand, resting at shoulder height.",
            "Your palms should be facing forward and elbows bent.",
            "Press the dumbbells straight up overhead until your arms are fully extended.",
            "Slowly lower the dumbbells back to the starting position at shoulder height.",
            "Keep your core engaged to prevent arching your lower back.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Glute Bridge"},
        "primary_muscle": "glutes",
        "movement_pattern": "hinge",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0456&resolution=360",
        "instructions": [
            "Lie flat on your back with your knees bent and feet flat on the ground, hip-width apart.",
            "Place your arms at your sides with your palms facing down.",
            "Engage your core and squeeze your glutes.",
            "Push through your heels to lift your hips off the ground until your body forms a straight line from knees to shoulders.",
            "Hold for a second at the top, then slowly lower your hips back to the ground.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Sit-Up"},
        "primary_muscle": "core",
        "movement_pattern": "core",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0729&resolution=360",
        "instructions": [
            "Lie flat on your back with your knees bent and feet flat on the ground.",
            "Place your hands behind your head or crossed over your chest.",
            "Engage your core and use your abdominal muscles to lift your upper body off the ground.",
            "Sit all the way up until your chest is close to your knees.",
            "Slowly lower your upper body back to the starting position.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Dumbbell Row"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0292&resolution=360",
        "instructions": [
            "Stand next to a bench and place one knee and the same-side hand on it for support.",
            "Hold a dumbbell in the other hand, letting it hang straight down.",
            "Keep your back straight and nearly parallel to the floor.",
            "Pull the dumbbell up towards your torso, keeping your elbow close to your body.",
            "Squeeze your back muscles at the top, then slowly lower the dumbbell.",
        ],
        "is_active": True,
    },
]


async def sync() -> None:
    async with async_session_factory() as session:
        # ── Task 1: Fix tags by UUID ───────────────────────────────────
        updates_count = 0
        for ex_id, muscle in TAG_FIXES.items():
            result = await session.execute(
                update(Exercise)
                .where(Exercise.id == uuid.UUID(ex_id))
                .values(primary_muscle=muscle)
            )
            updates_count += result.rowcount

        # ── Task 2: Insert new exercises (skip if name already exists) ─
        inserts_count = 0
        for ex_data in NEW_EXERCISES:
            existing = await session.execute(
                select(Exercise).where(
                    Exercise.name_translations["en"].astext
                    == ex_data["name_translations"]["en"]
                )
            )
            if not existing.scalar_one_or_none():
                session.add(Exercise(**ex_data))
                inserts_count += 1

        await session.commit()
        print(f"Updated {updates_count} exercise tags.")
        print(f"Inserted {inserts_count} new exercises.")


if __name__ == "__main__":
    asyncio.run(sync())

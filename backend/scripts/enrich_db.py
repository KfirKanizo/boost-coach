"""Insert missing foundational bodyweight exercises into the database.

Run inside the api container::

    docker compose run --rm api python -m scripts.enrich_db

Idempotent — safe to run multiple times.  Existing exercises are matched by
English name and skipped if already present.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

_backend_root = str(Path(__file__).resolve().parent.parent)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from sqlalchemy import select  # noqa: E402

from app.database import async_session_factory  # noqa: E402
from app.models import Exercise  # noqa: E402

EXERCISES: list[dict] = [
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Pike Push-Up"},
        "primary_muscle": "shoulders",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0685&resolution=360",
        "instructions": [
            "Start in a high plank position with your hands slightly wider than shoulder-width apart.",
            "Walk your feet forward and raise your hips high so your body forms an inverted V shape.",
            "Keep your head between your arms and look back toward your feet.",
            "Bend your elbows to lower the top of your head toward the floor.",
            "Press through your palms to push back up to the inverted V position.",
            "Keep your core engaged and legs straight throughout the movement.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Bodyweight Lunge"},
        "primary_muscle": "quadriceps",
        "movement_pattern": "squat",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0060&resolution=360",
        "instructions": [
            "Stand tall with your feet hip-width apart and arms at your sides.",
            "Step forward with your right foot about two to three feet.",
            "Lower your body by bending both knees until your back knee hovers just above the ground.",
            "Your front knee should be directly above your ankle, not pushing past your toes.",
            "Push through the heel of your front foot to return to the starting position.",
            "Alternate legs and repeat for the desired number of reps.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Bulgarian Split Squat"},
        "primary_muscle": "quadriceps",
        "movement_pattern": "squat",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0114&resolution=360",
        "instructions": [
            "Stand about two feet in front of a bench or sturdy chair.",
            "Place the top of your left foot on the bench behind you.",
            "Keep your torso upright and core braced.",
            "Bend your right knee to lower your body until your right thigh is parallel to the floor.",
            "Your front knee should track over your toes without caving inward.",
            "Push through your right heel to drive back up to the starting position.",
            "Complete all reps on one side before switching legs.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Bodyweight Calf Raise"},
        "primary_muscle": "calves",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=1373&resolution=360",
        "instructions": [
            "Stand with your feet hip-width apart on a flat surface or the edge of a step.",
            "You can hold onto a wall or chair for balance.",
            "Slowly press through the balls of your feet to raise your heels as high as possible.",
            "Hold the top position for a one-count, squeezing your calf muscles.",
            "Lower your heels back down in a controlled manner.",
            "Keep the movement smooth -- avoid bouncing at the bottom.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Mountain Climber"},
        "primary_muscle": "core",
        "movement_pattern": "core",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0616&resolution=360",
        "instructions": [
            "Start in a high plank position with your hands directly under your shoulders.",
            "Keep your body in a straight line from head to heels.",
            "Drive your right knee toward your chest as quickly as possible.",
            "Return your right leg to the plank position while simultaneously driving your left knee forward.",
            "Continue alternating legs in a controlled, rhythmic motion.",
            "Keep your hips level and core tight throughout -- avoid letting your hips pike up.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Burpee"},
        "primary_muscle": "full_body",
        "movement_pattern": "isometric",
        "equipment_required": "bodyweight",
        "boost_type": "DURATION",
        "animation_url": None,
        "instructions": [
            "Stand with your feet shoulder-width apart and arms at your sides.",
            "Drop into a squat position and place your hands on the floor in front of you.",
            "Kick your feet back into a high plank position.",
            "Perform a push-up by lowering your chest to the floor and pressing back up.",
            "Jump your feet back toward your hands, returning to the squat position.",
            "Explode upward into a jump with your arms overhead.",
            "Land softly and immediately begin the next repetition.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Standard Push-Up"},
        "primary_muscle": "chest",
        "movement_pattern": "push",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": "https://exercisedb.p.rapidapi.com/image?exerciseId=0662&resolution=360",
        "instructions": [
            "Lie face-down on the floor with your hands placed slightly wider than shoulder-width apart.",
            "Extend your legs behind you with your toes on the ground.",
            "Your body should form a straight line from your head through your spine to your heels.",
            "Brace your core and glutes before you begin.",
            "Bend your elbows to lower your chest until it is a few inches from the floor.",
            "Keep your elbows at roughly a 45-degree angle to your torso.",
            "Press through your palms to push back up to the starting position.",
            "Repeat without letting your hips sag or rise during the movement.",
        ],
        "is_active": True,
    },
]


async def enrich() -> None:
    async with async_session_factory() as session:
        existing_names = {
            ex.name_translations.get("en")
            for ex in (await session.scalars(select(Exercise))).all()
        }

        inserts = 0
        for ex_data in EXERCISES:
            en_name = ex_data["name_translations"]["en"]
            if en_name not in existing_names:
                session.add(Exercise(**ex_data))
                inserts += 1

        await session.commit()
        print(f"Inserted {inserts} new exercises.")


if __name__ == "__main__":
    asyncio.run(enrich())

"""Insert missing foundational bodyweight exercises and pre-built programs.

Run inside the api container::

    docker compose run --rm api python -m scripts.enrich_db

Idempotent — safe to run multiple times.  Existing exercises are matched by
English name and skipped if already present.  Pre-built programs are matched
by title and skipped if already present.
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
from app.models import Exercise, PreBuiltProgram  # noqa: E402

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
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Dumbbell Bench Press"},
        "primary_muscle": "chest",
        "movement_pattern": "push",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Lie on a flat bench holding a dumbbell in each hand at chest level.",
            "Press the dumbbells upward until your arms are fully extended.",
            "Lower the dumbbells back to chest level in a controlled manner.",
            "Keep your feet flat on the floor and maintain a slight arch in your lower back.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Barbell Front Squat"},
        "primary_muscle": "quadriceps",
        "movement_pattern": "squat",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Rest the barbell across the front of your shoulders with elbows high.",
            "Stand with feet shoulder-width apart and toes slightly outward.",
            "Descend by bending your knees and hips until thighs are parallel to the floor.",
            "Drive through your heels to return to standing, keeping elbows high throughout.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Leg Press"},
        "primary_muscle": "quadriceps",
        "movement_pattern": "squat",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Sit in the leg press machine with your back flat against the pad.",
            "Place your feet shoulder-width apart on the platform.",
            "Release the safety locks and lower the platform by bending your knees.",
            "Push the platform back up by extending your knees without locking them.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Romanian Deadlift"},
        "primary_muscle": "hamstrings",
        "movement_pattern": "hinge",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Hold a barbell at hip height with an overhand grip, feet hip-width apart.",
            "Hinge at your hips, pushing them back while keeping a slight bend in your knees.",
            "Lower the barbell along your legs until you feel a stretch in your hamstrings.",
            "Drive your hips forward to return to standing, squeezing your glutes at the top.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Lying Leg Curl"},
        "primary_muscle": "hamstrings",
        "movement_pattern": "pull",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Lie face down on the leg curl machine with the pad behind your ankles.",
            "Grasp the handles for stability and keep your hips flat on the bench.",
            "Curl your legs upward by flexing your knees toward your glutes.",
            "Lower the weight back down in a controlled manner without letting it slam.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Pull Up"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "bodyweight",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Hang from a pull-up bar with an overhand grip slightly wider than shoulder-width.",
            "Engage your lats and pull your chest toward the bar.",
            "Continue pulling until your chin is above the bar.",
            "Lower yourself back down in a controlled manner to a full hang.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "Lat Pulldown"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Sit at the lat pulldown machine and grip the bar wider than shoulder-width.",
            "Pull the bar down toward your upper chest by driving your elbows down and back.",
            "Squeeze your shoulder blades together at the bottom of the movement.",
            "Slowly return the bar to the starting position with arms fully extended.",
        ],
        "is_active": True,
    },
    {
        "id": str(uuid.uuid4()),
        "name_translations": {"en": "T-Bar Row"},
        "primary_muscle": "back",
        "movement_pattern": "pull",
        "equipment_required": "weights",
        "boost_type": "VISION_REP",
        "animation_url": None,
        "instructions": [
            "Straddle the T-bar row machine and grip the handles with both hands.",
            "Keep your back flat and hinge at the hips to reach the starting position.",
            "Pull the handles toward your torso by driving your elbows behind you.",
            "Squeeze your back muscles at the top, then lower the weight with control.",
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

        # ── Pre-built programs ──────────────────────────────────────────
        await _seed_programs(session)


# ── Pre-built programs ────────────────────────────────────────────────

PROGRAMS: list[dict] = [
    # ── Home / Bodyweight programs ────────────────────────────────────
    {
        "title": "Full Body Burn",
        "description": "Complete bodyweight workout targeting every major muscle group. No equipment needed.",
        "muscle_tags": ["chest", "quadriceps", "core", "back"],
        "equipment_category": "home",
        "exercises": [
            {"exercise_name": "Standard Push-Up", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Bodyweight Lunge", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Plank", "sets": 3, "target_reps_or_duration": 30, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Bodyweight Calf Raise", "sets": 3, "target_reps_or_duration": 15, "rest_time_after_sec": 0, "rest_seconds": 60},
            {"exercise_name": "Mountain Climber", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Push Day Essentials",
        "description": "Focus on chest, shoulders, and triceps using only your bodyweight.",
        "muscle_tags": ["chest", "shoulders"],
        "equipment_category": "home",
        "exercises": [
            {"exercise_name": "Standard Push-Up", "sets": 4, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Pike Push-Up", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Bench Dip", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Leg Day at Home",
        "description": "Build lower body strength with bodyweight squats, lunges, and calf raises.",
        "muscle_tags": ["quadriceps", "calves"],
        "equipment_category": "home",
        "exercises": [
            {"exercise_name": "Bodyweight Lunge", "sets": 4, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Bulgarian Split Squat", "sets": 3, "target_reps_or_duration": 8, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Bodyweight Calf Raise", "sets": 4, "target_reps_or_duration": 15, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Core Crusher",
        "description": "Intense core-focused routine using bodyweight exercises. Plank, crunches, and more.",
        "muscle_tags": ["core"],
        "equipment_category": "home",
        "exercises": [
            {"exercise_name": "Plank", "sets": 3, "target_reps_or_duration": 30, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Mountain Climber", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Crunch", "sets": 3, "target_reps_or_duration": 15, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Russian Twist", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    # ── Gym / Weights programs ────────────────────────────────────────
    {
        "title": "Hypertrophy Chest",
        "description": "Classic bodybuilding chest day with barbell, dumbbells, and cables.",
        "muscle_tags": ["chest", "shoulders"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Barbell Bench Press", "sets": 4, "target_reps_or_duration": 8, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Incline Barbell Bench Press", "sets": 3, "target_reps_or_duration": 8, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Dumbbell Fly", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Cable Crossover", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Back & Biceps Blast",
        "description": "Pull day focusing on lats, rhomboids, and biceps with compound and isolation movements.",
        "muscle_tags": ["back", "biceps"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Barbell Bent Over Row", "sets": 4, "target_reps_or_duration": 8, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Lat Pulldown", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Dumbbell Row", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Barbell Curl", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Heavy Squat Day",
        "description": "Build serious leg strength with barbell squats, Bulgarian split squats, and calf raises.",
        "muscle_tags": ["quadriceps", "calves"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Barbell Back Squat", "sets": 5, "target_reps_or_duration": 5, "rest_time_after_sec": 120, "rest_seconds": 120},
            {"exercise_name": "Bulgarian Split Squat", "sets": 3, "target_reps_or_duration": 8, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Leg Extension", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Standing Calf Raise", "sets": 4, "target_reps_or_duration": 12, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Shoulder Sculpt",
        "description": "Complete shoulder development with overhead press, raises, and lateral work.",
        "muscle_tags": ["shoulders"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Barbell Overhead Press", "sets": 4, "target_reps_or_duration": 8, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Dumbbell Overhead Press", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Lateral Raise", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Arnold Press", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    {
        "title": "Arms Pump",
        "description": "Biceps and triceps isolation workout for arm hypertrophy.",
        "muscle_tags": ["biceps"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Barbell Curl", "sets": 4, "target_reps_or_duration": 8, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Hammer Curl", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 45, "rest_seconds": 60},
            {"exercise_name": "Cable Triceps Pushdown", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Overhead Triceps Extension", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 0, "rest_seconds": 60},
        ],
    },
    # ── Additional gym programs ────────────────────────────────────────
    {
        "title": "Advanced Dumbbell Mastery",
        "description": "Full-body dumbbell workout targeting chest, back, shoulders, and legs with compound movements.",
        "muscle_tags": ["chest", "back", "shoulders", "quadriceps"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Dumbbell Bench Press", "sets": 4, "target_reps_or_duration": 10, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Dumbbell Row", "sets": 4, "target_reps_or_duration": 10, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Arnold Press", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Dumbbell Lunge", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
        ],
    },
    {
        "title": "Leg Day Destroyer",
        "description": "Intense lower body session with heavy compounds and isolation work for quads and hamstrings.",
        "muscle_tags": ["quadriceps", "hamstrings"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Barbell Front Squat", "sets": 4, "target_reps_or_duration": 8, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Leg Press", "sets": 4, "target_reps_or_duration": 10, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Romanian Deadlift", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Lying Leg Curl", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
        ],
    },
    {
        "title": "Pull Power",
        "description": "Back and biceps focused pull day with vertical and horizontal pulling movements.",
        "muscle_tags": ["back", "biceps"],
        "equipment_category": "gym",
        "exercises": [
            {"exercise_name": "Pull Up", "sets": 4, "target_reps_or_duration": 8, "rest_time_after_sec": 90, "rest_seconds": 90},
            {"exercise_name": "Lat Pulldown", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "T-Bar Row", "sets": 3, "target_reps_or_duration": 10, "rest_time_after_sec": 60, "rest_seconds": 60},
            {"exercise_name": "Barbell Curl", "sets": 3, "target_reps_or_duration": 12, "rest_time_after_sec": 60, "rest_seconds": 60},
        ],
    },
]


async def _seed_programs(session) -> None:
    """Insert pre-built programs, looking up exercise IDs by English name."""
    from app.models import Exercise

    existing_titles = set(
        row.title for row in (await session.scalars(select(PreBuiltProgram))).all()
    )

    # Build exercise name → id lookup from DB
    all_exercises = (await session.scalars(select(Exercise))).all()
    name_to_id: dict[str, str] = {
        ex.name_translations.get("en", ""): str(ex.id) for ex in all_exercises
    }

    inserts = 0
    for prog in PROGRAMS:
        if prog["title"] in existing_titles:
            continue

        # Resolve exercise IDs
        resolved_exercises = []
        for entry in prog["exercises"]:
            ex_name = entry.pop("exercise_name")
            ex_id = name_to_id.get(ex_name)
            if ex_id is None:
                print(f"  WARNING: exercise '{ex_name}' not found, skipping program '{prog['title']}'")
                break
            entry["exercise_id"] = ex_id
            resolved_exercises.append(entry)
        else:
            # Only insert if all exercises resolved
            session.add(
                PreBuiltProgram(
                    title=prog["title"],
                    description=prog["description"],
                    muscle_tags=prog["muscle_tags"],
                    equipment_category=prog["equipment_category"],
                    exercises=resolved_exercises,
                    is_active=True,
                )
            )
            inserts += 1

    await session.commit()
    print(f"Inserted {inserts} new pre-built programs.")


if __name__ == "__main__":
    asyncio.run(enrich())

"""ExerciseDB seeding endpoint.

POST /api/v1/admin/seed-exercises — fetches exercises from ExerciseDB
via RapidAPI and upserts them into the local catalogue.

Targets only the curated list of ~50 core exercises.  Name matching uses
aggressive normalisation (strip non-alphanumeric, lowercase) so
"Barbell Bent-Over Row" matches "Barbell Bent Over Row".

Auto-tags ``movement_pattern`` based on exercise name.
Auto-determines ``boost_type`` (core/plank → DURATION, else → VISION_REP).

Requires admin privileges.
"""

from __future__ import annotations

import asyncio
import os
import re
import urllib.parse
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_db
from app.models import Exercise, User

router = APIRouter(prefix="/admin", tags=["admin"])

EXERCISEDB_API_URL = "https://exercisedb.p.rapidapi.com/exercises"
RAPIDAPI_KEY = os.getenv(
    "RAPIDAPI_KEY",
    "112648333fmsh4983575ee18bf9ap13ecf2jsnc09b81349a34",
)

# ---------------------------------------------------------------------------
# Curated target list (Title Case)
# ---------------------------------------------------------------------------

TARGET_EXERCISE_NAMES: list[str] = [
    "Barbell Bench Press",
    "Dumbbell Bench Press",
    "Incline Barbell Bench Press",
    "Incline Dumbbell Bench Press",
    "Push Up",
    "Kneeling Push Up",
    "Dumbbell Fly",
    "Cable Crossover",
    "Barbell Deadlift",
    "Romanian Deadlift",
    "Pull Up",
    "Chin Up",
    "Lat Pulldown",
    "Barbell Bent Over Row",
    "Dumbbell Row",
    "Seated Cable Row",
    "T-Bar Row",
    "Barbell Back Squat",
    "Barbell Front Squat",
    "Leg Press",
    "Dumbbell Lunge",
    "Bulgarian Split Squat",
    "Leg Extension",
    "Lying Leg Curl",
    "Seated Calf Raise",
    "Standing Calf Raise",
    "Barbell Overhead Press",
    "Dumbbell Overhead Press",
    "Lateral Raise",
    "Front Raise",
    "Reverse Pec Deck Fly",
    "Arnold Press",
    "Barbell Curl",
    "Dumbbell Curl",
    "Hammer Curl",
    "Preacher Curl",
    "Cable Curl",
    "Cable Triceps Pushdown",
    "Dumbbell Lying Triceps Extension",
    "Triceps Dip",
    "Overhead Triceps Extension",
    "Bench Dip",
    "Plank",
    "Crunch",
    "Hanging Leg Raise",
    "Russian Twist",
    "Ab Wheel Rollout",
    "Kettlebell Swing",
    "Burpee",
    "Mountain Climber",
]


def _normalize(name: str) -> str:
    """Strip all non-alphanumeric characters and lowercase."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


# Pre-compute normalized → original lookup
_TARGET_NORMALIZED: dict[str, str] = {
    _normalize(name): name for name in TARGET_EXERCISE_NAMES
}

# ---------------------------------------------------------------------------
# Auto-tagging helpers
# ---------------------------------------------------------------------------

_SQUAT_RE = re.compile(r"\b(squat|lunge|step[\s-]?up|split[\s-]?squat|bulgarian)\b", re.IGNORECASE)
_PUSH_RE = re.compile(r"\b(push[\s-]?up|press|extension|dip|fly|chest[\s-]?fly|lateral[\s-]?raise|shoulder[\s-]?press|tricep|bench)\b", re.IGNORECASE)
_PULL_RE = re.compile(r"\b(pull[\s-]?up|row|curl|pulldown|face[\s-]?pull|shrug|lat)\b", re.IGNORECASE)
_HINGE_RE = re.compile(r"\b(deadlift|hip[\s-]?hinge|swing|good[\s-]?morning|rdl|kettlebell)\b", re.IGNORECASE)
_CORE_RE = re.compile(r"\b(plank|crunch|sit[\s-]?up|russian[\s-]?twist|leg[\s-]?raise|ab[\s-]?roll|bird[\s-]?dog|dead[\s-]?bug|hollow)\b", re.IGNORECASE)


def _classify_movement(name: str) -> str:
    """Map an exercise name to one of our custom movement patterns."""
    if _SQUAT_RE.search(name):
        return "squat"
    if _CORE_RE.search(name):
        return "core"
    if _PUSH_RE.search(name):
        return "push"
    if _PULL_RE.search(name):
        return "pull"
    if _HINGE_RE.search(name):
        return "hinge"
    return "none"


def _classify_boost_type(name: str) -> str:
    """Determine whether the exercise uses rep-counting or duration."""
    if _CORE_RE.search(name):
        return "DURATION"
    return "VISION_REP"


def _map_equipment(equipment: str) -> str:
    """Map ExerciseDB equipment string to our simplified enum."""
    if not equipment or "body weight" in equipment.lower():
        return "bodyweight"
    return "weights"


def _map_target(target: str) -> str:
    """Normalise the ExerciseDB bodyPart/target to our primary_muscle."""
    mapping = {
        "upper legs": "quadriceps",
        "lower legs": "calves",
        "upper arms": "biceps",
        "back": "back",
        "chest": "chest",
        "shoulders": "shoulders",
        "waist": "core",
        "neck": "neck",
        "cardio": "cardio",
    }
    return mapping.get(target.lower(), target.lower())


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------


class SeedResult(BaseModel):
    fetched: int
    matched: int
    inserted: int
    updated: int
    skipped: int


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/seed-exercises", response_model=SeedResult)
async def seed_exercises(
    _admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
) -> SeedResult:
    """Fetch each target exercise by name from ExerciseDB and upsert.

    Instead of paginating through the full catalog (which the free tier
    throttles to 10 items), we hit the ``/exercises/name/{name}``
    endpoint for each of the 50 target exercises.  A 1.5 s delay between
    calls avoids 429 rate-limit errors.
    """
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
    }

    inserted = 0
    updated = 0
    skipped = 0
    matched = 0
    not_found: list[str] = []

    # ── Sniper fetch: one request per target name ──────────────────────
    for target_name in TARGET_EXERCISE_NAMES:
        encoded = urllib.parse.quote(target_name)
        url = f"{EXERCISEDB_API_URL}/name/{encoded}"

        try:
            resp = await asyncio.to_thread(
                requests.get,
                url,
                headers=headers,
                params={"limit": 10},
                timeout=30,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            print(f"  ERROR fetching '{target_name}': {exc}")
            not_found.append(target_name)
            await asyncio.sleep(1.5)
            continue

        results: list[dict[str, Any]] = resp.json()
        if not results:
            print(f"  NOT FOUND: {target_name}")
            not_found.append(target_name)
            await asyncio.sleep(1.5)
            continue

        # Find the best match: prefer exact normalised name match,
        # otherwise take the first result.
        item = results[0]  # default to first
        for r in results:
            if _normalize(r.get("name", "")) == _normalize(target_name):
                item = r
                break

        matched += 1
        print(f"Fetched: {target_name}")

        # Upsert into DB
        existing = await db.scalar(
            select(Exercise).where(
                Exercise.name_translations["en"].astext == target_name
            )
        )

        movement = _classify_movement(target_name)
        boost_type = _classify_boost_type(target_name)
        equipment = _map_equipment(item.get("equipment", ""))
        target = _map_target(item.get("bodyPart", ""))
        instructions = item.get("instructions", [])

        exercise_db_id = item.get("id", "")
        animation_url = (
            f"https://exercisedb.p.rapidapi.com/image?exerciseId={exercise_db_id}&resolution=360"
            if exercise_db_id
            else ""
        )

        if existing:
            changed = False
            if animation_url and existing.animation_url != animation_url:
                existing.animation_url = animation_url
                changed = True
            if instructions and existing.instructions != instructions:
                existing.instructions = instructions
                changed = True
            if target_name and (existing.name_translations or {}).get("en") != target_name:
                existing.name_translations = {"en": target_name}
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            exercise = Exercise(
                name_translations={"en": target_name},
                primary_muscle=target,
                movement_pattern=movement,
                equipment_required=equipment,
                boost_type=boost_type,
                animation_url=animation_url or None,
                instructions=instructions or None,
            )
            db.add(exercise)
            inserted += 1

        # Rate-limit: pause between API calls
        await asyncio.sleep(1.5)

    await db.commit()

    if not_found:
        print(f"\nNot found in ExerciseDB ({len(not_found)}):")
        for name in not_found:
            print(f"  - {name}")

    return SeedResult(
        fetched=matched + len(not_found),
        matched=matched,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
    )

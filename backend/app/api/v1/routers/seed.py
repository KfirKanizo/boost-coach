"""ExerciseDB seeding endpoint.

POST /api/v1/admin/seed-exercises — fetches exercises from ExerciseDB
via RapidAPI and upserts them into the local catalogue.

Auto-tags ``movement_pattern`` based on exercise name:
  - name contains 'squat'          → squat
  - name contains 'push up'/'pushup' → push
  - name contains 'plank'          → core
  - else                           → none

Auto-determines ``boost_type``:
  - core/plank exercises           → DURATION
  - everything else                → VISION_REP

Requires admin privileges.
"""

from __future__ import annotations

import asyncio
import os
import re
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
# Auto-tagging helpers
# ---------------------------------------------------------------------------

_SQUAT_RE = re.compile(r"\bsquat\b", re.IGNORECASE)
_PUSHUP_RE = re.compile(r"\bpush[\s-]?up\b", re.IGNORECASE)
_PLANK_RE = re.compile(r"\bplank\b", re.IGNORECASE)


def _classify_movement(name: str) -> str:
    """Map an exercise name to one of our custom movement patterns."""
    if _SQUAT_RE.search(name):
        return "squat"
    if _PUSHUP_RE.search(name):
        return "push"
    if _PLANK_RE.search(name):
        return "core"
    return "none"


def _classify_boost_type(name: str) -> str:
    """Determine whether the exercise uses rep-counting or duration."""
    if _PLANK_RE.search(name):
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
    """Fetch ALL exercises from ExerciseDB via paginated requests.

    Uses a small page size (50) to stay within RapidAPI's free-tier
    limits, with a 1.5 s delay between pages to avoid 429s.
    """
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
    }

    PAGE_SIZE = 50
    all_exercises: list[dict[str, Any]] = []
    offset = 0

    # ── Paginated fetch ────────────────────────────────────────────────
    while True:
        try:
            resp = await asyncio.to_thread(
                requests.get,
                EXERCISEDB_API_URL,
                headers=headers,
                params={"limit": PAGE_SIZE, "offset": offset},
                timeout=30,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach ExerciseDB at offset {offset}: {exc}",
            )

        page: list[dict[str, Any]] = resp.json()
        if not page:
            break

        all_exercises.extend(page)
        offset += PAGE_SIZE

        # Rate-limit: pause between pages
        await asyncio.sleep(1.5)

    # ── Upsert into DB ────────────────────────────────────────────────
    inserted = 0
    updated = 0
    skipped = 0

    for item in all_exercises:
        name = item.get("name", "").strip()
        if not name:
            skipped += 1
            continue

        # Skip if exercise already exists (by name)
        existing = await db.scalar(
            select(Exercise).where(
                Exercise.name_translations["en"].astext == name
            )
        )

        movement = _classify_movement(name)
        boost_type = _classify_boost_type(name)
        equipment = _map_equipment(item.get("equipment", ""))
        target = _map_target(item.get("bodyPart", ""))
        gif_url = item.get("gifUrl", "")
        instructions = item.get("instructions", [])

        # Append rapidapi-key so the frontend <img> can render without 403
        if gif_url:
            sep = "&" if "?" in gif_url else "?"
            gif_url = f"{gif_url}{sep}rapidapi-key={RAPIDAPI_KEY}"

        if existing:
            changed = False
            if gif_url and existing.animation_url != gif_url:
                existing.animation_url = gif_url
                changed = True
            if instructions and existing.instructions != instructions:
                existing.instructions = instructions
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
            continue

        exercise = Exercise(
            name_translations={"en": name},
            primary_muscle=target,
            movement_pattern=movement,
            equipment_required=equipment,
            boost_type=boost_type,
            animation_url=gif_url or None,
            instructions=instructions or None,
        )
        db.add(exercise)
        inserted += 1

    await db.commit()
    return SeedResult(
        fetched=len(all_exercises),
        inserted=inserted,
        updated=updated,
        skipped=skipped,
    )

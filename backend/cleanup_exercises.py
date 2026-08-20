"""Curate the exercise catalogue down to the ~50 most common exercises.

Connects to the database via the same DATABASE_URL used by the API,
identifies exercises to keep (name match + data completeness), and
deletes everything else.  Associated rows in daily_boosts and swap_logs
are removed first to satisfy foreign-key constraints.

Usage (inside the API container):
    docker compose exec api python cleanup_exercises.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

DATABASE_URL = os.environ["DATABASE_URL"]

# ── Target list (Title Case) ──────────────────────────────────────────
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

TARGET_SET = {name.lower() for name in TARGET_EXERCISE_NAMES}


async def run() -> None:
    engine = create_async_engine(DATABASE_URL)

    async with engine.begin() as conn:
        # ── 1. Fetch all exercises ────────────────────────────────────
        rows = (await conn.execute(text(
            "SELECT id, name_translations, animation_url, instructions "
            "FROM exercises"
        ))).mappings().all()

        print(f"Total exercises in DB: {len(rows)}")

        keep_ids: list[str] = []
        delete_ids: list[str] = []

        for r in rows:
            name_en = (r["name_translations"] or {}).get("en", "").lower()
            has_animation = bool(r["animation_url"] and len(r["animation_url"]) > 0)
            has_instructions = bool(r["instructions"] and len(r["instructions"]) > 0)

            if name_en in TARGET_SET and has_animation and has_instructions:
                keep_ids.append(str(r["id"]))
            else:
                delete_ids.append(str(r["id"]))

        print(f"Keeping:  {len(keep_ids)} exercises")
        print(f"Deleting: {len(delete_ids)} exercises")

        if not delete_ids:
            print("Nothing to delete — done.")
            await engine.dispose()
            return

        # ── 2. Confirm ────────────────────────────────────────────────
        if "--yes" not in sys.argv:
            answer = input("Proceed with deletion? [y/N] ").strip().lower()
            if answer != "y":
                print("Aborted.")
                await engine.dispose()
                return

        # ── 3. Delete FK-dependent rows first ──────────────────────────
        ids_csv = ", ".join(f"'{i}'" for i in delete_ids)

        res_boosts = await conn.execute(text(
            f"DELETE FROM daily_boosts WHERE exercise_id::text IN ({ids_csv})"
        ))
        res_swaps = await conn.execute(text(
            f"DELETE FROM swap_logs WHERE new_exercise_id::text IN ({ids_csv})"
        ))
        print(
            f"Deleted {res_boosts.rowcount} daily_boosts, "
            f"{res_swaps.rowcount} swap_logs"
        )

        # ── 4. Delete exercises ────────────────────────────────────────
        res_ex = await conn.execute(text(
            f"DELETE FROM exercises WHERE id::text IN ({ids_csv})"
        ))
        print(f"Deleted {res_ex.rowcount} exercises")

    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(run())

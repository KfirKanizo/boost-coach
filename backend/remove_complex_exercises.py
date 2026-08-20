"""Remove exercises that don't fit any of our 5 supported movement patterns,
and reclassify exercises whose pattern was incorrectly assigned by the seed.

Our vision engine handles: squat, push, pull, core, hinge.

This script:
  1. Reclassifies exercises in RECLASSIFY_MAP to their correct pattern.
  2. Identifies remaining exercises with movement_pattern = 'none'.
  3. Deletes associated rows in daily_boosts and swap_logs (FK deps).
  4. Deletes the unsupported exercises.

Usage (inside the API container):
    docker compose exec api python remove_complex_exercises.py

Dry-run by default.  Pass --delete to apply changes.
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

DATABASE_URL = os.environ["DATABASE_URL"]

# ── Exercises to reclassify (English name → correct movement_pattern) ─────
RECLASSIFY_MAP: dict[str, str] = {
    "Chin-Up": "pull",
    "Cable Triceps Pushdown": "push",
}


async def _reclassify(session: AsyncSession) -> list[dict]:
    """Fix misclassified exercises. Returns the updated rows."""
    updated: list[dict] = []
    for name, pattern in RECLASSIFY_MAP.items():
        result = await session.execute(
            text(
                "UPDATE exercises SET movement_pattern = :pattern "
                "WHERE name_translations ->> 'en' = :name "
                "AND movement_pattern = 'none' "
                "RETURNING id, name_translations, movement_pattern"
            ),
            {"pattern": pattern, "name": name},
        )
        row = result.mappings().first()
        if row:
            updated.append(dict(row))
    return updated


async def _find_unsupported(session: AsyncSession) -> list[dict]:
    """Return exercises with movement_pattern = 'none'."""
    result = await session.execute(
        text(
            "SELECT id, name_translations, movement_pattern "
            "FROM exercises WHERE movement_pattern = 'none' "
            "ORDER BY name_translations ->> 'en'"
        )
    )
    return [dict(row) for row in result.mappings()]


async def _count_refs(session: AsyncSession, exercise_id: str) -> dict[str, int]:
    """Count rows in child tables that reference this exercise."""
    counts: dict[str, int] = {}
    for table in ("daily_boosts", "swap_logs"):
        col = "exercise_id" if table == "daily_boosts" else "new_exercise_id"
        result = await session.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :eid"),
            {"eid": exercise_id},
        )
        counts[table] = result.scalar_one()
    return counts


async def _delete_exercise(session: AsyncSession, exercise_id: str) -> None:
    """Delete an exercise and its FK-dependent rows."""
    await session.execute(
        text("DELETE FROM daily_boosts WHERE exercise_id = :eid"),
        {"eid": exercise_id},
    )
    await session.execute(
        text("DELETE FROM swap_logs WHERE new_exercise_id = :eid"),
        {"eid": exercise_id},
    )
    await session.execute(
        text("DELETE FROM exercises WHERE id = :eid"),
        {"eid": exercise_id},
    )


async def main() -> None:
    dry_run = "--delete" not in sys.argv

    engine = create_async_engine(DATABASE_URL)

    async with AsyncSession(engine) as session:
        # ── Step 1: Reclassify mislabelled exercises ──────────────────────
        reclassified = await _reclassify(session)
        if reclassified:
            print("Reclassified exercises:")
            for ex in reclassified:
                name = ex["name_translations"].get("en", str(ex["name_translations"]))
                print(f"  ✓ {name}  →  {ex['movement_pattern']}")
            print()

        # ── Step 2: Find remaining unsupported exercises ───────────────────
        unsupported = await _find_unsupported(session)

        if not unsupported:
            print("No unsupported exercises remaining. Nothing to delete.")
            if not reclassified:
                print("Nothing to do.")
            await engine.dispose()
            return

        print(f"Exercises to DELETE ({len(unsupported)}):\n")
        total_refs = 0
        for ex in unsupported:
            name = ex["name_translations"].get("en", str(ex["name_translations"]))
            counts = await _count_refs(session, str(ex["id"]))
            refs = sum(counts.values())
            total_refs += refs
            ref_detail = ", ".join(f"{t}: {c}" for t, c in counts.items() if c)
            suffix = f" ({ref_detail})" if ref_detail else ""
            print(f"  ✗ {name}{suffix}")

        print(f"\nTotal: {len(unsupported)} exercises to delete, {total_refs} FK references")

        if dry_run:
            print("\n[DRY RUN] No changes applied.  Re-run with --delete to execute.")
        else:
            for ex in unsupported:
                await _delete_exercise(session, str(ex["id"]))
            await session.commit()
            print(f"\n[APPLIED] Reclassified {len(reclassified)} exercise(s), "
                  f"deleted {len(unsupported)} exercise(s).")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

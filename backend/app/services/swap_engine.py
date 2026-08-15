"""Deterministic Smart Swap rules engine.

``swap_daily_boost`` replaces the exercise on a ``DailyBoost`` with an
equivalent one and records the substitution in ``SwapLog``.

Selection is fully deterministic:
  1. Candidates share the original ``primary_muscle`` and have a different id.
  2. For ``swap_reason == "no_equipment"`` only bodyweight/equipment-free
     candidates qualify.
  3. Candidates are ranked by (same ``boost_type``, same ``movement_pattern``,
     same ``equipment_required``) and tied-break on ``id``.
"""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import DailyBoost, Exercise, SwapLog

EQUIPMENT_FREE = ("none", "bodyweight")


async def _find_replacement(
    db: AsyncSession,
    original: Exercise,
    swap_reason: str,
) -> Exercise | None:
    """Return the best matching replacement exercise or ``None``."""
    stmt = select(Exercise).where(
        Exercise.primary_muscle == original.primary_muscle,
        Exercise.id != original.id,
    )
    if swap_reason == "no_equipment":
        stmt = stmt.where(Exercise.equipment_required.in_(EQUIPMENT_FREE))

    stmt = stmt.order_by(
        (Exercise.boost_type == original.boost_type).desc(),
        (Exercise.movement_pattern == original.movement_pattern).desc(),
        (Exercise.equipment_required == original.equipment_required).desc(),
        Exercise.id.asc(),
    )
    return await db.scalar(stmt.limit(1))


async def swap_daily_boost(
    db: AsyncSession,
    *,
    boost_id: UUID,
    swap_reason: str,
    user_id: UUID,
) -> DailyBoost:
    """Swap the exercise on ``boost_id`` for an equivalent one.

    Updates the ``DailyBoost.exercise_id`` and appends a ``SwapLog`` row.
    Raises ``HTTPException`` (404) when the boost does not exist or no
    replacement can be found.
    """
    boost = await db.scalar(
        select(DailyBoost)
        .where(DailyBoost.id == boost_id)
        .options(selectinload(DailyBoost.exercise))
    )
    if boost is None or boost.user_id != user_id:
        raise HTTPException(status_code=404, detail="Daily boost not found")

    replacement = await _find_replacement(db, boost.exercise, swap_reason)
    if replacement is None:
        raise HTTPException(
            status_code=404,
            detail="No suitable replacement exercise found",
        )

    boost.exercise = replacement
    db.add(
        SwapLog(
            user_id=user_id,
            daily_boost_id=boost.id,
            new_exercise_id=replacement.id,
            swap_reason=swap_reason,
        )
    )
    await db.commit()
    return boost

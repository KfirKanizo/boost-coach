"""Event-driven push notification triggers.

Evaluates a just-completed workout session and dispatches push
notifications for achievements: level-ups and personal records.

All functions are designed to be called as background tasks — they
never raise, so the parent request is never affected.
"""

import logging
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, WorkoutSession
from app.schemas.history import compute_level
from app.services.push_dispatch import dispatch_push

log = logging.getLogger(__name__)


async def evaluate_workout_achievements(
    db: AsyncSession,
    *,
    user_id: UUID,
    xp_earned: int,
    total_reps: int,
    total_duration_seconds: int,
) -> None:
    """Post-workout hook: evaluate level-ups and PRs, dispatch push notifications.

    Called as a background task after the workout session is committed.
    Never raises — all errors are caught and logged.
    """
    try:
        await _check_level_up(db, user_id=user_id, xp_earned=xp_earned)
        await _check_personal_records(
            db,
            user_id=user_id,
            total_reps=total_reps,
            total_duration_seconds=total_duration_seconds,
        )
    except Exception:
        log.exception("Push trigger evaluation failed for user %s", user_id)


async def _check_level_up(
    db: AsyncSession,
    *,
    user_id: UUID,
    xp_earned: int,
) -> None:
    """Compare level before and after this workout; notify if level increased."""
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(WorkoutSession.xp_earned), 0)).where(
            WorkoutSession.user_id == user_id
        )
    ) or 0

    new_level = compute_level(total_xp)
    previous_level = compute_level(total_xp - xp_earned)

    if new_level > previous_level:
        await dispatch_push(
            db,
            user_ids=[user_id],
            title="Level Up! \U0001f3c6",
            body=f"Boom! You've reached Level {new_level}. Keep up the great work!",
            data={"link": "/profile"},
        )
        log.info(
            "Level-up push sent to user %s: %d -> %d",
            user_id,
            previous_level,
            new_level,
        )


async def _check_personal_records(
    db: AsyncSession,
    *,
    user_id: UUID,
    total_reps: int,
    total_duration_seconds: int,
) -> None:
    """Compare this session's stats against the user's historical bests.

    Tracks two PR categories:
    - Most total reps in a single session
    - Longest session by duration

    Sends at most one notification per workout (the most impressive PR).
    """
    prs: list[Dict[str, Any]] = []

    # ── Most reps in a single session ──────────────────────────────
    max_reps = await db.scalar(
        select(func.max(WorkoutSession.total_reps)).where(
            WorkoutSession.user_id == user_id
        )
    ) or 0

    if total_reps > max_reps and max_reps > 0:
        prs.append({
            "title": "New Personal Record! \U0001f525",
            "body": f"You just set a new record: {total_reps} reps in a single session! Unstoppable.",
            "data": {"link": "/statistics"},
        })

    # ── Longest session by duration ────────────────────────────────
    max_duration = await db.scalar(
        select(func.max(WorkoutSession.total_duration_seconds)).where(
            WorkoutSession.user_id == user_id
        )
    ) or 0

    if total_duration_seconds > max_duration and max_duration > 0:
        minutes = total_duration_seconds // 60
        prs.append({
            "title": "New Personal Record! \U0001f525",
            "body": f"Your longest session ever: {minutes} minutes! Unstoppable.",
            "data": {"link": "/statistics"},
        })

    # Send only the most impressive PR (if any) to avoid notification spam
    if prs:
        # Reps PR takes priority over duration PR
        best = prs[0]
        await dispatch_push(
            db,
            user_ids=[user_id],
            title=best["title"],
            body=best["body"],
            data=best["data"],
        )
        log.info("PR push sent to user %s: %s", user_id, best["body"])

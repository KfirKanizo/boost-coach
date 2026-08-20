"""Workout history and weekly stats endpoints.

POST /api/v1/history/complete — log a completed workout session + compute XP.
GET  /api/v1/history/weekly-stats — return sessions this week + weekly goal.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import User, WorkoutSession
from app.schemas.history import (
    WeeklyStatsResponse,
    WorkoutCompleteRequest,
    WorkoutSessionResponse,
    compute_xp,
)

router = APIRouter(prefix="/history", tags=["history"])

WEEKLY_GOAL = 4


@router.post("/complete", response_model=WorkoutSessionResponse, status_code=201)
async def complete_workout(
    body: WorkoutCompleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkoutSessionResponse:
    """Log a completed workout session and return XP earned."""
    xp = compute_xp(body.verified_reps, body.target_reps)

    session = WorkoutSession(
        user_id=user.id,
        session_type=body.session_type,
        total_reps=body.total_reps,
        total_duration_seconds=body.total_duration_seconds,
        exercise_count=body.exercise_count,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    resp = WorkoutSessionResponse.model_validate(session)
    resp.xp_earned = xp
    return resp


@router.get("/weekly-stats", response_model=WeeklyStatsResponse)
async def weekly_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeeklyStatsResponse:
    """Return the number of sessions completed this week (Mon–Sun) and the goal."""
    now = datetime.now(timezone.utc)
    start_of_week = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    count = await db.scalar(
        select(func.count()).select_from(WorkoutSession).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.created_at >= start_of_week,
        )
    )
    return WeeklyStatsResponse(
        sessions_this_week=count or 0,
        weekly_goal=WEEKLY_GOAL,
    )

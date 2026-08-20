"""Workout history and weekly stats endpoints.

POST /api/v1/history/complete — log a completed workout session + compute XP.
GET  /api/v1/history/weekly-stats — return sessions this week + weekly goal.
GET  /api/v1/history/stats — aggregated gamification stats.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import User, WorkoutSession
from app.schemas.history import (
    GamificationStatsResponse,
    WeeklyStatsResponse,
    WorkoutCompleteRequest,
    WorkoutSessionResponse,
    compute_level,
    compute_xp,
    xp_for_level,
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
        verified_reps=body.verified_reps,
        xp_earned=xp,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return WorkoutSessionResponse.model_validate(session)


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


@router.get("/stats", response_model=GamificationStatsResponse)
async def gamification_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GamificationStatsResponse:
    """Return aggregated gamification data for the dashboard."""
    now = datetime.now(timezone.utc)
    start_of_week = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Aggregate stats in one query
    row = await db.execute(
        select(
            func.coalesce(func.sum(WorkoutSession.xp_earned), 0),
            func.coalesce(func.sum(WorkoutSession.total_reps), 0),
            func.coalesce(func.sum(WorkoutSession.verified_reps), 0),
            func.coalesce(func.count(), 0),
        ).where(WorkoutSession.user_id == user.id)
    )
    total_xp, total_reps, total_verified_reps, total_workouts = row.one()

    # Sessions this week
    week_count = await db.scalar(
        select(func.count()).select_from(WorkoutSession).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.created_at >= start_of_week,
        )
    )

    # Activity days in the last 7 days (distinct dates with at least one session)
    seven_days_ago = now - timedelta(days=6)
    seven_days_ago_start = seven_days_ago.replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    result = await db.execute(
        select(func.date(WorkoutSession.created_at))
        .where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.created_at >= seven_days_ago_start,
        )
        .distinct()
    )
    activity_days = [str(row[0]) for row in result.all()]

    level = compute_level(total_xp)
    current_level_xp = xp_for_level(level)
    next_level_xp = xp_for_level(level + 1) if level < 50 else current_level_xp

    return GamificationStatsResponse(
        total_xp=total_xp,
        level=level,
        xp_current_level=current_level_xp,
        xp_next_level=next_level_xp,
        total_workouts=total_workouts,
        total_reps=total_reps,
        total_verified_reps=total_verified_reps,
        current_streak=user.current_streak,
        weekly_goal=WEEKLY_GOAL,
        sessions_this_week=week_count or 0,
        activity_days=activity_days,
    )

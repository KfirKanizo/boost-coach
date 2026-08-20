"""Admin endpoints protected by RBAC.

GET  /api/v1/admin/users      - lists all users.
GET  /api/v1/admin/stats      - system-wide metrics.
GET  /api/v1/admin/exercises  - lists all exercises (including inactive).
PUT  /api/v1/admin/exercises/{exercise_id} - update exercise fields.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_db
from app.models import Exercise, User, WorkoutSession
from app.schemas.exercise import ExerciseResponse, ExerciseUpdateRequest
from app.schemas.user import AdminUserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Users ────────────────────────────────────────────────────────────


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[AdminUserResponse]:
    """Return all provisioned users (admin only)."""
    rows = await db.scalars(
        select(User).order_by(User.created_at.asc(), User.id.asc())
    )
    return [AdminUserResponse.model_validate(row) for row in rows.all()]


# ── System stats ─────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> dict:
    """Return system-wide metrics: total users, total workouts, total exercises."""
    total_users = (await db.scalar(select(func.count(User.id)))) or 0
    total_workouts = (await db.scalar(select(func.count(WorkoutSession.id)))) or 0
    total_exercises = (await db.scalar(select(func.count(Exercise.id)))) or 0
    return {
        "total_users": total_users,
        "total_workouts": total_workouts,
        "total_exercises": total_exercises,
    }


# ── Exercise management ──────────────────────────────────────────────


@router.get("/exercises", response_model=list[ExerciseResponse])
async def admin_list_exercises(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[ExerciseResponse]:
    """Return every exercise, including inactive ones (admin only)."""
    rows = await db.scalars(select(Exercise).order_by(Exercise.id.asc()))
    return [ExerciseResponse.model_validate(row) for row in rows.all()]


@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def admin_update_exercise(
    exercise_id: str,
    body: ExerciseUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> ExerciseResponse:
    """Update an exercise's movement_pattern or is_active flag (admin only)."""
    import uuid as _uuid

    try:
        eid = _uuid.UUID(exercise_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Exercise not found")

    exercise = await db.get(Exercise, eid)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    if body.movement_pattern is not None:
        exercise.movement_pattern = body.movement_pattern
    if body.is_active is not None:
        exercise.is_active = body.is_active

    await db.flush()
    await db.refresh(exercise)
    return ExerciseResponse.model_validate(exercise)

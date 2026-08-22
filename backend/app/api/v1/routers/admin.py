"""Admin endpoints protected by RBAC.

GET    /api/v1/admin/users            - lists all users.
GET    /api/v1/admin/stats            - system-wide metrics.
GET    /api/v1/admin/exercises        - lists all exercises (including inactive).
PUT    /api/v1/admin/exercises/{id}   - update exercise fields.
GET    /api/v1/admin/programs         - list all pre-built programs.
POST   /api/v1/admin/programs         - create a pre-built program.
GET    /api/v1/admin/programs/{id}    - get a single pre-built program.
PUT    /api/v1/admin/programs/{id}    - update a pre-built program.
DELETE /api/v1/admin/programs/{id}    - delete a pre-built program.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_db
from app.models import Exercise, PreBuiltProgram, User, WorkoutSession
from app.schemas.exercise import ExerciseResponse, ExerciseUpdateRequest
from app.schemas.prebuilt_program import (
    PreBuiltProgramCreateRequest,
    PreBuiltProgramResponse,
    PreBuiltProgramUpdateRequest,
)
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


# ── Pre-built programs ──────────────────────────────────────────────


@router.get("/programs", response_model=list[PreBuiltProgramResponse])
async def list_programs(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[PreBuiltProgramResponse]:
    """Return all pre-built programs (admin only)."""
    rows = await db.scalars(
        select(PreBuiltProgram).order_by(PreBuiltProgram.title.asc())
    )
    return [PreBuiltProgramResponse.model_validate(row) for row in rows.all()]


@router.post("/programs", response_model=PreBuiltProgramResponse, status_code=201)
async def create_program(
    body: PreBuiltProgramCreateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> PreBuiltProgramResponse:
    """Create a new pre-built program (admin only)."""
    program = PreBuiltProgram(
        title=body.title,
        description=body.description,
        muscle_tags=body.muscle_tags,
        exercises=body.exercises,
        is_active=body.is_active,
    )
    db.add(program)
    await db.flush()
    await db.refresh(program)
    return PreBuiltProgramResponse.model_validate(program)


@router.get("/programs/{program_id}", response_model=PreBuiltProgramResponse)
async def get_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> PreBuiltProgramResponse:
    """Return a single pre-built program (admin only)."""
    try:
        pid = UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Program not found")

    program = await db.get(PreBuiltProgram, pid)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return PreBuiltProgramResponse.model_validate(program)


@router.put("/programs/{program_id}", response_model=PreBuiltProgramResponse)
async def update_program(
    program_id: str,
    body: PreBuiltProgramUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> PreBuiltProgramResponse:
    """Update a pre-built program (admin only)."""
    try:
        pid = UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Program not found")

    program = await db.get(PreBuiltProgram, pid)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    if body.title is not None:
        program.title = body.title
    if body.description is not None:
        program.description = body.description
    if body.muscle_tags is not None:
        program.muscle_tags = body.muscle_tags
    if body.exercises is not None:
        program.exercises = body.exercises
    if body.is_active is not None:
        program.is_active = body.is_active

    await db.flush()
    await db.refresh(program)
    return PreBuiltProgramResponse.model_validate(program)


@router.delete("/programs/{program_id}", status_code=204)
async def delete_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> None:
    """Delete a pre-built program (admin only)."""
    try:
        pid = UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Program not found")

    program = await db.get(PreBuiltProgram, pid)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")

    await db.delete(program)
    await db.flush()

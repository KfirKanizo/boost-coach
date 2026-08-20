"""Custom routine CRUD endpoints.

GET    /api/v1/routines      — list the user's routines.
POST   /api/v1/routines      — create a new routine.
PUT    /api/v1/routines/{id} — update a routine.
DELETE /api/v1/routines/{id} — delete a routine.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Exercise, Routine, User
from app.schemas.routine import (
    RoutineCreateRequest,
    RoutineResponse,
    RoutineUpdateRequest,
)

router = APIRouter(prefix="/routines", tags=["routines"])


async def _enrich_exercises(
    db: AsyncSession, exercises: list[dict]
) -> list[dict]:
    """Look up each exercise by ID and merge animation_url + instructions.

    Routine exercises are stored as a JSONB snapshot.  This ensures
    stale rows (saved before those fields existed) still return the
    latest data from the ``exercises`` table.
    """
    if not exercises:
        return exercises

    ids = [ex.get("exercise_id") for ex in exercises if ex.get("exercise_id")]
    if not ids:
        return exercises

    # Batch-fetch all referenced exercises in one query
    rows = await db.scalars(
        select(Exercise).where(Exercise.id.in_(ids))
    )
    lookup = {str(row.id): row for row in rows.all()}

    enriched = []
    for ex in exercises:
        db_ex = lookup.get(ex.get("exercise_id"))
        if db_ex:
            ex["animation_url"] = db_ex.animation_url
            ex["instructions"] = db_ex.instructions
        enriched.append(ex)
    return enriched


@router.get("", response_model=list[RoutineResponse])
async def list_routines(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RoutineResponse]:
    """Return all routines owned by the authenticated user."""
    rows = await db.scalars(
        select(Routine)
        .where(Routine.user_id == user.id)
        .order_by(Routine.created_at.desc())
    )
    results = []
    for row in rows.all():
        enriched = await _enrich_exercises(db, row.exercises)
        resp = RoutineResponse.model_validate(row)
        resp.exercises = enriched
        results.append(resp)
    return results


@router.post("", response_model=RoutineResponse, status_code=201)
async def create_routine(
    body: RoutineCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineResponse:
    """Create a new custom routine."""
    exercises_data = [ex.model_dump() for ex in body.exercises]
    routine = Routine(
        user_id=user.id,
        name=body.name,
        exercises=exercises_data,
        schedule_days=body.schedule_days,
    )
    db.add(routine)
    await db.commit()
    await db.refresh(routine)
    enriched = await _enrich_exercises(db, routine.exercises)
    resp = RoutineResponse.model_validate(routine)
    resp.exercises = enriched
    return resp


@router.put("/{routine_id}", response_model=RoutineResponse)
async def update_routine(
    routine_id: UUID,
    body: RoutineUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoutineResponse:
    """Update an existing routine (partial update)."""
    routine = await db.scalar(
        select(Routine).where(
            Routine.id == routine_id,
            Routine.user_id == user.id,
        )
    )
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")

    if body.name is not None:
        routine.name = body.name
    if body.exercises is not None:
        routine.exercises = [ex.model_dump() for ex in body.exercises]
    if body.schedule_days is not None:
        routine.schedule_days = body.schedule_days

    await db.commit()
    await db.refresh(routine)
    enriched = await _enrich_exercises(db, routine.exercises)
    resp = RoutineResponse.model_validate(routine)
    resp.exercises = enriched
    return resp


@router.delete("/{routine_id}", status_code=204)
async def delete_routine(
    routine_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a routine owned by the authenticated user."""
    routine = await db.scalar(
        select(Routine).where(
            Routine.id == routine_id,
            Routine.user_id == user.id,
        )
    )
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")

    await db.delete(routine)
    await db.commit()

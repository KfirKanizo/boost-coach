"""Exercise catalogue endpoints.

GET /api/exercises - returns every seeded exercise for the client catalogue.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import Exercise
from app.schemas.exercise import ExerciseResponse

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ExerciseResponse]:
    """Return every exercise in the catalogue, ordered by name."""
    rows = await db.scalars(select(Exercise).order_by(Exercise.id.asc()))
    return [ExerciseResponse.model_validate(row) for row in rows.all()]

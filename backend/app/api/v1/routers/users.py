"""User profile endpoints.

GET   /api/users/me           - fetches the current user's profile metrics.
PATCH /api/users/me/profile   - progressive profiling metric updates.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.user import UserProfileResponse, UserProfileUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Return the authenticated user's profile (weight, height, streak)."""
    return UserProfileResponse.model_validate(user)


@router.patch("/me/profile", response_model=UserProfileResponse)
async def update_profile(
    payload: UserProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Apply progressive profiling updates.

    ``None`` values leave the existing field untouched so partial updates
    (e.g. from the onboarding wizard) don't clobber other data.
    """
    if payload.gender is not None:
        user.gender = payload.gender
    if payload.age is not None:
        user.age = payload.age
    if payload.weight is not None:
        user.weight = payload.weight
    if payload.height is not None:
        user.height = payload.height
    if payload.fitness_goals is not None:
        user.fitness_goals = payload.fitness_goals
    if payload.fitness_styles is not None:
        user.fitness_styles = payload.fitness_styles
    await db.commit()
    return UserProfileResponse.model_validate(user)

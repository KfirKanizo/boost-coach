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

    ``None`` values leave the existing metric untouched so the chat can send
    exactly one field per question without clobbering the other.
    """
    if payload.weight is not None:
        user.weight = payload.weight
    if payload.height is not None:
        user.height = payload.height
    await db.commit()
    return UserProfileResponse.model_validate(user)

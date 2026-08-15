"""Engine integration endpoints.

POST /api/engine/swap - deterministic Smart Swap rules engine.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.boost import BoostResponse
from app.schemas.swap import SwapRequest
from app.services.swap_engine import swap_daily_boost

router = APIRouter(prefix="/engine", tags=["engine"])


@router.post("/swap", response_model=BoostResponse)
async def swap_boost(
    payload: SwapRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoostResponse:
    """Swap the boost's exercise for an equivalent one and log the swap."""
    boost = await swap_daily_boost(
        db,
        boost_id=payload.boost_id,
        swap_reason=payload.swap_reason,
        user_id=user.id,
    )
    return BoostResponse.model_validate(boost)

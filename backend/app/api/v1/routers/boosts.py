"""Boost execution endpoints.

GET  /api/boosts/today              - today's pending and completed boosts.
PUT  /api/boosts/{boost_id}/complete - stores Edge AI result_metrics online.
POST /api/boosts/sync               - bulk-flushes the offline completion queue.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models import DailyBoost, User
from app.schemas.boost import (
    BoostCompleteRequest,
    BoostResponse,
    SyncItem,
    SyncResultResponse,
)

router = APIRouter(prefix="/boosts", tags=["boosts"])


@router.get("/today", response_model=list[BoostResponse])
async def get_today(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BoostResponse]:
    """Return the boosts scheduled for the current date for the user."""
    rows = await db.scalars(
        select(DailyBoost)
        .where(
            DailyBoost.user_id == user.id,
            DailyBoost.scheduled_date == date.today(),
        )
        .options(selectinload(DailyBoost.exercise))
        .order_by(DailyBoost.id.asc())
    )
    return [BoostResponse.model_validate(row) for row in rows.all()]


@router.put("/{boost_id}/complete", response_model=BoostResponse)
async def complete_boost(
    boost_id: uuid.UUID = Path(..., description="Boost UUID"),
    payload: BoostCompleteRequest = ...,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoostResponse:
    """Mark a boost completed online and store its result_metrics."""
    boost = await db.scalar(
        select(DailyBoost)
        .where(DailyBoost.id == boost_id, DailyBoost.user_id == user.id)
        .options(selectinload(DailyBoost.exercise))
    )
    if boost is None:
        raise HTTPException(status_code=404, detail="Daily boost not found")
    boost.status = "completed"
    boost.result_metrics = payload.result_metrics
    await db.commit()
    return BoostResponse.model_validate(boost)


@router.post("/sync", response_model=SyncResultResponse)
async def sync_boosts(
    payload: list[SyncItem],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultResponse:
    """Bulk-flush offline-queued completions in a single transaction.

    Boosts that do not belong to the current user (or no longer exist) are
    skipped rather than failing the whole batch; the remaining items are
    committed together so the queue is never left half-persisted.
    """
    synced = 0
    for item in payload:
        boost = await db.scalar(
            select(DailyBoost).where(DailyBoost.id == item.boost_id)
        )
        if boost is None or boost.user_id != user.id:
            continue
        boost.status = "completed"
        boost.result_metrics = item.result_metrics
        synced += 1
    await db.commit()
    return SyncResultResponse(synced=synced)

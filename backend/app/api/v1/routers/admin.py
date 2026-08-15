"""Admin endpoints protected by RBAC.

GET /api/admin/users - lists all users (admin only).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_db
from app.models import User
from app.schemas.user import AdminUserResponse

router = APIRouter(prefix="/admin", tags=["admin"])


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

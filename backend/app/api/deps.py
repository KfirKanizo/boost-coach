"""Shared dependency injection.

``get_db`` is re-exported from ``app.database`` so routers import their
dependencies from a single place. ``get_current_user`` validates a signed
JWT from the ``Authorization: Bearer <token>`` header and resolves the
matching user, raising 401 for invalid/expired tokens. ``get_current_admin_user``
wraps it and enforces RBAC with a 403 for non-admin users.
"""

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

__all__ = [
    "get_current_user",
    "get_current_admin_user",
    "get_db",
    "oauth2_scheme",
]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a validated JWT.

    Raises 401 when the token is missing, malformed, expired, or does not
    reference an existing user.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = decode_access_token(token)
    except (InvalidTokenError, ValueError, TypeError):
        raise credentials_exception
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise credentials_exception
    return user


async def get_current_admin_user(
    user: User = Depends(get_current_user),
) -> User:
    """Require the resolved user to have ``is_admin=True`` (403 otherwise)."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

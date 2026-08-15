"""JWT signing/verification helpers (PyJWT).

Access tokens are HS256-signed with the application ``SECRET_KEY``. The
``sub`` claim carries the user's UUID; the ``type`` claim disambiguates from
future refresh tokens.
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError

from app.core.config import settings


def create_access_token(
    subject: uuid.UUID,
    expires_minutes: int | None = None,
) -> str:
    """Sign a JWT for ``subject`` (the user's UUID).

    Defaults the lifetime to ``settings.access_token_expire_minutes``.
    """
    now = datetime.now(timezone.utc)
    lifetime = timedelta(
        minutes=expires_minutes
        if expires_minutes is not None
        else settings.access_token_expire_minutes
    )
    payload = {
        "sub": str(subject),
        "type": "access",
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    """Validate a JWT and return the subject user id.

    Raises ``jwt.InvalidTokenError`` for any malformed, expired, or
    incorrectly signed token; ``ValueError`` when the subject claim is not a
    valid UUID.
    """
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    subject = payload.get("sub")
    if not subject:
        raise InvalidTokenError("Missing subject claim")
    return uuid.UUID(subject)

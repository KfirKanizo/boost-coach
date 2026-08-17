"""Authentication endpoints.

POST /api/v1/auth/login    - simulates the third-party OAuth exchange: given the
                              user's email it finds the user and issues a signed
                              JWT access token. Real Google/Apple OAuth token
                              verification lands in the production auth milestone.
POST /api/v1/auth/register - creates a new user with email + hashed password.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Exchange an email for a JWT (401 when the user is not provisioned)."""
    email = payload.email.strip().lower()
    user = await db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return LoginResponse(access_token=token, token_type="bearer")


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """Create a new user account (400 if the email is already taken)."""
    email = payload.email.strip().lower()
    existing = await db.scalar(select(User).where(func.lower(User.email) == email))
    if existing is not None:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return RegisterResponse(id=str(user.id), email=user.email)

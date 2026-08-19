"""Aggregated v1 router.

Mounts every domain router under the shared ``/api/v1`` prefix.
"""

from fastapi import APIRouter

from app.api.v1.routers import (
    admin,
    auth,
    boosts,
    coach,
    engine,
    exercises,
    history,
    routines,
    seed,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(boosts.router)
api_router.include_router(exercises.router)
api_router.include_router(engine.router)
api_router.include_router(coach.router)
api_router.include_router(admin.router)
api_router.include_router(routines.router)
api_router.include_router(history.router)
api_router.include_router(seed.router)

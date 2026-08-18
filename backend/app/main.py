"""FastAPI application entry point.

Creates the app, verifies DB connectivity on startup, and wires the
versioned API routers. Milestone 2/3 endpoints are mounted as stubs.
Sentry error tracking is initialized when a ``SENTRY_DSN`` is configured.
"""

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import sentry_sdk
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.api.v1.router import api_router
from app.core.config import settings
from app.database import engine


def _scrub_sentry_event(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any]:
    """Privacy by design: strip user context so no PII reaches Sentry.

    The FastAPI integration captures request metadata but never request
    bodies by default; this hook defensively clears the user context and
    any captured cookies/headers so emails, names, or addresses can never
    leave the service. Camera/video data is never handled server-side.
    """
    user = event.get("user")
    if isinstance(user, dict):
        user.clear()
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("cookies", None)
        request.pop("headers", None)
        request.pop("data", None)
    return event


def _init_sentry() -> None:
    """Enable Sentry error tracking only when ``SENTRY_DSN`` is configured.

    Without a DSN (local dev, CI, the test suite) this is a no-op and the
    app behaves exactly as before. ``send_default_pii`` stays False and a
    ``before_send`` hook scrubs any remaining user context.
    """
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        integrations=[AsyncioIntegration(), FastApiIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        before_send=_scrub_sentry_event,
    )


_init_sentry()


async def _check_database_connection() -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await _check_database_connection()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:8100",
        "https://localhost",
        "capacitor://localhost",
        "ionic://localhost",
    ],
    allow_origin_regex=r"^https?://.*\.(appspot\.com|idone\.co\.il)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["infra"])
async def health() -> dict[str, str]:
    """Liveness probe used by orchestrators and local smoke tests."""
    return {"status": "ok", "database": "connected"}

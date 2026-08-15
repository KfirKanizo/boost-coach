"""Shared pytest fixtures for the BoostCoach API test suite.

Responsibilities:
  * Point the application at a dedicated ``boostcoach_test`` database so
    development data is never touched (via ``DATABASE_URL`` env override
    applied *before* importing any ``app`` module).
  * Create the test database on the Postgres server if it is missing.
  * Provide a session-scoped engine (``NullPool`` to avoid asyncio
    event-loop conflicts) and a transaction-per-test session that rolls
    back after every test.
  * Expose an async HTTP client bound to the FastAPI app with the DB
    dependency overridden to the transactional session.
"""

import asyncio
import os

BASE_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://boostcoach:boostcoach@db:5432/boostcoach",
)
TEST_DATABASE_NAME = os.environ.get("TEST_DATABASE_NAME", "boostcoach_test")
_HEAD, _, _ = BASE_DATABASE_URL.rpartition("/")
TEST_DATABASE_URL = f"{_HEAD}/{TEST_DATABASE_NAME}"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
import app.models  # noqa: F401  (registers all models on Base.metadata)
from app.main import app


async def _ensure_test_database() -> None:
    """Create the test database on the Postgres server if missing.

    ``CREATE DATABASE`` cannot run inside a transaction, so this connects
    directly to the ``postgres`` maintenance database with autocommit and
    retries briefly in case the ``db`` container is still starting.
    """
    url = make_url(TEST_DATABASE_URL)
    admin_url = url.set(database="postgres")

    conn: asyncpg.Connection | None = None
    for _ in range(10):
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=url.host or "localhost",
                    port=url.port or 5432,
                    user=url.username,
                    password=url.password,
                    database=admin_url.database,
                ),
                timeout=3,
            )
            break
        except (OSError, asyncpg.PostgresError, asyncio.TimeoutError):
            await asyncio.sleep(1)

    if conn is None:
        raise RuntimeError(
            f"Could not connect to Postgres to provision {TEST_DATABASE_URL}"
        )

    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", url.database
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{url.database}"')
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def test_engine():
    """Session-scoped async engine; schema reset per session.

    Uses ``NullPool`` so each test checks out a fresh connection in its own
    event loop, sidestepping ``MissingGreenlet``/cross-loop pool errors.
    """
    await _ensure_test_database()
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """Transaction-per-test session.

    The outer transaction stays open for the test duration and is rolled
    back on teardown; any ``commit()`` inside the test is a savepoint that
    is also discarded, guaranteeing test isolation.
    """
    async with test_engine.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest_asyncio.fixture
async def async_client(db_session):
    """HTTP client for the FastAPI app with the DB dependency overridden."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()

"""Regression tests for the app wiring and health probe."""


async def test_health_endpoint(async_client) -> None:
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


async def test_api_v1_routes_are_mounted(async_client) -> None:
    response = await async_client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    expected = {
        "/api/v1/auth/login",
        "/api/v1/users/me",
        "/api/v1/users/me/profile",
        "/api/v1/boosts/today",
        "/api/v1/boosts/{boost_id}/complete",
        "/api/v1/engine/swap",
        "/api/v1/coach/feedback",
        "/health",
    }
    assert expected.issubset(paths.keys())


async def test_database_connectivity(test_engine) -> None:
    """The async engine can reach Postgres and executes a round-trip."""
    from sqlalchemy import text

    async with test_engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1

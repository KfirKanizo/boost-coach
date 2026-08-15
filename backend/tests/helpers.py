"""Shared test helpers: JWT login and seed utilities."""

DEFAULT_LOGIN_EMAIL = "test@boostcoach.fit"


async def login_headers(async_client, db_session, email: str = DEFAULT_LOGIN_EMAIL):
    """Log in as ``email`` (must be seeded in ``db_session``) and return
    ``Authorization`` bearer headers carrying the issued JWT."""
    resp = await async_client.post("/api/v1/auth/login", json={"email": email})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

"""Tests for user profile endpoints (GET /me, PATCH /me/profile)."""

from app.models import User

from helpers import login_headers

DEFAULT_MOCK_EMAIL = "test@boostcoach.fit"


_DEFAULTS = {"weight": 70.0, "height": 175.0}


async def _seed_user(db_session, **overrides) -> User:
    user = User(email=DEFAULT_MOCK_EMAIL, **{**_DEFAULTS, **overrides})
    db_session.add(user)
    await db_session.flush()
    return user


async def test_me_returns_profile(async_client, db_session) -> None:
    user = await _seed_user(db_session)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.get("/api/v1/users/me", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(user.id)
    assert body["email"] == DEFAULT_MOCK_EMAIL
    assert body["weight"] == 70.0
    assert body["height"] == 175.0
    assert body["current_streak"] == 0
    assert body["gender"] is None
    assert body["age"] is None
    assert body["fitness_goals"] is None
    assert body["fitness_styles"] is None


async def test_me_returns_null_metrics_when_unset(async_client, db_session) -> None:
    user = User(email=DEFAULT_MOCK_EMAIL)
    db_session.add(user)
    await db_session.flush()

    headers = await login_headers(async_client, db_session)
    resp = await async_client.get("/api/v1/users/me", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["weight"] is None
    assert body["height"] is None
    assert body["email"] == user.email


async def test_me_selects_user_by_login_email(async_client, db_session) -> None:
    await _seed_user(db_session)
    other = User(email="other@boostcoach.fit", weight=55.5)
    db_session.add(other)
    await db_session.flush()

    headers = await login_headers(async_client, db_session, email="other@boostcoach.fit")
    resp = await async_client.get("/api/v1/users/me", headers=headers)

    assert resp.status_code == 200
    assert resp.json()["email"] == "other@boostcoach.fit"
    assert resp.json()["weight"] == 55.5


async def test_me_requires_a_user(async_client) -> None:
    resp = await async_client.get("/api/v1/users/me")

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


async def test_patch_profile_updates_weight(async_client, db_session) -> None:
    user = await _seed_user(db_session)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"weight": 82.5},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["weight"] == 82.5
    assert body["height"] == 175.0

    await db_session.refresh(user)
    assert user.weight == 82.5


async def test_patch_profile_updates_height_without_clobbering_weight(
    async_client, db_session
) -> None:
    user = await _seed_user(db_session)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"height": 180.0},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["height"] == 180.0
    assert body["weight"] == 70.0

    await db_session.refresh(user)
    assert user.height == 180.0


async def test_patch_profile_ignores_null_fields(async_client, db_session) -> None:
    user = await _seed_user(db_session, weight=None)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"weight": None, "height": 169.0},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["weight"] is None
    assert body["height"] == 169.0


async def test_patch_profile_requires_a_user(async_client) -> None:
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        json={"weight": 80},
    )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"


async def test_patch_profile_updates_onboarding_fields(async_client, db_session) -> None:
    user = await _seed_user(db_session)

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={
            "gender": "male",
            "age": 28,
            "fitness_goals": ["weight_loss", "endurance"],
            "fitness_styles": ["gym", "running"],
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["gender"] == "male"
    assert body["age"] == 28
    assert body["fitness_goals"] == ["weight_loss", "endurance"]
    assert body["fitness_styles"] == ["gym", "running"]

    await db_session.refresh(user)
    assert user.gender == "male"
    assert user.age == 28
    assert user.fitness_goals == ["weight_loss", "endurance"]
    assert user.fitness_styles == ["gym", "running"]


async def test_patch_profile_partial_onboarding_does_not_clobber(
    async_client, db_session
) -> None:
    user = await _seed_user(
        db_session,
        gender="female",
        age=30,
        fitness_goals=["muscle_gain"],
        fitness_styles=["yoga"],
    )

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"age": 31, "weight": 65.0},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["gender"] == "female"
    assert body["age"] == 31
    assert body["fitness_goals"] == ["muscle_gain"]
    assert body["fitness_styles"] == ["yoga"]
    assert body["weight"] == 65.0


async def test_patch_profile_replaces_goals_list(async_client, db_session) -> None:
    user = await _seed_user(db_session, fitness_goals=["old_goal"])

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"fitness_goals": ["new_goal", "another_goal"]},
    )

    assert resp.status_code == 200
    assert resp.json()["fitness_goals"] == ["new_goal", "another_goal"]

    await db_session.refresh(user)
    assert user.fitness_goals == ["new_goal", "another_goal"]


async def test_patch_profile_empty_goals_list(async_client, db_session) -> None:
    user = await _seed_user(db_session, fitness_goals=["old_goal"])

    headers = await login_headers(async_client, db_session)
    resp = await async_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"fitness_goals": []},
    )

    assert resp.status_code == 200
    assert resp.json()["fitness_goals"] == []

    await db_session.refresh(user)
    assert user.fitness_goals == []

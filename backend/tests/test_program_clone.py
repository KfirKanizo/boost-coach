"""Tests for program discovery and clone endpoints:

GET    /api/v1/programs            — list active pre-built programs (public).
POST   /api/v1/flows/clone/{id}    — clone a pre-built program into a custom routine.
"""

import uuid

from app.models import Exercise, PreBuiltProgram, User

from helpers import login_headers

DEFAULT_EMAIL = "test@boostcoach.fit"


async def _seed_user(db_session, email: str = DEFAULT_EMAIL) -> User:
    user = User(email=email)
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_exercise(db_session, name: str = "Push Up") -> Exercise:
    ex = Exercise(
        id=uuid.uuid4(),
        name_translations={"en": name},
        primary_muscle="chest",
        movement_pattern="push",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    db_session.add(ex)
    await db_session.flush()
    return ex


async def _seed_program(
    db_session,
    title: str = "Test Program",
    exercise_ids: list[str] | None = None,
    is_active: bool = True,
    equipment_category: str = "home",
) -> PreBuiltProgram:
    exercises = []
    if exercise_ids:
        for eid in exercise_ids:
            exercises.append({
                "exercise_id": eid,
                "sets": 3,
                "target_reps_or_duration": 10,
                "rest_time_after_sec": 60,
                "rest_seconds": 60,
            })
    program = PreBuiltProgram(
        title=title,
        description="A test program",
        muscle_tags=["chest"],
        equipment_category=equipment_category,
        exercises=exercises,
        is_active=is_active,
    )
    db_session.add(program)
    await db_session.flush()
    return program


# ── GET /programs ─────────────────────────────────────────────────────


async def test_list_public_programs(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    ex = await _seed_exercise(db_session, "Push Up")
    await _seed_program(db_session, "Home Push", exercise_ids=[str(ex.id)])

    resp = await async_client.get("/api/v1/programs", headers=headers)
    assert resp.status_code == 200
    programs = resp.json()
    assert len(programs) >= 1
    titles = [p["title"] for p in programs]
    assert "Home Push" in titles


async def test_list_public_programs_excludes_inactive(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    ex = await _seed_exercise(db_session)
    await _seed_program(db_session, "Inactive", exercise_ids=[str(ex.id)], is_active=False)

    resp = await async_client.get("/api/v1/programs", headers=headers)
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "Inactive" not in titles


async def test_list_public_programs_shows_equipment_category(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    ex = await _seed_exercise(db_session)
    await _seed_program(db_session, "Gym Program", exercise_ids=[str(ex.id)], equipment_category="gym")

    resp = await async_client.get("/api/v1/programs", headers=headers)
    assert resp.status_code == 200
    programs = resp.json()
    gym = [p for p in programs if p["title"] == "Gym Program"]
    assert len(gym) == 1
    assert gym[0]["equipment_category"] == "gym"


async def test_list_public_programs_requires_auth(async_client) -> None:
    resp = await async_client.get("/api/v1/programs")
    assert resp.status_code == 401


# ── POST /flows/clone/{program_id} ───────────────────────────────────


async def test_clone_program_creates_routine(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    ex = await _seed_exercise(db_session, "Push Up")
    program = await _seed_program(
        db_session, "Clone Me", exercise_ids=[str(ex.id)]
    )

    resp = await async_client.post(
        f"/api/v1/flows/clone/{program.id}", headers=headers
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Clone Me"
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["exercise_id"] == str(ex.id)


async def test_clone_program_404_for_missing(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    fake_id = str(uuid.uuid4())
    resp = await async_client.post(
        f"/api/v1/flows/clone/{fake_id}", headers=headers
    )
    assert resp.status_code == 404


async def test_clone_program_404_for_inactive(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    ex = await _seed_exercise(db_session, "Push Up")
    program = await _seed_program(
        db_session, "Inactive", exercise_ids=[str(ex.id)], is_active=False
    )

    resp = await async_client.post(
        f"/api/v1/flows/clone/{program.id}", headers=headers
    )
    assert resp.status_code == 404


async def test_clone_program_copies_all_parameters(async_client, db_session) -> None:
    await _seed_user(db_session)
    headers = await login_headers(async_client, db_session)

    ex = await _seed_exercise(db_session, "Push Up")
    program = await _seed_program(db_session, "Full Copy", exercise_ids=[str(ex.id)])

    resp = await async_client.post(
        f"/api/v1/flows/clone/{program.id}", headers=headers
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    exercise = body["exercises"][0]
    assert exercise["sets"] == 3
    assert exercise["reps"] == 10
    assert exercise["rest_seconds"] == 60
    assert exercise["rest_after_exercise"] == 60


async def test_clone_program_requires_auth(async_client, db_session) -> None:
    program = await _seed_program(db_session, "No Auth")
    resp = await async_client.post(f"/api/v1/flows/clone/{program.id}")
    assert resp.status_code == 401

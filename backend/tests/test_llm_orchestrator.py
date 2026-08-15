"""Tests for the Coach LLM orchestrator and its Zero-Friction fallback.

The real ``openai.AsyncOpenAI`` client is never used: a fake client is
injected via ``monkeypatch`` so success, timeout, and connection-error
paths are exercised deterministically and without external credentials.
"""

import asyncio
import time
from datetime import date
from types import SimpleNamespace

import pytest

import app.services.llm_orchestrator as llm
from app.core.config import settings
from app.models import DailyBoost, Exercise, User
from app.schemas.swap import CoachFeedbackResponse

from helpers import login_headers


def _fake_async_openai(create_fn, on_init=None):
    """Build a fake ``AsyncOpenAI`` class recording init kwargs and close state."""

    class FakeAsyncOpenAI:
        def __init__(self, **kwargs):
            self.init_kwargs = kwargs
            self.closed = False
            if on_init is not None:
                on_init(self)
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=create_fn)
            )

        async def close(self):
            self.closed = True

    return FakeAsyncOpenAI


def _completion(text):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))]
    )


async def _seed_user_and_boost(db_session, *, current_streak=0):
    user = User(email="coach@test.fit", current_streak=current_streak)
    done = Exercise(
        name_translations={"en": "Squat"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    pending = Exercise(
        name_translations={"en": "Plank"},
        primary_muscle="core",
        movement_pattern="isometric",
        equipment_required="bodyweight",
        boost_type="DURATION",
    )
    db_session.add_all([user, done, pending])
    await db_session.flush()

    completed = DailyBoost(
        user_id=user.id,
        exercise_id=done.id,
        status="completed",
        target_metrics={"sets": 3, "reps": 12},
        result_metrics={"reps_completed": 15},
        scheduled_date=date.today(),
    )
    not_completed = DailyBoost(
        user_id=user.id,
        exercise_id=pending.id,
        status="pending",
        target_metrics={"duration_sec": 60},
        result_metrics=None,
        scheduled_date=date.today(),
    )
    db_session.add_all([completed, not_completed])
    await db_session.flush()
    return user, done, pending


@pytest.mark.parametrize("api_key_env", [None, ""], ids=["unset", "empty"])
async def test_missing_api_key_never_touches_network(
    db_session, monkeypatch, api_key_env
) -> None:
    monkeypatch.setattr(settings, "llm_api_key", api_key_env)
    user, _, _ = await _seed_user_and_boost(db_session, current_streak=3)

    def _boom(*_args, **_kwargs):
        raise AssertionError("AsyncOpenAI must not be constructed without a key")

    monkeypatch.setattr(llm, "AsyncOpenAI", _fake_async_openai(_boom))

    result = await llm.generate_coach_feedback(db_session, user.id)

    assert isinstance(result, CoachFeedbackResponse)
    assert result.llm_feedback == llm.FALLBACK_FEEDBACK
    assert result.is_fallback is True
    assert result.new_streak == 4


async def test_success_returns_llm_feedback(db_session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    monkeypatch.setattr(settings, "llm_base_url", "https://llm.example.test")
    user, _, pending = await _seed_user_and_boost(db_session, current_streak=3)

    captured = {}

    async def fake_create(**kwargs):
        captured.update(kwargs)
        return _completion("Fantastic session! Your form on Squat looked great.")

    clients = []
    monkeypatch.setattr(
        llm, "AsyncOpenAI", _fake_async_openai(fake_create, on_init=clients.append)
    )

    result = await llm.generate_coach_feedback(db_session, user.id)

    assert result.llm_feedback == "Fantastic session! Your form on Squat looked great."
    assert result.is_fallback is False
    assert result.new_streak == 4

    assert len(clients) == 1
    assert clients[0].init_kwargs == {
        "api_key": "test-key",
        "base_url": "https://llm.example.test",
    }
    assert clients[0].closed is True

    assert captured["model"] == settings.llm_model
    user_message = captured["messages"][1]["content"]
    assert "3-day streak" in user_message
    assert "Squat" in user_message
    assert "reps_completed" in user_message
    assert pending.name_translations["en"] not in user_message


async def test_timeout_returns_fallback_within_budget(db_session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    monkeypatch.setattr(settings, "llm_timeout_seconds", 0.05)
    user, _, _ = await _seed_user_and_boost(db_session, current_streak=1)

    async def slow_create(**_kwargs):
        await asyncio.sleep(0.5)
        return _completion("too late")

    monkeypatch.setattr(llm, "AsyncOpenAI", _fake_async_openai(slow_create))

    start = time.monotonic()
    result = await llm.generate_coach_feedback(db_session, user.id)
    elapsed = time.monotonic() - start

    assert result.is_fallback is True
    assert result.llm_feedback == llm.FALLBACK_FEEDBACK
    assert result.new_streak == 2
    assert elapsed < 0.3, f"circuit breaker did not bound the call ({elapsed:.2f}s)"


async def test_connection_error_returns_fallback(db_session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    user, _, _ = await _seed_user_and_boost(db_session)

    async def failing_create(**_kwargs):
        raise RuntimeError("connection refused")

    monkeypatch.setattr(llm, "AsyncOpenAI", _fake_async_openai(failing_create))

    result = await llm.generate_coach_feedback(db_session, user.id)

    assert result.is_fallback is True
    assert result.llm_feedback == llm.FALLBACK_FEEDBACK


async def test_empty_llm_content_returns_fallback(db_session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    user, _, _ = await _seed_user_and_boost(db_session)

    async def empty_create(**_kwargs):
        return _completion("   ")

    monkeypatch.setattr(llm, "AsyncOpenAI", _fake_async_openai(empty_create))

    result = await llm.generate_coach_feedback(db_session, user.id)

    assert result.is_fallback is True


async def test_no_completed_boosts_keeps_streak(db_session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    user = User(email="coach@idle.fit", current_streak=7)
    db_session.add(user)
    await db_session.flush()

    async def fake_create(**_kwargs):
        return _completion("Rest is part of progress.")

    monkeypatch.setattr(llm, "AsyncOpenAI", _fake_async_openai(fake_create))

    result = await llm.generate_coach_feedback(db_session, user.id)

    assert result.llm_feedback == "Rest is part of progress."
    assert result.is_fallback is False
    assert result.new_streak == 7


async def test_feedback_endpoint_returns_fallback(async_client, db_session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", None)
    user = User(email="test@boostcoach.fit", current_streak=2)
    exercise = Exercise(
        name_translations={"en": "Squat"},
        primary_muscle="quadriceps",
        movement_pattern="squat",
        equipment_required="bodyweight",
        boost_type="VISION_REP",
    )
    db_session.add_all([user, exercise])
    await db_session.flush()
    db_session.add(
        DailyBoost(
            user_id=user.id,
            exercise_id=exercise.id,
            status="completed",
            target_metrics={"reps": 12},
            result_metrics={"reps_completed": 15},
            scheduled_date=date.today(),
        )
    )
    await db_session.flush()

    headers = await login_headers(async_client, db_session)
    resp = await async_client.post("/api/v1/coach/feedback", headers=headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["is_fallback"] is True
    assert body["llm_feedback"] == llm.FALLBACK_FEEDBACK
    assert body["new_streak"] == 3

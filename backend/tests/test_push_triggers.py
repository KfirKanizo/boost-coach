"""Tests for event-driven push notification triggers:

Level Up detection and Personal Record (PR) detection after workout completion.
Tests the service functions directly (unit) and via the API (integration).
"""

import uuid
from unittest.mock import AsyncMock, patch

from app.models import PushSubscription, User, WorkoutSession
from app.schemas.history import compute_level, compute_xp
from app.services.push_triggers import (
    _check_level_up,
    _check_personal_records,
    evaluate_workout_achievements,
)

from helpers import login_headers

DEFAULT_EMAIL = "test@boostcoach.fit"


async def _seed_user(db_session, email: str = DEFAULT_EMAIL) -> User:
    user = User(email=email)
    db_session.add(user)
    await db_session.flush()
    return user


async def _seed_push_subscription(db_session, user_id: uuid.UUID) -> PushSubscription:
    sub = PushSubscription(
        user_id=user_id,
        fcm_token="test-fcm-token-trigger",
    )
    db_session.add(sub)
    await db_session.flush()
    return sub


async def _seed_session(db_session, user_id: uuid.UUID, **kwargs) -> WorkoutSession:
    defaults = {
        "session_type": "single",
        "total_reps": 30,
        "total_duration_seconds": 120,
        "exercise_count": 1,
        "verified_reps": 30,
        "xp_earned": 350,
    }
    defaults.update(kwargs)
    session = WorkoutSession(user_id=user_id, **defaults)
    db_session.add(session)
    await db_session.flush()
    return session


# ── Unit tests: _check_level_up ─────────────────────────────────────


async def test_level_up_sends_notification(db_session) -> None:
    """Level increases when XP crosses threshold → push sent."""
    user = await _seed_user(db_session)
    await _seed_push_subscription(db_session, user.id)

    # Seed with 950 XP (level 3: floor(sqrt(9.5)) + 1 = 4)
    await _seed_session(db_session, user.id, xp_earned=950, total_reps=95)

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.return_value = 1
        await _check_level_up(db_session, user_id=user.id, xp_earned=100)

        mock_dispatch.assert_called_once()
        call_kwargs = mock_dispatch.call_args.kwargs
        assert "Level Up" in call_kwargs["title"]
        assert "/profile" in call_kwargs["data"]["link"]


async def test_level_up_no_notification_when_no_change(db_session) -> None:
    """Level stays the same → no push sent."""
    user = await _seed_user(db_session)

    # Seed with 50 XP (level 1)
    await _seed_session(db_session, user.id, xp_earned=50, total_reps=5)

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.return_value = 0
        await _check_level_up(db_session, user_id=user.id, xp_earned=50)

        mock_dispatch.assert_not_called()


# ── Unit tests: _check_personal_records ──────────────────────────────


async def test_pr_reps_sends_notification(db_session) -> None:
    """New reps record → push sent."""
    user = await _seed_user(db_session)
    await _seed_push_subscription(db_session, user.id)

    # Seed with 50 reps (historical best)
    await _seed_session(db_session, user.id, total_reps=50, xp_earned=500)

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.return_value = 1
        await _check_personal_records(
            db_session, user_id=user.id, total_reps=75, total_duration_seconds=0
        )

        mock_dispatch.assert_called_once()
        call_kwargs = mock_dispatch.call_args.kwargs
        assert "Personal Record" in call_kwargs["title"]
        assert "75 reps" in call_kwargs["body"]
        assert "/statistics" in call_kwargs["data"]["link"]


async def test_pr_duration_sends_notification(db_session) -> None:
    """New duration record → push sent."""
    user = await _seed_user(db_session)
    await _seed_push_subscription(db_session, user.id)

    # Seed with 300s (5 min) historical best
    await _seed_session(
        db_session, user.id, total_reps=30, total_duration_seconds=300, xp_earned=350
    )

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.return_value = 1
        await _check_personal_records(
            db_session,
            user_id=user.id,
            total_reps=10,
            total_duration_seconds=600,
        )

        mock_dispatch.assert_called_once()
        call_kwargs = mock_dispatch.call_args.kwargs
        assert "Personal Record" in call_kwargs["title"]
        assert "10 minutes" in call_kwargs["body"]


async def test_pr_no_notification_when_no_record(db_session) -> None:
    """No new record → no push sent."""
    user = await _seed_user(db_session)

    # Seed with 100 reps and 600s
    await _seed_session(
        db_session,
        user.id,
        total_reps=100,
        total_duration_seconds=600,
        xp_earned=1000,
    )

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.return_value = 0
        await _check_personal_records(
            db_session, user_id=user.id, total_reps=50, total_duration_seconds=300
        )

        mock_dispatch.assert_not_called()


async def test_pr_first_session_no_notification(db_session) -> None:
    """First session ever → no 'previous best' to beat → no push."""
    user = await _seed_user(db_session)

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.return_value = 0
        await _check_personal_records(
            db_session, user_id=user.id, total_reps=50, total_duration_seconds=300
        )

        mock_dispatch.assert_not_called()


# ── Unit test: evaluate_workout_achievements (full hook) ─────────────


async def test_evaluate_hook_never_raises(db_session) -> None:
    """The hook must not raise even if dispatch_push blows up."""
    user = await _seed_user(db_session)

    with patch(
        "app.services.push_triggers.dispatch_push", new_callable=AsyncMock
    ) as mock_dispatch:
        mock_dispatch.side_effect = RuntimeError("boom")
        # Should not raise
        await evaluate_workout_achievements(
            db_session,
            user_id=user.id,
            xp_earned=100,
            total_reps=20,
            total_duration_seconds=60,
        )


# ── Integration: API triggers don't break the main request ───────────


async def test_complete_workout_triggers_push_background(
    async_client, db_session
) -> None:
    """POST /history/complete returns 201 even when push triggers fire."""
    user = await _seed_user(db_session)
    await _seed_push_subscription(db_session, user.id)
    headers = await login_headers(async_client, db_session)

    with patch(
        "app.api.v1.routers.history.evaluate_workout_achievements",
        new_callable=AsyncMock,
    ) as mock_trigger:
        resp = await async_client.post(
            "/api/v1/history/complete",
            headers=headers,
            json={
                "session_type": "single",
                "total_reps": 60,
                "total_duration_seconds": 0,
                "exercise_count": 1,
                "verified_reps": 60,
                "target_reps": 60,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["level"] >= 3
        assert body["previous_level"] == 1

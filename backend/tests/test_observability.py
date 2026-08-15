"""Observability (Sentry) wiring tests.

These verify the opt-in contract: without a ``SENTRY_DSN`` the app runs
identically with telemetry disabled, and when a DSN is present Sentry is
initialized with the FastAPI integration and PII scrubbing enabled.
"""

from typing import Any

from app.core.config import settings


def test_sentry_dsn_defaults_to_none() -> None:
    """Telemetry is disabled by default (no DSN configured)."""
    assert settings.sentry_dsn is None


def test_init_sentry_is_noop_without_dsn(monkeypatch) -> None:
    import sentry_sdk

    from app.main import _init_sentry

    captured: list[dict[str, Any]] = []

    def fake_init(**kwargs: Any) -> None:
        captured.append(kwargs)

    monkeypatch.setattr(sentry_sdk, "init", fake_init)
    monkeypatch.setattr(settings, "sentry_dsn", None)

    _init_sentry()

    assert captured == []


def test_init_sentry_uses_dsn_with_pii_scrubbing(monkeypatch) -> None:
    import sentry_sdk

    from app.main import _init_sentry

    captured: list[dict[str, Any]] = []

    def fake_init(**kwargs: Any) -> None:
        captured.append(kwargs)

    monkeypatch.setattr(sentry_sdk, "init", fake_init)
    monkeypatch.setattr(
        settings, "sentry_dsn", "https://abc@example.ingest.sentry.io/123"
    )

    _init_sentry()

    assert len(captured) == 1
    init_kwargs = captured[0]
    assert init_kwargs["dsn"] == "https://abc@example.ingest.sentry.io/123"
    assert init_kwargs["send_default_pii"] is False
    assert init_kwargs["environment"] == settings.app_env
    assert init_kwargs["before_send"] is not None
    integration_types = {
        type(integration).__name__ for integration in init_kwargs["integrations"]
    }
    assert "FastApiIntegration" in integration_types
    assert "AsyncioIntegration" in integration_types


def test_scrub_sentry_event_removes_user_and_request_pii() -> None:
    from app.main import _scrub_sentry_event

    event: dict[str, Any] = {
        "user": {"email": "user@example.com", "ip_address": "203.0.113.9"},
        "request": {
            "url": "https://api.example.com/health",
            "cookies": {"session": "secret"},
            "headers": {"Authorization": "Bearer secret", "Host": "api.example.com"},
            "data": {"email": "user@example.com"},
        },
        "message": "something broke",
    }

    scrubbed = _scrub_sentry_event(event, {})

    assert scrubbed["user"] == {}
    assert "cookies" not in scrubbed["request"]
    assert "headers" not in scrubbed["request"]
    assert "data" not in scrubbed["request"]
    assert scrubbed["message"] == "something broke"

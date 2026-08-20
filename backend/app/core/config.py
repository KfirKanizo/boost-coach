"""Application configuration via pydantic-settings.

Reads environment variables, with optional overrides from a `.env` file
(see ``.env.example``). Kept as the single source of truth for runtime
configuration consumed by the database, API, and Alembic layers.

LLM settings are optional: the coach circuit-breaker falls back to local
feedback when no ``LLM_API_KEY``/``OPENAI_API_KEY`` is configured, so the
test suites and local development run without external credentials.
"""

import secrets

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BoostCoach API"
    app_env: str = "development"
    debug: bool = True
    db_echo: bool = False

    database_url: str = (
        "postgresql+asyncpg://boostcoach:boostcoach@db:5432/boostcoach"
    )

    # --- LLM coach (OpenAI-compatible) ----------------------------------
    llm_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_API_KEY", "OPENAI_API_KEY"),
    )
    llm_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("LLM_BASE_URL", "OPENAI_BASE_URL"),
    )
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 60.0

    # --- Auth / JWT -----------------------------------------------------
    secret_key: str = Field(
        default_factory=lambda: secrets.token_urlsafe(48),
        description=(
            "JWT signing secret. Always set SECRET_KEY in production; a "
            "random per-boot key is generated as a development fallback."
        ),
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # --- Google OAuth2 ---------------------------------------------------
    google_client_id: str = Field(
        default="408983234494-j55u6qlk8d476pfn75ur9m5f5annefjm.apps.googleusercontent.com",
        validation_alias=AliasChoices("GOOGLE_CLIENT_ID"),
        description="Google OAuth2 web client ID for ID token verification.",
    )

    # --- Observability (Sentry, optional) -------------------------------
    # Leave unset to run with error tracking fully disabled (local dev,
    # CI, tests). Privacy by design: `send_default_pii` stays False and a
    # before_send scrubber strips user context — no PII ever leaves the
    # service, and no camera/video data is captured anywhere.
    sentry_dsn: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SENTRY_DSN"),
        description=(
            "Sentry DSN for error tracking. Optional — when omitted the "
            "app starts exactly as before with telemetry disabled."
        ),
    )


settings = Settings()

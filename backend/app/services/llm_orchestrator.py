"""Coach feedback orchestration with a Zero-Friction resilience protocol.

``generate_coach_feedback`` aggregates the user's completed boosts for the
current day, requests concise motivational feedback from an OpenAI-compatible
provider, and enforces a hard circuit breaker:

  * The external call is bounded by ``asyncio.wait_for`` (3.0s by default);
    the limit can never be exceeded.
  * Any timeout, connection error, or empty response is caught immediately and
    answered with a warm local fallback marked ``is_fallback=True``.
  * Without a configured ``LLM_API_KEY`` the fallback is returned without
    ever touching the network.
"""

import asyncio
import logging
from datetime import date

from fastapi import HTTPException
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models import DailyBoost, User
from app.schemas.swap import CoachFeedbackResponse

logger = logging.getLogger(__name__)

FALLBACK_FEEDBACK = (
    "Incredible work today! Your energy map is glowing. See you tomorrow!"
)

COACH_SYSTEM_PROMPT = (
    "You are BoostCoach's personal fitness coach. Write 1-2 short, warm, "
    "motivating sentences that celebrate the user's effort and reinforce "
    "their streak. Never invent metrics that are not provided. Do not use "
    "markdown, emojis, or bullet lists."
)


async def _load_context(
    db: AsyncSession,
    user_id,
) -> tuple[User, list[DailyBoost]]:
    """Load the user and today's completed boosts (with their exercises)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    rows = await db.scalars(
        select(DailyBoost)
        .where(
            DailyBoost.user_id == user_id,
            DailyBoost.scheduled_date == date.today(),
            DailyBoost.status == "completed",
        )
        .options(selectinload(DailyBoost.exercise))
        .order_by(DailyBoost.id.asc())
    )
    return user, list(rows.all())


def _build_prompt(user: User, boosts: list[DailyBoost]) -> str:
    """Serialize the workout context into a compact user message."""
    if boosts:
        summaries = "; ".join(
            (
                f"{boost.exercise.name_translations.get('en', 'Exercise')} — "
                f"target {boost.target_metrics}, result {boost.result_metrics or {}}"
            )
            for boost in boosts
        )
        context = f"Today's completed boosts ({len(boosts)}): {summaries}."
    else:
        context = "No boosts completed today."

    return (
        f"The user is on a {user.current_streak}-day streak.\n"
        f"{context}\n"
        "Give brief, personalized coaching feedback."
    )


async def _request_feedback(user: User, boosts: list[DailyBoost]) -> str:
    """Call the LLM and return its text, failing fast on any error."""
    client = AsyncOpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
    try:
        completion = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": COACH_SYSTEM_PROMPT},
                    {"role": "user", "content": _build_prompt(user, boosts)},
                ],
                temperature=0.7,
                max_tokens=160,
            ),
            timeout=settings.llm_timeout_seconds,
        )
    finally:
        await client.close()

    content = (completion.choices[0].message.content or "").strip()
    if not content:
        raise ValueError("empty LLM response")
    return content


async def generate_coach_feedback(
    db: AsyncSession,
    user_id,
) -> CoachFeedbackResponse:
    """Return coach feedback, always falling back locally under any failure."""
    user, boosts = await _load_context(db, user_id)
    new_streak = user.current_streak + (1 if boosts else 0)

    if not settings.llm_api_key:
        logger.warning("No LLM_API_KEY configured; using local fallback feedback")
        return CoachFeedbackResponse(
            llm_feedback=FALLBACK_FEEDBACK,
            new_streak=new_streak,
            is_fallback=True,
        )

    try:
        feedback = await _request_feedback(user, boosts)
    except Exception as exc:  # noqa: BLE001 - resilience boundary: never leak LLM errors
        logger.warning("Coach LLM unavailable, using fallback feedback: %s", exc)
        return CoachFeedbackResponse(
            llm_feedback=FALLBACK_FEEDBACK,
            new_streak=new_streak,
            is_fallback=True,
        )

    return CoachFeedbackResponse(
        llm_feedback=feedback,
        new_streak=new_streak,
        is_fallback=False,
    )

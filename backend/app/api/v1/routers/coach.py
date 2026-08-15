"""Coach (LLM) endpoints.

POST /api/coach/feedback - aggregates today's metrics, calls the LLM,
and returns conversational feedback with a fallback circuit breaker.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.swap import CoachFeedbackResponse
from app.services.llm_orchestrator import generate_coach_feedback

router = APIRouter(prefix="/coach", tags=["coach"])


@router.post("/feedback", response_model=CoachFeedbackResponse)
async def get_feedback(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CoachFeedbackResponse:
    """Return personalized LLM feedback with a local fallback circuit breaker."""
    return await generate_coach_feedback(db, user.id)

"""Simplified chat service that forwards requests to RAG pipeline."""

from typing import Dict, Any
import httpx
import structlog

from lcfs.web.api.chat.schemas import ChatCompletionRequest
from lcfs.db.models.user import UserProfile
from lcfs.settings import settings

logger = structlog.get_logger(__name__)


class ChatService:
    """Simplified service that forwards chat requests to RAG pipeline."""

    def __init__(self):
        self.rag_service_url = settings.rag_service_url

    async def create_completion(
        self, request: ChatCompletionRequest, user: UserProfile
    ) -> Dict[str, Any]:
        """Forward chat completion request to the RAG service and return JSON response."""
        messages = [msg.dict(exclude_none=True) for msg in request.messages]

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.rag_service_url}/lcfs_rag/run",
                    json={"messages": messages},
                )
                response.raise_for_status()
                rag_result = response.json()

            return rag_result.get("result") or rag_result
        except Exception as exc:
            logger.error(
                "chat_completion_error",
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise

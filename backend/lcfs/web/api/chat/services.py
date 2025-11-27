"""Simplified chat service that forwards requests to RAG pipeline."""

import json
import uuid
from typing import AsyncGenerator
import asyncio
import httpx
import structlog

from lcfs.web.api.chat.schemas import (
    ChatCompletionRequest,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
)
from lcfs.db.models.user import UserProfile
from lcfs.settings import settings

logger = structlog.get_logger(__name__)


class ChatService:
    """Simplified service that forwards chat requests to RAG pipeline."""

    def __init__(self):
        self.rag_service_url = settings.rag_service_url

    async def stream_completion(
        self, request: ChatCompletionRequest, user: UserProfile
    ) -> AsyncGenerator[str, None]:
        """Forward streaming chat completion to RAG service."""
        try:
            # Get non-streaming response from RAG service first
            messages = [msg.dict(exclude_none=True) for msg in request.messages]

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.rag_service_url}/lcfs_rag/run", json={"messages": messages}
                )
                response.raise_for_status()
                rag_result = response.json()

            # Convert to streaming format
            completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
            # RAG service wraps response in "result" field
            result_data = rag_result.get("result", {})
            answer = (
                result_data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "No response")
            )

            # Send initial chunk with role
            initial_chunk = ChatCompletionChunk(
                id=completion_id,
                model=request.model,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0,
                        delta=ChatCompletionChunkDelta(role="assistant"),
                        finish_reason=None,
                    )
                ],
            )
            yield f"data: {json.dumps(initial_chunk.dict())}\n\n"

            # Stream response word by word
            words = answer.split()
            for i, word in enumerate(words):
                content = word + " " if i < len(words) - 1 else word

                content_chunk = ChatCompletionChunk(
                    id=completion_id,
                    model=request.model,
                    choices=[
                        ChatCompletionChunkChoice(
                            index=0,
                            delta=ChatCompletionChunkDelta(content=content),
                            finish_reason=None,
                        )
                    ],
                )
                yield f"data: {json.dumps(content_chunk.dict())}\n\n"

                await asyncio.sleep(0.03)

            # Send final chunk
            final_chunk = ChatCompletionChunk(
                id=completion_id,
                model=request.model,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0, delta=ChatCompletionChunkDelta(), finish_reason="stop"
                    )
                ],
            )
            yield f"data: {json.dumps(final_chunk.dict())}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("streaming_error", error=str(e), error_type=type(e).__name__)
            # Send error in streaming format
            error_chunk = ChatCompletionChunk(
                id=f"chatcmpl-{uuid.uuid4().hex[:12]}",
                model=request.model,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0,
                        delta=ChatCompletionChunkDelta(content=f"Error: {str(e)}"),
                        finish_reason="stop",
                    )
                ],
            )
            yield f"data: {json.dumps(error_chunk.dict())}\n\n"
            yield "data: [DONE]\n\n"

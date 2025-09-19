"""Chat API endpoints with OpenAI compatibility."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from lcfs.web.api.chat.schemas import (
    ChatCompletionRequest,
    ErrorResponse,
)
from lcfs.web.api.chat.services import ChatService
from lcfs.db.models.user import UserProfile
from lcfs.web.core.decorators import view_handler
from lcfs.db.base import get_current_user

router = APIRouter()


@router.post(
    "/completions",
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
@view_handler(["*"])
async def chat_completions(
    request: Request,
    chat_request: ChatCompletionRequest,
    current_user: UserProfile = Depends(get_current_user),
) -> StreamingResponse:
    """
    Create a streaming chat completion.

    Compatible with OpenAI's chat completions API.
    All responses are streamed.

    Args:
        request: FastAPI Request object
        chat_request: Chat completion request in OpenAI format
        current_user: Current authenticated user

    Returns:
        Streaming chat completion response
    """
    if not chat_request.messages:
        raise HTTPException(
            status_code=400,
            detail="messages field is required and cannot be empty"
        )

    # Validate messages
    for i, message in enumerate(chat_request.messages):
        if not message.content.strip():
            raise HTTPException(
                status_code=400,
                detail=f"Message at index {i} has empty content"
            )

    chat_service = ChatService()

    return StreamingResponse(
        chat_service.stream_completion(chat_request, current_user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
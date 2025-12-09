"""Chat API endpoints with OpenAI compatibility."""

import uuid
from datetime import datetime
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
import structlog

from lcfs.web.api.chat.schemas import (
    ChatCompletionRequest,
    ErrorResponse,
    EscalationRequest,
    EscalationResponse,
)
from lcfs.web.api.chat.services import ChatService
from lcfs.web.api.email.services import CHESEmailService
from lcfs.db.models.user import UserProfile
from lcfs.web.core.decorators import view_handler
from lcfs.db.base import get_current_user
from lcfs.settings import settings

router = APIRouter()
logger = structlog.get_logger(__name__)


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
) -> Dict[str, Any]:
    """
    Create a chat completion using the RAG service and return
    an OpenAI-compatible JSON response.

    Args:
        request: FastAPI Request object
        chat_request: Chat completion request in OpenAI format
        current_user: Current authenticated user

    Returns:
        Chat completion JSON response
    """
    if not chat_request.messages:
        raise HTTPException(
            status_code=400, detail="messages field is required and cannot be empty"
        )

    # Validate messages
    for i, message in enumerate(chat_request.messages):
        if not message.content.strip():
            raise HTTPException(
                status_code=400, detail=f"Message at index {i} has empty content"
            )

    chat_service = ChatService()

    result = await chat_service.create_completion(chat_request, current_user)
    return result


@router.post(
    "/escalate",
    response_model=EscalationResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
@view_handler(["*"])
async def escalate_to_support(
    request: Request,
    escalation_request: EscalationRequest,
    current_user: UserProfile = Depends(get_current_user),
    email_service: CHESEmailService = Depends(),
) -> EscalationResponse:
    """
    Escalate a chat conversation to support.

    Sends the conversation history and user's issue to the support team.
    """
    # Generate a ticket ID for tracking
    ticket_id = (
        f"LCFS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    )

    # Format the issue type for display
    issue_type_labels = {
        "question": "General Question",
        "issue": "Report an Issue",
        "feedback": "Feedback",
    }
    issue_type_display = issue_type_labels.get(
        escalation_request.issue_type, escalation_request.issue_type
    )

    # Build the email body
    email_body = f"""
<h2>LCFS Assistant Support Request</h2>

<p><strong>Ticket ID:</strong> {ticket_id}</p>
<p><strong>Submitted:</strong> {escalation_request.submitted_at}</p>
<p><strong>Low Confidence Escalation:</strong> {"Yes" if escalation_request.is_low_confidence else "No"}</p>

<hr>

<h3>User Information</h3>
<p><strong>Name:</strong> {escalation_request.user_name}</p>
<p><strong>Email:</strong> {escalation_request.user_email}</p>
<p><strong>Organization:</strong> {escalation_request.organization_name or "N/A"}</p>
<p><strong>Organization ID:</strong> {escalation_request.organization_id or "N/A"}</p>

<hr>

<h3>Issue Details</h3>
<p><strong>Issue Type:</strong> {issue_type_display}</p>
<p><strong>Description:</strong></p>
<p>{escalation_request.description}</p>

<hr>

<h3>Conversation History</h3>
<pre style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: monospace;">
{escalation_request.conversation_history or "No conversation history available."}
</pre>
    """.strip()

    # Build email payload
    email_payload = {
        "bcc": [],
        "bodyType": "html",
        "body": email_body,
        "cc": [],
        "delayTS": 0,
        "encoding": "utf-8",
        "from": settings.ches_sender_email,
        "priority": "normal",
        "subject": f"[{ticket_id}] LCFS Assistant Support Request - {issue_type_display}",
        "to": [settings.ches_support_email],
        "tag": "lcfs-assistant-escalation",
    }

    try:
        success = await email_service.send_email(email_payload)
        if success:
            logger.info(
                "Escalation email sent successfully",
                ticket_id=ticket_id,
                user_email=escalation_request.user_email,
                issue_type=escalation_request.issue_type,
            )
            return EscalationResponse(
                status="success",
                message="Your request has been submitted successfully.",
                ticket_id=ticket_id,
            )
        else:
            logger.warning(
                "Escalation email sending returned False",
                ticket_id=ticket_id,
                user_email=escalation_request.user_email,
            )
            # Still return success to user since we don't want to block them
            return EscalationResponse(
                status="success",
                message="Your request has been submitted. Our team will review it shortly.",
                ticket_id=ticket_id,
            )
    except Exception as e:
        logger.error(
            "Failed to send escalation email",
            error=str(e),
            ticket_id=ticket_id,
            user_email=escalation_request.user_email,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to submit your request. Please try again later.",
        )

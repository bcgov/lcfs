from fastapi import APIRouter, Depends, status, Request
from typing import Dict
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.core.decorators import view_handler

router = APIRouter()


@router.post(
    "/test-email-notification",
    status_code=status.HTTP_200_OK,
    summary="Test Default Email Notification",
    response_model=Dict[str, str],
)
@view_handler(["*"])
async def test_email_notification(
    request: Request,
    service: CHESEmailService = Depends(),
):
    """
    Endpoint to test sending a default email notification.
    This is primarily for validating the email notification setup.
    """
    # Define a test notification context
    notification_context = {
        "subject": "Test Notification",
        "user_name": "Test User",
        "message_body": "This is a test notification email from LCFS Notification System.",
    }

    # Notification type and organization for testing
    notification_type = "INITIATIVE_APPROVED"
    organization_id = None  # Replace with a valid organization ID for testing

    # Trigger the email sending process
    success = await service.send_notification_email(
        notification_type=notification_type,
        notification_context=notification_context,
        organization_id=organization_id,
    )

    if success:
        return {"status": "success", "message": "Test email sent successfully."}
    else:
        return {"status": "failure", "message": "Failed to send test email."}

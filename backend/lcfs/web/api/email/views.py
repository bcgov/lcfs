from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Dict
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.email.schema import EmailNotificationRequest
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.core.decorators import view_handler
from lcfs.web.core.rate_limit import RateLimit, enforce_rate_limit

router = APIRouter()

# This endpoint sends real email to real subscribers, so cap how often a single
# administrator can trigger it. Keyed per user (not per IP) so that users behind
# a shared proxy do not share a budget.
TEST_EMAIL_RATE_LIMIT = RateLimit(
    times=5,
    seconds=60,
    bucket="email:test-email-notification",
    scope="user",
)


@router.post(
    "/test-email-notification",
    status_code=status.HTTP_200_OK,
    summary="Test Default Email Notification",
    response_model=Dict[str, str],
)
@view_handler([RoleEnum.ADMINISTRATOR, RoleEnum.SYSTEM_ADMIN])
async def test_email_notification(
    request: Request,
    payload: EmailNotificationRequest,
    service: CHESEmailService = Depends(),
):
    """
    Endpoint to test sending a default email notification.
    This is primarily for validating the email notification setup.

    Restricted to Administrator and System Admin users and rate limited, because
    it delivers real email to the subscribers of the chosen organization.
    """
    await enforce_rate_limit(request, TEST_EMAIL_RATE_LIMIT)

    # Define a test notification context
    notification_context = {
        "subject": "Test Notification",
        "user_name": "Test User",
        "message_body": "This is a test notification email from LCFS Notification System.",
    }

    # Extract notification type and organization ID from the request payload
    notification_type = payload.notification_type
    organization_id = payload.organization_id

    # Trigger the email sending process
    success = await service.send_notification_email(
        notification_type=notification_type,
        notification_context=notification_context,
        organization_id=organization_id,
    )

    if success:
        return {"status": "success", "message": "Test email sent successfully."}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send test email."
        )

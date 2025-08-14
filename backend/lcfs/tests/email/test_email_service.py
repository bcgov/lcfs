from lcfs.web.api.base import AudienceType, NotificationTypeEnum
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.web.api.email.services import CHESEmailService
import os


@pytest.fixture
def mock_email_repo():
    return AsyncMock(spec=CHESEmailRepository)


@pytest.fixture
def mock_environment_vars():
    with patch("lcfs.web.api.email.services.settings") as mock_settings:
        mock_settings.ches_auth_url = "http://mock_auth_url"
        mock_settings.ches_email_url = "http://mock_email_url"
        mock_settings.ches_client_id = "mock_client_id"
        mock_settings.ches_client_secret = "mock_client_secret"
        mock_settings.ches_sender_email = "noreply@gov.bc.ca"
        mock_settings.ches_sender_name = "Mock Notification System"
        yield mock_settings


@pytest.mark.anyio
async def test_send_notification_email_success(mock_email_repo, mock_environment_vars):
    # Arrange
    notification_type = (
        NotificationTypeEnum.BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT
    )
    notification_context = {
        "subject": "Test Notification",
        "user_name": "John Doe",
        "message_body": "Test message content",
    }
    organization_id = 1

    # Setup mock repo and service
    mock_email_repo.get_subscribed_user_emails.return_value = ["user@example.com"]
    service = CHESEmailService(repo=mock_email_repo)

    # Mock internal methods
    service._render_email_template = MagicMock(return_value="Rendered HTML Content")
    service.send_email = AsyncMock(return_value=True)

    # Act
    result = await service.send_notification_email(
        notification_type, notification_context, organization_id
    )

    # Assert
    assert result is True
    mock_email_repo.get_subscribed_user_emails.assert_called_once_with(
        notification_type.value, organization_id, AudienceType.SAME_ORGANIZATION  # Ensure value is passed with audience type
    )
    service._render_email_template.assert_called_once_with(
        notification_type.value, notification_context
    )
    service.send_email.assert_called_once()


@pytest.mark.anyio
async def test_send_notification_email_no_recipients(
    mock_email_repo, mock_environment_vars
):
    # Arrange
    notification_type = NotificationTypeEnum.BCEID__TRANSFER__PARTNER_ACTIONS
    notification_context = {
        "subject": "Test Notification",
        "user_name": "John Doe",
        "message_body": "Test message content",
    }
    organization_id = 1

    # Setup mock repo and service
    mock_email_repo.get_subscribed_user_emails.return_value = []
    service = CHESEmailService(repo=mock_email_repo)

    # Act
    result = await service.send_notification_email(
        notification_type, notification_context, organization_id
    )

    # Assert
    assert result is False
    mock_email_repo.get_subscribed_user_emails.assert_called_once_with(
        notification_type.value, organization_id, AudienceType.SAME_ORGANIZATION  # Ensure value is passed with audience type
    )


@pytest.mark.anyio
async def test_get_ches_token_success(mock_environment_vars):
    # Arrange
    mock_token = "mock_access_token"
    with patch("requests.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": mock_token,
            "expires_in": 3600,
        }
        mock_post.return_value = mock_response

        service = CHESEmailService()

        # Act
        token = await service._get_ches_token()

        # Assert
        assert token == mock_token
        mock_post.assert_called_once()


@pytest.mark.anyio
async def test_get_ches_token_cached(mock_environment_vars):
    # Arrange
    with patch("requests.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "initial_token",
            "expires_in": 3600,
        }
        mock_post.return_value = mock_response

        service = CHESEmailService()

        # First call to get token
        first_token = await service._get_ches_token()

        # Reset mock to ensure no second call is made
        mock_post.reset_mock()

        # Act: Second call should return cached token
        second_token = await service._get_ches_token()

        # Assert
        assert first_token == second_token
        mock_post.assert_not_called()

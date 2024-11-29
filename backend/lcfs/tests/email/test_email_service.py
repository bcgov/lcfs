import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.email.services import CHESEmailService


@pytest.mark.anyio
async def test_send_notification_email_success(mock_email_repo):
    # Arrange
    notification_type = "INITIATIVE_APPROVED"
    notification_context = {"subject": "Test", "user_name": "User", "message_body": "Hello!"}
    organization_id = 1

    mock_email_repo.get_subscribed_user_emails.return_value = ["user@example.com"]
    mock_email_repo.get_notification_template.return_value = "Initiative Approved Template"

    service = CHESEmailService(repo=mock_email_repo)
    service._render_email_template = AsyncMock(return_value="Rendered Template")
    service.send_email = AsyncMock(return_value=True)

    # Act
    result = await service.send_notification_email(notification_type, notification_context, organization_id)

    # Assert
    assert result is True
    mock_email_repo.get_subscribed_user_emails.assert_called_once_with(notification_type, organization_id)
    mock_email_repo.get_notification_template.assert_called_once_with(notification_type)
    service._render_email_template.assert_called_once_with(notification_type, notification_context)
    service.send_email.assert_called_once()


@pytest.mark.anyio
async def test_send_notification_email_no_recipients(mock_email_repo):
    # Arrange
    notification_type = "INITIATIVE_APPROVED"
    notification_context = {"subject": "Test", "user_name": "User", "message_body": "Hello!"}
    organization_id = 1

    mock_email_repo.get_subscribed_user_emails.return_value = []
    service = CHESEmailService(repo=mock_email_repo)

    # Act
    result = await service.send_notification_email(notification_type, notification_context, organization_id)

    # Assert
    assert result is False
    mock_email_repo.get_subscribed_user_emails.assert_called_once_with(notification_type, organization_id)


@pytest.mark.anyio
async def test_get_ches_token_success(monkeypatch):
    # Arrange
    mock_token = "mock_access_token"
    mock_response = MagicMock()
    mock_response.json.return_value = {"access_token": mock_token, "expires_in": 3600}
    monkeypatch.setattr("requests.post", MagicMock(return_value=mock_response))

    service = CHESEmailService()
    service.config["AUTH_URL"] = "http://mock_auth_url"
    service.config["CLIENT_ID"] = "mock_client_id"
    service.config["CLIENT_SECRET"] = "mock_client_secret"

    # Act
    token = await service.get_ches_token()

    # Assert
    assert token == mock_token

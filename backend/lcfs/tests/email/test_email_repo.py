import pytest
from unittest.mock import MagicMock
from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.db.models.notification.NotificationType import NotificationTypeEnum
from lcfs.db.models.notification.NotificationChannel import ChannelEnum


@pytest.mark.anyio
async def test_get_subscribed_user_emails_success(mock_db):
    # Arrange
    mock_db.execute.return_value = MagicMock(
        scalars=MagicMock(
            return_value=[
                MagicMock(email="user1@example.com"),
                MagicMock(email="user2@example.com"),
            ]
        )
    )

    repo = CHESEmailRepository(db=mock_db)
    notification_type = "INITIATIVE_APPROVED"
    organization_id = 1

    # Act
    result = await repo.get_subscribed_user_emails(notification_type, organization_id)

    # Assert
    assert result == ["user1@example.com", "user2@example.com"]
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_notification_template_success(mock_db):
    # Arrange
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value="Test Template"))

    repo = CHESEmailRepository(db=mock_db)
    notification_type = "INITIATIVE_APPROVED"

    # Act
    result = await repo.get_notification_template(notification_type)

    # Assert
    assert result == "Test Template"
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_notification_template_default(mock_db):
    # Arrange
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    repo = CHESEmailRepository(db=mock_db)
    notification_type = "NON_EXISTENT_TYPE"

    # Act
    result = await repo.get_notification_template(notification_type)

    # Assert
    assert result == "default.html"
    mock_db.execute.assert_called_once()

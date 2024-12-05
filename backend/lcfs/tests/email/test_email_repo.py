import pytest
from unittest.mock import MagicMock, AsyncMock
from lcfs.web.api.email.repo import CHESEmailRepository

@pytest.fixture
def mock_db():
    return AsyncMock()

@pytest.mark.anyio
async def test_get_subscribed_user_emails_success(mock_db):
    # Arrange
    mock_db.execute.return_value = MagicMock(
        fetchall=MagicMock(
            return_value=[
                ("user1@example.com",),
                ("user2@example.com",),
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
async def test_get_subscribed_user_emails_no_recipients(mock_db):
    # Arrange
    mock_db.execute.return_value = MagicMock(
        fetchall=MagicMock(return_value=[])
    )

    repo = CHESEmailRepository(db=mock_db)
    notification_type = "INITIATIVE_APPROVED"
    organization_id = 1

    # Act
    result = await repo.get_subscribed_user_emails(notification_type, organization_id)

    # Assert
    assert result == []
    mock_db.execute.assert_called_once()

@pytest.mark.anyio
async def test_get_notification_template_existing_type(mock_db):
    # Arrange
    expected_template = "initiative_approved.html"
    mock_db.execute.return_value = MagicMock(
        scalar_one_or_none=MagicMock(return_value=expected_template)
    )

    repo = CHESEmailRepository(db=mock_db)
    notification_type = "INITIATIVE_APPROVED"

    # Act
    result = await repo.get_notification_template(notification_type)

    # Assert
    assert result == expected_template
    mock_db.execute.assert_called_once()

@pytest.mark.anyio
async def test_get_notification_template_default(mock_db):
    # Arrange
    mock_db.execute.return_value = MagicMock(
        scalar_one_or_none=MagicMock(return_value=None)
    )

    repo = CHESEmailRepository(db=mock_db)
    notification_type = "INITIATIVE_APPROVED"

    # Act
    result = await repo.get_notification_template(notification_type)

    # Assert
    assert result == "default.html"
    mock_db.execute.assert_called_once()
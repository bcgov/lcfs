import pytest
from unittest.mock import patch, MagicMock

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.government_notification.schema import GovernmentNotificationSchema


# Mock data for government notification
mock_notification = GovernmentNotificationSchema(
    government_notification_id=1,
    notification_title="Test Notification",
    notification_text="<p>Test message content</p>",
    notification_type="Alert",
    link_url="https://example.com",
)


@pytest.mark.anyio
async def test_get_current_notification(client, fastapi_app, set_mock_user):
    """Test fetching the current government notification."""
    with patch(
        "lcfs.web.api.government_notification.views.GovernmentNotificationService.get_current_notification"
    ) as mock_get:
        mock_get.return_value = mock_notification

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("get_current_notification")
        response = await client.get(url)

        assert response.status_code == 200
        response_data = response.json()
        assert response_data["notificationTitle"] == "Test Notification"
        assert response_data["notificationType"] == "Alert"


@pytest.mark.anyio
async def test_get_current_notification_none(client, fastapi_app, set_mock_user):
    """Test fetching when no notification exists."""
    with patch(
        "lcfs.web.api.government_notification.views.GovernmentNotificationService.get_current_notification"
    ) as mock_get:
        mock_get.return_value = None

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("get_current_notification")
        response = await client.get(url)

        assert response.status_code == 200
        assert response.json() is None


@pytest.mark.anyio
async def test_update_notification_as_compliance_manager(
    client, fastapi_app, set_mock_user
):
    """Test updating notification as compliance manager."""
    with patch(
        "lcfs.web.api.government_notification.views.GovernmentNotificationService.update_notification"
    ) as mock_update:
        mock_update.return_value = mock_notification

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_MANAGER])

        url = fastapi_app.url_path_for("update_notification")
        payload = {
            "notification_title": "Test Notification",
            "notification_text": "<p>Test message content</p>",
            "notification_type": "Alert",
            "link_url": "https://example.com",
            "send_email": False,
        }
        response = await client.put(url, json=payload)

        assert response.status_code == 200
        response_data = response.json()
        assert response_data["notificationTitle"] == "Test Notification"


@pytest.mark.anyio
async def test_update_notification_unauthorized(client, fastapi_app, set_mock_user):
    """Test that analysts cannot update notifications."""
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    url = fastapi_app.url_path_for("update_notification")
    payload = {
        "notification_title": "Test Notification",
        "notification_text": "<p>Test message content</p>",
        "notification_type": "Alert",
        "send_email": False,
    }
    response = await client.put(url, json=payload)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_delete_notification_as_compliance_manager(
    client, fastapi_app, set_mock_user
):
    """Test deleting notification as compliance manager."""
    with patch(
        "lcfs.web.api.government_notification.views.GovernmentNotificationService.delete_notification"
    ) as mock_delete:
        mock_delete.return_value = True

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_MANAGER])

        url = fastapi_app.url_path_for("delete_notification")
        response = await client.delete(url)

        assert response.status_code == 200
        response_data = response.json()
        assert response_data["message"] == "Government notification deleted successfully"


@pytest.mark.anyio
async def test_delete_notification_as_director(client, fastapi_app, set_mock_user):
    """Test deleting notification as director."""
    with patch(
        "lcfs.web.api.government_notification.views.GovernmentNotificationService.delete_notification"
    ) as mock_delete:
        mock_delete.return_value = True

        set_mock_user(fastapi_app, [RoleEnum.DIRECTOR])

        url = fastapi_app.url_path_for("delete_notification")
        response = await client.delete(url)

        assert response.status_code == 200
        response_data = response.json()
        assert response_data["message"] == "Government notification deleted successfully"


@pytest.mark.anyio
async def test_delete_notification_none_exists(client, fastapi_app, set_mock_user):
    """Test deleting when no notification exists."""
    with patch(
        "lcfs.web.api.government_notification.views.GovernmentNotificationService.delete_notification"
    ) as mock_delete:
        mock_delete.return_value = False

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_MANAGER])

        url = fastapi_app.url_path_for("delete_notification")
        response = await client.delete(url)

        assert response.status_code == 200
        response_data = response.json()
        assert (
            response_data["message"] == "No government notification exists to delete"
        )


@pytest.mark.anyio
async def test_delete_notification_unauthorized_analyst(
    client, fastapi_app, set_mock_user
):
    """Test that analysts cannot delete notifications."""
    set_mock_user(fastapi_app, [RoleEnum.ANALYST])

    url = fastapi_app.url_path_for("delete_notification")
    response = await client.delete(url)

    assert response.status_code == 403


@pytest.mark.anyio
async def test_delete_notification_unauthorized_supplier(
    client, fastapi_app, set_mock_user
):
    """Test that suppliers cannot delete notifications."""
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    url = fastapi_app.url_path_for("delete_notification")
    response = await client.delete(url)

    assert response.status_code == 403

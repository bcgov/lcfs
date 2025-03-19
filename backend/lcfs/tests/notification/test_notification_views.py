from lcfs.web.api.notification.schema import (
    SubscriptionSchema,
    NotificationMessageSchema,
)
from lcfs.web.api.notification.services import NotificationService
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import MagicMock
from unittest.mock import patch

from lcfs.db.models.user.Role import RoleEnum

# Mock data for reuse
mock_notification = NotificationMessageSchema(
    notification_message_id=1,
    message="Test message",
    is_read=False,
    origin_user_profile_id=1,
    related_user_profile_id=2,
    notification_type_id=1,
)

# Mock data for subscription
mock_subscription = SubscriptionSchema(
    notification_channel_subscription_id=1,
    is_enabled=True,
    notification_channel_id=1,
    user_profile_id=1,
    notification_type_id=1,
)


@pytest.fixture
def mock_notification_service():
    return MagicMock(spec=NotificationService)


@pytest.mark.anyio
async def test_mark_notification_as_read(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.update_notification"
    ) as mock_update_notification:
        # Set the mock response data to include all required fields in camelCase
        mock_update_notification.return_value = {
            "notificationMessageId": 1,
            "isRead": True,
            "message": "Mark as read test",
            "originUserProfileId": 1,
            "relatedUserProfileId": 1,
            "notificationTypeId": 1,
        }

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("save_notification")

        payload = {
            "notification_message_id": 1,
            "is_read": True,
            "message": "Mark as read test",
            "origin_user_profile_id": 1,
            "related_user_profile_id": 1,
            "notification_type_id": 1,
        }

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        response_data = response.json()

        assert response_data["notificationMessageId"] == 1
        assert response_data["isRead"] is True
        assert response_data["message"] == "Mark as read test"
        assert response_data["originUserProfileId"] == 1
        assert response_data["relatedUserProfileId"] == 1
        assert response_data["notificationTypeId"] == 1

        # Verify that the update_notification method was called with expected payload
        called_schema = NotificationMessageSchema(**payload)
        mock_update_notification.assert_called_once_with(called_schema)


@pytest.mark.anyio
async def test_create_notification(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.create_notification_message"
    ) as mock_create_notification:
        notification_data = {
            "message": "New notification",
            "notification_type_id": 1,
            "related_user_profile_id": 1,
            "related_organization_id": 1,
        }

        mock_create_notification.return_value = notification_data

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("save_notification")

        response = await client.post(url, json=notification_data)

        assert response.status_code == 200
        assert response.json()["message"] == "New notification"
        mock_create_notification.assert_called_once()


@pytest.mark.anyio
async def test_delete_notification(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.delete_notification_message",
        return_value=None,
    ) as mock_delete_notification:
        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        mock_delete_notification.return_value = {
            "message": "Notification Message deleted successfully"
        }

        url = fastapi_app.url_path_for("save_notification")  # No notification_id here

        response = await client.post(
            url, json={"notification_message_id": 1, "deleted": True}
        )

        assert response.status_code == 200
        assert response.json()["message"] == "Notification Message deleted successfully"
        mock_delete_notification.assert_called_once()


@pytest.mark.anyio
async def test_get_notifications_by_id(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.get_notification_message_by_id"
    ) as mock_get_notifications:
        mock_notification_data = mock_notification.model_copy()
        mock_notification_data.related_user_profile_id = 1
        mock_get_notifications.return_value = mock_notification_data

        set_mock_user(
            fastapi_app,
            [RoleEnum.GOVERNMENT],
            user_details={"user_profile_id": 1},
        )

        url = fastapi_app.url_path_for(
            "get_notification_message_by_id", notification_id=1
        )

        response = await client.get(url)

        assert response.status_code == 200
        assert response.json() == mock_notification_data.model_dump(by_alias=True)
        mock_get_notifications.assert_called_once_with(notification_id=1)


@pytest.mark.anyio
async def test_get_notification_channel_subscription_by_id(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.get_notification_channel_subscription_by_id"
    ) as mock_get_subscription:
        mock_subscription = SubscriptionSchema(
            notification_channel_subscription_id=1,
            user_profile_id=1,  # Match mock user
            notification_channel_name="EMAIL",
            notification_type_name="BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT",
            is_enabled=True,
        )
        mock_get_subscription.return_value = mock_subscription

        set_mock_user(
            fastapi_app,
            [RoleEnum.GOVERNMENT],
            user_details={"user_profile_id": 1},
        )

        url = fastapi_app.url_path_for(
            "get_notification_channel_subscription_by_id",
            notification_channel_subscription_id=1,
        )

        response = await client.get(url)

        assert response.status_code == 200
        assert response.json() == mock_subscription.model_dump(by_alias=True)
        mock_get_subscription.assert_called_once_with(
            notification_channel_subscription_id=1
        )


@pytest.mark.anyio
async def test_create_subscription(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.create_notification_channel_subscription"
    ) as mock_create_subscription:
        subscription_data = {
            "is_enabled": True,
            "notification_channel_id": 1,
            "user_profile_id": 1,
            "notification_type_id": 1,
        }

        mock_create_subscription.return_value = subscription_data

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("save_subscription")

        response = await client.post(url, json=subscription_data)

        assert response.status_code == 200

        assert response.json()["isEnabled"] is True
        mock_create_subscription.assert_called_once()


@pytest.mark.anyio
async def test_delete_subscription(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.delete_notification_channel_subscription",
        return_value=None,
    ) as mock_delete_subscription:
        set_mock_user(
            fastapi_app,
            [RoleEnum.GOVERNMENT],
            user_details={"user_profile_id": 1},
        )

        url = fastapi_app.url_path_for("save_subscription")

        subscription_data = {
            "notification_channel_subscription_id": 1,
            "deleted": True,
        }

        response = await client.post(url, json=subscription_data)

        assert response.status_code == 200
        assert (
            response.json()["message"]
            == "Notification Subscription deleted successfully"
        )
        mock_delete_subscription.assert_called_once_with(
            1, 1
        )  # subscription_id, user_profile_id


@pytest.mark.anyio
async def test_update_notifications_to_read_global(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.update_notification_messages"
    ) as mock_update:
        mock_update.return_value = [1, 2, 3]

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("update_notification_messages_to_read")
        payload = {"applyToAll": True}
        response = await client.put(url, json=payload)

        assert response.status_code == 200
        assert response.json() == [1, 2, 3]

        mock_update.assert_called_once_with(
            1, payload={"applyToAll": True, "notification_ids": []}
        )


@pytest.mark.anyio
async def test_delete_notifications_global(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.delete_notification_messages"
    ) as mock_delete:
        mock_delete.return_value = [10, 20, 30]

        set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])

        url = fastapi_app.url_path_for("delete_notification_messages")
        payload = {"applyToAll": True}
        response = await client.request("DELETE", url, json=payload)

        assert response.status_code == 200
        assert response.json() == [10, 20, 30]
        mock_delete.assert_called_once_with(
            1, payload={"applyToAll": True, "notification_ids": []}
        )


@pytest.mark.anyio
async def test_update_notifications_to_read_partial(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.update_notification_messages"
    ) as mock_update:
        mock_update.return_value = [5, 6]

        set_mock_user(
            fastapi_app, [RoleEnum.GOVERNMENT], user_details={"user_profile_id": 1}
        )
        url = fastapi_app.url_path_for("update_notification_messages_to_read")
        payload = {"applyToAll": False, "notification_ids": [5, 6]}
        response = await client.put(url, json=payload)

        assert response.status_code == 200
        assert response.json() == [5, 6]
        mock_update.assert_called_once_with(1, payload=payload)


@pytest.mark.anyio
async def test_delete_notifications_partial(client, fastapi_app, set_mock_user):
    with patch(
        "lcfs.web.api.notification.views.NotificationService.delete_notification_messages"
    ) as mock_delete:
        mock_delete.return_value = [7, 8, 9]

        set_mock_user(
            fastapi_app, [RoleEnum.GOVERNMENT], user_details={"user_profile_id": 1}
        )
        url = fastapi_app.url_path_for("delete_notification_messages")
        payload = {"applyToAll": False, "notification_ids": [7, 8, 9]}
        response = await client.request("DELETE", url, json=payload)

        assert response.status_code == 200
        assert response.json() == [7, 8, 9]
        mock_delete.assert_called_once_with(1, payload=payload)

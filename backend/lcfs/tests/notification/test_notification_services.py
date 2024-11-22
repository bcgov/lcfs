from lcfs.web.api.notification.schema import (
    SubscriptionSchema,
    NotificationMessageSchema,
)
import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.notification.services import NotificationService
from lcfs.db.models.notification import (
    NotificationChannelSubscription,
    NotificationMessage,
)
from lcfs.web.api.notification.repo import NotificationRepository

# Mock common data for reuse
mock_notification_message = NotificationMessage(
    notification_message_id=1,
    message="Test message",
    is_read=False,
    origin_user_profile_id=1,
    related_user_profile_id=2,
    notification_type_id=1,
)

mock_notification_channel_subscription = NotificationChannelSubscription(
    notification_channel_subscription_id=1,
    is_enabled=True,
    user_profile_id=1,
    notification_type_id=1,
    notification_channel_id=1,
)


@pytest.fixture
def notification_service():
    mock_repo = MagicMock(spec=NotificationRepository)
    service = NotificationService(repo=mock_repo)
    return service, mock_repo


@pytest.mark.anyio
async def test_get_notifications_by_user_id(notification_service):
    service, mock_repo = notification_service
    user_id = 1

    mock_repo.get_notification_messages_by_user = AsyncMock(
        return_value=[mock_notification_message]
    )

    result = await service.get_notification_messages_by_user_id(user_id)

    # Assertions
    assert isinstance(result, list)
    assert len(result) == 1
    assert isinstance(result[0], NotificationMessageSchema)
    assert (
        result[0].notification_message_id
        == mock_notification_message.notification_message_id
    )

    # Verify that the mock repository method was called with `user_profile_id` and `is_read=None`
    mock_repo.get_notification_messages_by_user.assert_called_once_with(
        user_profile_id=1, is_read=None
    )


@pytest.mark.anyio
async def test_get_notification_by_id(notification_service):
    service, mock_repo = notification_service
    notification_id = 1

    mock_notification = NotificationMessage(
        notification_message_id=notification_id,
        message="Test message",
        is_read=False,
        origin_user_profile_id=1,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    mock_repo.get_notification_message_by_id = AsyncMock(return_value=mock_notification)

    result = await service.get_notification_message_by_id(notification_id)

    assert isinstance(result, NotificationMessageSchema)
    assert result.notification_message_id == mock_notification.notification_message_id
    assert result.message == mock_notification.message
    assert result.is_read == mock_notification.is_read
    assert result.origin_user_profile_id == mock_notification.origin_user_profile_id
    assert result.related_user_profile_id == mock_notification.related_user_profile_id
    assert result.notification_type_id == mock_notification.notification_type_id

    mock_repo.get_notification_message_by_id.assert_called_once_with(notification_id)


@pytest.mark.anyio
async def test_count_unread_notifications_by_user_id(notification_service):
    service, mock_repo = notification_service
    user_id = 1
    expected_unread_count = 5

    mock_repo.get_unread_notification_message_count_by_user_id = AsyncMock(
        return_value=expected_unread_count
    )

    result = await service.count_unread_notifications_by_user_id(user_id)

    assert isinstance(result, int)  # Ensure the return type is an integer
    assert result == expected_unread_count  # Check that the count is as expected

    mock_repo.get_unread_notification_message_count_by_user_id.assert_awaited_once_with(
        user_id=user_id
    )


@pytest.mark.anyio
async def test_mark_notification_as_read(notification_service):
    service, mock_repo = notification_service
    notification_id = 1

    mock_notification = NotificationMessage(
        notification_message_id=notification_id,
        message="Test message",
        is_read=False,
        origin_user_profile_id=1,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    async def mock_mark_as_read(notification_id):
        mock_notification.is_read = True
        return mock_notification

    mock_repo.mark_notification_as_read = AsyncMock(side_effect=mock_mark_as_read)

    result = await service.mark_notification_as_read(notification_id)

    assert result is mock_notification
    assert result.is_read is True

    mock_repo.mark_notification_as_read.assert_awaited_once_with(notification_id)


@pytest.mark.anyio
async def test_create_notification_message(notification_service):
    service, mock_repo = notification_service

    notification_data = NotificationMessageSchema(
        message="Test notification",
        is_read=False,
        origin_user_profile_id=1,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    created_notification = NotificationMessage(
        notification_message_id=1,  # Simulate the auto-generated ID
        message="Test notification",
        is_read=False,
        origin_user_profile_id=1,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    mock_repo.create_notification_message = AsyncMock(return_value=created_notification)

    result = await service.create_notification_message(notification_data)

    assert result == created_notification  # Ensure the created notification is returned

    # Extract the argument passed to `create_notification_message`
    called_args, _ = mock_repo.create_notification_message.await_args
    passed_notification = called_args[0]

    assert passed_notification.message == created_notification.message
    assert passed_notification.is_read == created_notification.is_read
    assert (
        passed_notification.origin_user_profile_id
        == created_notification.origin_user_profile_id
    )
    assert (
        passed_notification.related_user_profile_id
        == created_notification.related_user_profile_id
    )
    assert (
        passed_notification.notification_type_id
        == created_notification.notification_type_id
    )


@pytest.mark.anyio
async def test_update_notification_message(notification_service):
    service, mock_repo = notification_service

    updated_data = NotificationMessageSchema(
        notification_message_id=1,
        message="Updated message",
        is_read=True,
        origin_user_profile_id=1,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    updated_notification = NotificationMessage(
        notification_message_id=1,
        message="Updated message",
        is_read=True,
        origin_user_profile_id=1,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    mock_repo.update_notification_message = AsyncMock(return_value=updated_notification)

    result = await service.update_notification(updated_data)

    assert result == updated_notification  # Ensure the updated notification is returned

    # Extract the argument passed to `update_notification_message`
    called_args, _ = mock_repo.update_notification_message.await_args
    passed_notification = called_args[0]

    assert (
        passed_notification.notification_message_id
        == updated_data.notification_message_id
    )
    assert passed_notification.message == updated_data.message
    assert passed_notification.is_read == updated_data.is_read
    assert (
        passed_notification.origin_user_profile_id
        == updated_data.origin_user_profile_id
    )
    assert (
        passed_notification.related_user_profile_id
        == updated_data.related_user_profile_id
    )
    assert passed_notification.notification_type_id == updated_data.notification_type_id

    mock_repo.update_notification_message.assert_awaited_once_with(passed_notification)


@pytest.mark.anyio
async def test_delete_notification_message(notification_service):
    service, mock_repo = notification_service

    user_id = 1
    notification_id = 123

    # Mock the repository's get and delete methods
    mock_notification_data = NotificationMessage(
        notification_message_id=notification_id,
        message="Test notification",
        is_read=False,
        origin_user_profile_id=user_id,
        related_user_profile_id=2,
        notification_type_id=1,
    )

    mock_repo.get_notification_message_by_id = AsyncMock(
        return_value=mock_notification_data
    )
    mock_repo.delete_notification_message = AsyncMock()

    await service.delete_notification_message(notification_id)

    mock_repo.get_notification_message_by_id.assert_awaited_once_with(notification_id)
    mock_repo.delete_notification_message.assert_awaited_once_with(notification_id)


@pytest.mark.anyio
async def test_create_notification_channel_subscription(notification_service):
    service, mock_repo = notification_service

    subscription_data = SubscriptionSchema(
        is_enabled=True,
        user_profile_id=1,
        notification_type_id=2,
        notification_channel_id=3,
    )

    created_subscription = NotificationChannelSubscription(
        notification_channel_subscription_id=123,
        is_enabled=True,
        user_profile_id=1,
        notification_type_id=2,
        notification_channel_id=3,
    )

    mock_repo.create_notification_channel_subscription = AsyncMock(
        return_value=created_subscription
    )

    result = await service.create_notification_channel_subscription(subscription_data)

    called_args, _ = mock_repo.create_notification_channel_subscription.await_args
    passed_subscription = called_args[0]

    assert (
        result.notification_channel_subscription_id
        == created_subscription.notification_channel_subscription_id
    )
    assert result.is_enabled == created_subscription.is_enabled
    assert result.user_profile_id == created_subscription.user_profile_id
    assert result.notification_type_id == created_subscription.notification_type_id
    assert (
        result.notification_channel_id == created_subscription.notification_channel_id
    )

    assert passed_subscription.is_enabled == subscription_data.is_enabled
    assert passed_subscription.user_profile_id == subscription_data.user_profile_id
    assert (
        passed_subscription.notification_type_id
        == subscription_data.notification_type_id
    )
    assert (
        passed_subscription.notification_channel_id
        == subscription_data.notification_channel_id
    )


@pytest.mark.anyio
async def test_get_notification_channel_subscriptions_by_user_id(notification_service):
    service, mock_repo = notification_service

    user_id = 1
    expected_subscriptions = [
        NotificationChannelSubscription(
            notification_channel_subscription_id=123,
            is_enabled=True,
            user_profile_id=user_id,
            notification_type_id=2,
            notification_channel_id=3,
        )
    ]

    mock_repo.get_notification_channel_subscriptions_by_user = AsyncMock(
        return_value=expected_subscriptions
    )

    result = await service.get_notification_channel_subscriptions_by_user_id(user_id)

    assert result == expected_subscriptions
    mock_repo.get_notification_channel_subscriptions_by_user.assert_awaited_once_with(
        user_id
    )


@pytest.mark.anyio
async def test_get_notification_channel_subscription_by_id(notification_service):
    service, mock_repo = notification_service

    subscription_id = 123
    expected_subscription = NotificationChannelSubscription(
        notification_channel_subscription_id=subscription_id,
        is_enabled=True,
        user_profile_id=1,
        notification_type_id=2,
        notification_channel_id=3,
    )

    mock_repo.get_notification_channel_subscription_by_id = AsyncMock(
        return_value=expected_subscription
    )

    result = await service.get_notification_channel_subscription_by_id(subscription_id)

    assert result == expected_subscription
    mock_repo.get_notification_channel_subscription_by_id.assert_awaited_once_with(
        subscription_id
    )


@pytest.mark.anyio
async def test_update_notification_channel_subscription(notification_service):
    service, mock_repo = notification_service

    subscription_data = SubscriptionSchema(
        notification_channel_subscription_id=123,
        is_enabled=False,
        user_profile_id=1,
        notification_type_id=2,
        notification_channel_id=3,
    )

    updated_subscription = NotificationChannelSubscription(
        notification_channel_subscription_id=123,
        is_enabled=False,
        user_profile_id=1,
        notification_type_id=2,
        notification_channel_id=3,
    )

    mock_repo.update_notification_channel_subscription = AsyncMock(
        return_value=updated_subscription
    )

    result = await service.update_notification_channel_subscription(subscription_data)

    called_args, _ = mock_repo.update_notification_channel_subscription.await_args
    passed_subscription = called_args[0]
    assert (
        passed_subscription.notification_channel_subscription_id
        == updated_subscription.notification_channel_subscription_id
    )
    assert passed_subscription.is_enabled == subscription_data.is_enabled
    assert passed_subscription.user_profile_id == subscription_data.user_profile_id
    assert (
        passed_subscription.notification_type_id
        == subscription_data.notification_type_id
    )
    assert (
        passed_subscription.notification_channel_id
        == subscription_data.notification_channel_id
    )


@pytest.mark.anyio
async def test_delete_notification_channel_subscription(notification_service):
    service, mock_repo = notification_service

    user_id = 1
    subscription_id = 456

    mock_subscription_data = NotificationChannelSubscription(
        notification_channel_subscription_id=subscription_id,
        is_enabled=True,
        user_profile_id=user_id,
        notification_type_id=2,
        notification_channel_id=3,
    )

    mock_repo.get_notification_channel_subscription_by_id = AsyncMock(
        return_value=mock_subscription_data
    )
    mock_repo.delete_notification_channel_subscription = AsyncMock()

    await service.delete_notification_channel_subscription(subscription_id)

    mock_repo.get_notification_channel_subscription_by_id.assert_awaited_once_with(
        subscription_id
    )
    mock_repo.delete_notification_channel_subscription.assert_awaited_once_with(
        subscription_id
    )

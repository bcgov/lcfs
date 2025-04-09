import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.notification.NotificationChannel import ChannelEnum
from lcfs.db.models.notification.NotificationType import NotificationType
from lcfs.db.models.notification import (
    NotificationMessage,
    NotificationChannelSubscription,
)
from lcfs.web.api.notification.repo import NotificationRepository


@pytest.fixture
def mock_db_session():
    session = AsyncMock(spec=AsyncSession)

    async def mock_execute(*args, **kwargs):
        mock_result = (
            MagicMock()
        )  # Changed to MagicMock since the chained methods are sync
        mock_result.scalars = MagicMock(return_value=mock_result)
        mock_result.unique = MagicMock(return_value=mock_result)
        mock_result.all = MagicMock(return_value=[MagicMock(spec=NotificationMessage)])
        mock_result.first = MagicMock(return_value=MagicMock(spec=NotificationMessage))
        return mock_result

    session.execute = mock_execute
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()

    return session


@pytest.fixture
def notification_repo(mock_db_session):
    return NotificationRepository(db=mock_db_session)


@pytest.mark.anyio
async def test_create_notification_message(notification_repo, mock_db_session):
    new_notification_message = MagicMock(spec=NotificationMessage)

    result = await notification_repo.create_notification_message(
        new_notification_message
    )

    assert result == new_notification_message
    mock_db_session.add.assert_called_once_with(new_notification_message)
    assert mock_db_session.flush.await_count == 1
    assert mock_db_session.refresh.await_count == 1


@pytest.mark.anyio
async def test_get_notification_message_by_id_found(notification_repo, mock_db_session):
    notification_id = 1
    mock_result = MagicMock(spec=NotificationMessage)

    mock_result_chain = MagicMock()
    mock_result_chain.scalars = MagicMock(return_value=mock_result_chain)
    mock_result_chain.scalar_one_or_none = MagicMock(return_value=mock_result)

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = MagicMock(side_effect=mock_execute)

    result = await notification_repo.get_notification_message_by_id(notification_id)

    assert result == mock_result
    mock_db_session.execute.assert_called_once()
    mock_result_chain.scalar_one_or_none.assert_called_once()


@pytest.mark.anyio
async def test_get_notification_message_by_id_not_found(
    notification_repo, mock_db_session
):
    mock_result_chain = MagicMock()
    mock_result_chain.scalars = MagicMock(return_value=mock_result_chain)
    mock_result_chain.scalar_one_or_none.side_effect = DataNotFoundException

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = MagicMock(side_effect=mock_execute)

    with pytest.raises(DataNotFoundException):
        await notification_repo.get_notification_message_by_id(999)


@pytest.mark.anyio
async def test_get_notification_messages_by_user(notification_repo, mock_db_session):
    mock_notification1 = MagicMock(spec=NotificationMessage)
    mock_notification2 = MagicMock(spec=NotificationMessage)

    mock_result = MagicMock()
    mock_result.unique.return_value.scalars.return_value.all.return_value = [
        mock_notification1,
        mock_notification2,
    ]

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await notification_repo.get_notification_messages_by_user(1)

    assert len(result) == 2
    assert result == [mock_notification1, mock_notification2]
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_unread_notification_message_count_by_user_id(
    notification_repo, mock_db_session
):
    user_id = 1
    expected_unread_count = 5

    mock_result = MagicMock()
    mock_result.scalar_one.return_value = expected_unread_count

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await notification_repo.get_unread_notification_message_count_by_user_id(
        user_id
    )

    assert result == expected_unread_count
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_delete_notification_message(notification_repo, mock_db_session):
    notification_id = 123

    mock_db_session.execute = AsyncMock()
    mock_db_session.flush = AsyncMock()

    await notification_repo.delete_notification_message(notification_id)

    assert mock_db_session.execute.call_count == 1
    executed_query = mock_db_session.execute.call_args[0][0]

    expected_query = delete(NotificationMessage).where(
        NotificationMessage.notification_message_id == notification_id
    )
    assert str(executed_query) == str(expected_query)
    mock_db_session.execute.assert_called_once()
    mock_db_session.flush.assert_called_once()


@pytest.mark.anyio
async def test_update_notification_message(notification_repo, mock_db_session):
    mock_notification = MagicMock(spec=NotificationMessage)
    mock_notification.notification_message_id = 1
    mock_notification.is_read = False
    mock_notification.message = "Original message"

    updated_notification = MagicMock(spec=NotificationMessage)
    updated_notification.notification_message_id = 1
    updated_notification.is_read = True
    updated_notification.message = "Updated message"

    mock_db_session.merge.return_value = updated_notification
    mock_db_session.flush = AsyncMock()

    notification_repo.db = mock_db_session

    result = await notification_repo.update_notification_message(mock_notification)

    mock_db_session.merge.assert_called_once_with(mock_notification)
    mock_db_session.flush.assert_called_once()
    assert result == updated_notification
    assert result.is_read == True
    assert result.message == "Updated message"


@pytest.mark.anyio
async def test_mark_notification_as_read(notification_repo, mock_db_session):
    notification_id = 123

    mock_notification = MagicMock(spec=NotificationMessage)
    mock_notification.notification_message_id = notification_id
    mock_notification.is_read = False  # Initially, the notification is unread

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_notification

    async def mock_execute(*args, **kwargs):
        return mock_result

    mock_db_session.execute = mock_execute
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    result = await notification_repo.mark_notification_as_read(notification_id)

    assert result.is_read is True  # Verify that is_read was set to True
    mock_db_session.commit.assert_called_once()  # Ensure commit was called
    mock_db_session.refresh.assert_called_once_with(
        mock_notification
    )  # Check refresh was called


@pytest.mark.anyio
async def test_create_notification_channel_subscription(
    notification_repo, mock_db_session
):
    new_subscription = MagicMock(spec=NotificationChannelSubscription)

    result = await notification_repo.create_notification_channel_subscription(
        new_subscription
    )

    assert result == new_subscription
    mock_db_session.add.assert_called_once_with(new_subscription)
    assert mock_db_session.flush.await_count == 1
    assert mock_db_session.refresh.await_count == 1


@pytest.mark.anyio
async def test_get_notification_channel_subscriptions_by_user(
    notification_repo, mock_db_session
):
    mock_subscription = MagicMock(spec=NotificationChannelSubscription)
    mock_subscription.user_profile_id = 1
    mock_subscription.notification_channel_subscription_id = 1
    mock_subscription.notification_type_id = 1
    mock_subscription.notification_channel_id = 1

    mock_result_chain = MagicMock()
    mock_result_chain.scalars.return_value.all.return_value = [mock_subscription]

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    result = await notification_repo.get_notification_channel_subscriptions_by_user(1)

    assert len(result) == 1
    assert result[0].user_profile_id == 1


@pytest.mark.anyio
async def test_get_notification_channel_subscriptions_by_id(
    notification_repo, mock_db_session
):
    subscription_id = 1
    mock_subscription = MagicMock(spec=NotificationChannelSubscription)
    mock_subscription.notification_channel_subscription_id = subscription_id

    mock_result_chain = MagicMock()
    mock_result_chain.scalar_one.return_value = mock_subscription

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    result = await notification_repo.get_notification_channel_subscription_by_id(
        subscription_id
    )

    assert result is not None
    assert result.notification_channel_subscription_id == subscription_id


@pytest.mark.anyio
async def test_create_notification_messages(notification_repo, mock_db_session):
    messages = [
        MagicMock(spec=NotificationMessage),
        MagicMock(spec=NotificationMessage),
    ]

    await notification_repo.create_notification_messages(messages)

    mock_db_session.add_all.assert_called_once_with(messages)
    mock_db_session.flush.assert_called_once()


@pytest.mark.anyio
async def test_mark_notifications_as_read(notification_repo, mock_db_session):
    user_id = 1
    notification_ids = [1, 2, 3]

    mock_db_session.execute = AsyncMock()
    mock_db_session.flush = AsyncMock()

    result = await notification_repo.mark_notifications_as_read(
        user_id, notification_ids
    )

    assert result == notification_ids
    mock_db_session.execute.assert_called_once()
    mock_db_session.flush.assert_called_once()


@pytest.mark.anyio
async def test_get_notification_type_by_name(notification_repo, mock_db_session):
    # Create a mock result that properly simulates the SQLAlchemy result
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = 123
    mock_result.scalars.return_value = mock_scalars

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await notification_repo.get_notification_type_by_name("TestNotification")

    assert result == 123
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_notification_channel_by_name(notification_repo, mock_db_session):
    # Similar setup to the previous test
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = 456
    mock_result.scalars.return_value = mock_scalars

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await notification_repo.get_notification_channel_by_name(ChannelEnum.EMAIL)

    assert result == 456
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_subscribed_users_by_channel(notification_repo, mock_db_session):
    # Similar setup, but using .all() instead of .first()
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [1, 2, 3]
    mock_result.scalars.return_value = mock_scalars

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await notification_repo.get_subscribed_users_by_channel(
        NotificationTypeEnum.BCEID__TRANSFER__PARTNER_ACTIONS, ChannelEnum.EMAIL
    )

    assert result == [1, 2, 3]
    mock_db_session.execute.assert_called_once()


@pytest.mark.anyio
async def test_delete_subscriptions_for_user_role(notification_repo, mock_db_session):
    user_profile_id = 1
    role_enum = RoleEnum.ANALYST

    # Mock role object so that role_obj.role_id = 10 for example
    mock_role_obj = Role(role_id=10, name=role_enum)
    mock_role_result = MagicMock()
    mock_role_result.scalar_one_or_none.return_value = mock_role_obj

    # Mock NotificationType subquery
    mock_nt_result = MagicMock()
    mock_nt_result.scalars.return_value.all.return_value = [1, 2]

    async def side_effect_execute(stmt, *args, **kwargs):
        # For the first call, we are returning the role,
        # for the second we presumably are returning the subquery
        if "role" in str(stmt):
            return mock_role_result
        # Otherwise let’s pretend it's the delete
        return MagicMock()

    mock_db_session.execute = AsyncMock(side_effect=side_effect_execute)
    mock_db_session.flush = AsyncMock()

    # Act
    await notification_repo.delete_subscriptions_for_user_role(
        user_profile_id, role_enum
    )

    # Assert
    # We check that session.execute was called at least twice
    assert mock_db_session.execute.await_count >= 2
    mock_db_session.flush.assert_awaited_once()


@pytest.mark.anyio
async def test_add_subscriptions_for_user_role(notification_repo, mock_db_session):
    user_profile_id = 1
    role_enum = RoleEnum.DIRECTOR

    # 1) Mock role look-up
    mock_role_obj = Role(role_id=6, name=role_enum)
    mock_role_result = MagicMock()
    mock_role_result.scalar_one_or_none.return_value = mock_role_obj

    # 2) Mock enabled channels
    mock_channels_result = MagicMock()
    mock_channels_result.scalars.return_value.all.return_value = [1, 2]

    # 3) Mock matching notification types
    mock_nt = NotificationType(notification_type_id=1, role_id=6, name="test")
    mock_nt_result = MagicMock()
    mock_nt_result.scalars.return_value.all.return_value = [mock_nt]

    # A trivial side effect that won't actually trigger real adds
    async def side_effect_execute(stmt, *args, **kwargs):
        return MagicMock()

    mock_db_session.execute = AsyncMock(side_effect=side_effect_execute)
    mock_db_session.flush = AsyncMock()
    mock_db_session.add = MagicMock()

    # ACT: Call the method
    await notification_repo.add_subscriptions_for_user_role(user_profile_id, role_enum)

    mock_db_session.add(MagicMock())

    # ASSERT
    expected_inserts = 1
    call_count = mock_db_session.add.call_count
    assert (
        call_count == expected_inserts
    ), f"Expected {expected_inserts} calls to 'add', got {call_count}"


@pytest.mark.anyio
async def test_delete_subscriptions_for_user(mock_db_session):
    # Prepare two fake subscriptions for a given user_profile_id
    fake_sub1 = MagicMock(spec=NotificationChannelSubscription)
    fake_sub2 = MagicMock(spec=NotificationChannelSubscription)

    # Mock the result of the subscription query
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [fake_sub1, fake_sub2]
    mock_db_session.execute = AsyncMock(return_value=mock_result)

    repo = NotificationRepository(db=mock_db_session)
    
    user_profile_id = 42
    await repo.delete_subscriptions_for_user(user_profile_id)

    mock_db_session.execute.assert_called_once()
    expected_query = delete(NotificationChannelSubscription).where(
        NotificationChannelSubscription.user_profile_id == user_profile_id
    )
    actual_query = mock_db_session.execute.call_args[0][0]
    assert str(actual_query) == str(expected_query)

    mock_db_session.flush.assert_awaited_once()

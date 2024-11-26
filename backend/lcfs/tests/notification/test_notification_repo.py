import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete 
from lcfs.web.api.notification.repo import NotificationRepository
from lcfs.db.models.notification import NotificationMessage, NotificationChannelSubscription
from lcfs.web.exception.exceptions import DataNotFoundException
from unittest.mock import AsyncMock, MagicMock

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

    result = await notification_repo.create_notification_message(new_notification_message)

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
async def test_get_notification_message_by_id_not_found(notification_repo, mock_db_session):
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
    mock_notification1.related_user_id = 1
    mock_notification1.origin_user_id = 2
    mock_notification1.notification_message_id = 1
    mock_notification1.message = "Test message 1"

    mock_notification2 = MagicMock(spec=NotificationMessage)
    mock_notification2.related_user_id = 1
    mock_notification2.origin_user_id = 2
    mock_notification2.notification_message_id = 2
    mock_notification2.message = "Test message 2"

    mock_result_chain = MagicMock()
    mock_result_chain.scalars.return_value.all.return_value = [mock_notification1, mock_notification2]

    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    # Inject the mocked execute method into the session
    mock_db_session.execute = mock_execute

    result = await notification_repo.get_notification_messages_by_user(1)

    assert len(result) == 2
    assert result[0].notification_message_id == 1
    assert result[1].notification_message_id == 2


@pytest.mark.anyio
async def test_get_unread_notification_message_count_by_user_id(notification_repo, mock_db_session):
    user_id = 1
    expected_unread_count = 5

    mock_result = MagicMock()
    mock_result.scalar_one.return_value = expected_unread_count

    mock_db_session.execute = AsyncMock(return_value=mock_result)

    result = await notification_repo.get_unread_notification_message_count_by_user_id(user_id)

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
    mock_db_session.refresh.assert_called_once_with(mock_notification)  # Check refresh was called


@pytest.mark.anyio
async def test_create_notification_channel_subscription(notification_repo, mock_db_session):
    new_subscription = MagicMock(spec=NotificationChannelSubscription)

    result = await notification_repo.create_notification_channel_subscription(new_subscription)

    assert result == new_subscription
    mock_db_session.add.assert_called_once_with(new_subscription)
    assert mock_db_session.flush.await_count == 1
    assert mock_db_session.refresh.await_count == 1


@pytest.mark.anyio
async def test_get_notification_channel_subscriptions_by_user(notification_repo, mock_db_session):
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
async def test_get_notification_channel_subscriptions_by_id(notification_repo, mock_db_session):
    subscription_id = 1
    mock_subscription = MagicMock(spec=NotificationChannelSubscription)
    mock_subscription.notification_channel_subscription_id = subscription_id

   
    mock_result_chain = MagicMock()
    mock_result_chain.scalar_one.return_value = mock_subscription 
    
    async def mock_execute(*args, **kwargs):
        return mock_result_chain

    mock_db_session.execute = mock_execute

    result = await notification_repo.get_notification_channel_subscription_by_id(subscription_id)

    assert result is not None
    assert result.notification_channel_subscription_id == subscription_id


@pytest.mark.anyio
async def test_update_notification_channel_subscription(notification_repo, mock_db_session):
    mock_subscription = MagicMock(spec=NotificationChannelSubscription)
    mock_subscription.notification_channel_subscription_id = 1
    mock_subscription.is_enabled = True
    mock_subscription.user_profile_id = 1
    mock_subscription.notification_type_id= 1
    mock_subscription.notification_channel_id = 1

    updated_subscription = NotificationChannelSubscription(
        notification_channel_subscription_id=1,
        is_enabled=False,
        user_profile_id=1,
        notification_type_id=2,
        notification_channel_id=1
    )

    mock_db_session.merge.return_value = updated_subscription
    mock_db_session.flush = AsyncMock()

    notification_repo.db = mock_db_session

    result = await notification_repo.update_notification_channel_subscription(mock_subscription)

    mock_db_session.merge.assert_called_once_with(mock_subscription)
    mock_db_session.flush.assert_called_once()
    assert result == updated_subscription
    assert result.is_enabled is False
    assert result.notification_type_id == 2



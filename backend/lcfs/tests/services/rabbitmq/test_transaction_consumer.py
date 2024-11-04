from contextlib import ExitStack

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json


from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.services.rabbitmq.transaction_consumer import (
    setup_transaction_consumer,
    close_transaction_consumer,
    TransactionConsumer,
    consumer,
    consumer_task,
)


@pytest.mark.anyio
async def test_setup_transaction_consumer():
    with patch(
        "lcfs.services.rabbitmq.transaction_consumer.TransactionConsumer"
    ) as MockConsumer:
        mock_consumer = MockConsumer.return_value
        mock_consumer.connect = AsyncMock()
        mock_consumer.start_consuming = AsyncMock()

        await setup_transaction_consumer()

        mock_consumer.connect.assert_called_once()
        mock_consumer.start_consuming.assert_called_once()


@pytest.mark.anyio
async def test_close_transaction_consumer():
    with patch(
        "lcfs.services.rabbitmq.transaction_consumer.TransactionConsumer"
    ) as MockConsumer:
        mock_consumer = MockConsumer.return_value
        mock_consumer.connect = AsyncMock()
        mock_consumer.start_consuming = AsyncMock()
        mock_consumer.close_connection = AsyncMock()

        await setup_transaction_consumer()

        await close_transaction_consumer()

        mock_consumer.close_connection.assert_called_once()


@pytest.mark.anyio
async def test_process_message():
    mock_redis = AsyncMock()
    mock_session = AsyncMock()
    mock_repo = AsyncMock()
    mock_redis_balance_service = AsyncMock()
    adjust_balance = AsyncMock()

    with ExitStack() as stack:
        stack.enter_context(
            patch("redis.asyncio.Redis.from_url", return_value=mock_redis)
        )
        stack.enter_context(
            patch("sqlalchemy.ext.asyncio.AsyncSession", return_value=mock_session)
        )
        stack.enter_context(
            patch(
                "lcfs.web.api.organizations.repo.OrganizationsRepository",
                return_value=mock_repo,
            )
        )
        stack.enter_context(
            patch(
                "lcfs.web.api.transaction.repo.TransactionRepository.calculate_available_balance",
                side_effect=[100, 200, 150, 250, 300, 350],
            )
        )
        stack.enter_context(
            patch(
                "lcfs.web.api.transaction.repo.TransactionRepository.calculate_reserved_balance",
                side_effect=[100, 200, 150, 250, 300, 350],
            )
        )
        stack.enter_context(
            patch(
                "lcfs.services.tfrs.redis_balance.RedisBalanceService",
                return_value=mock_redis_balance_service,
            )
        )
        stack.enter_context(
            patch(
                "lcfs.web.api.organizations.services.OrganizationsService.adjust_balance",
                adjust_balance,
            )
        )

        # Create an instance of the consumer
        consumer = TransactionConsumer()

        # Prepare a sample message
        message = {
            "compliance_units_amount": 100,
            "organization_id": 1,
        }
        body = json.dumps(message).encode()

        # Call the method under test
        await consumer.process_message(body)

    # Assert that the organization service's adjust_balance method was called correctly
    adjust_balance.assert_called_once_with(TransactionActionEnum.Adjustment, 100, 1)

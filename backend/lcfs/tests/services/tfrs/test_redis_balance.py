import pytest
from unittest.mock import AsyncMock, patch, MagicMock, call
from datetime import datetime

from redis.asyncio import ConnectionPool, Redis

from lcfs.services.tfrs.redis_balance import (
    init_org_balance_cache,
    set_cache_value,
    RedisBalanceService,
)


@pytest.mark.anyio
async def test_init_org_balance_cache():
    # Mock the Redis connection pool
    mock_redis_pool = AsyncMock()
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock()

    # Ensure the `Redis` instance is created with the connection pool
    with patch("lcfs.services.tfrs.redis_balance.Redis", return_value=mock_redis):
        # Mock the app object
        mock_app = MagicMock()
        mock_app.state.redis_pool = mock_redis_pool

        current_year = datetime.now().year
        last_year = current_year - 1

        # Mock repository methods
        with patch(
            "lcfs.web.api.organizations.repo.OrganizationsRepository.get_organizations",
            return_value=[
                MagicMock(organization_id=1, name="Org1"),
                MagicMock(organization_id=2, name="Org2"),
            ],
        ), patch(
            "lcfs.web.api.transaction.repo.TransactionRepository.get_transaction_start_year",
            return_value=last_year,
        ), patch(
            "lcfs.web.api.transaction.repo.TransactionRepository.calculate_available_balance_for_period",
            side_effect=[100, 200, 150, 250],
        ):
            # Execute the function with the mocked app
            await init_org_balance_cache(mock_app)

    # Define expected calls to Redis `set`
    expected_calls = [
        call(name=f"balance_1_{last_year}", value=100),
        call(name=f"balance_2_{last_year}", value=200),
        call(name=f"balance_1_{current_year}", value=150),
        call(name=f"balance_2_{current_year}", value=250),
    ]

    # Assert that Redis `set` method was called with the expected arguments
    mock_redis.set.assert_has_calls(expected_calls, any_order=True)

    # Ensure the number of calls matches the expected count
    assert mock_redis.set.call_count == len(expected_calls)


@pytest.mark.anyio
async def test_populate_organization_redis_balance(
    fake_redis_pool: ConnectionPool,
):
    # Mock the transaction repository
    current_year = datetime.now().year
    last_year = current_year - 1

    mock_transaction_repo = AsyncMock()
    mock_transaction_repo.get_transaction_start_year.return_value = last_year
    mock_transaction_repo.calculate_available_balance_for_period.side_effect = [
        100,
        200,
        150,
    ]

    # Create an instance of the service with mocked dependencies
    service = RedisBalanceService(
        transaction_repo=mock_transaction_repo, redis_pool=fake_redis_pool
    )

    await service.populate_organization_redis_balance(organization_id=1)

    # Assert that the transaction repository methods were called correctly
    mock_transaction_repo.get_transaction_start_year.assert_called_once()
    mock_transaction_repo.calculate_available_balance_for_period.assert_any_call(
        1, last_year
    )
    mock_transaction_repo.calculate_available_balance_for_period.assert_any_call(
        1, current_year
    )

    # Assert that the Redis set method was called with the correct parameters
    async with Redis(connection_pool=fake_redis_pool) as redis:
        assert int(await redis.get(f"balance_1_{last_year}")) == 100
        assert int(await redis.get(f"balance_1_{current_year}")) == 200


# mock_redis.set.assert_any_call(name=f"balance_1_{current_year}", value=200)


@pytest.mark.anyio
async def test_set_cache_value():
    # Mock the Redis client
    mock_redis = AsyncMock()

    # Call the function
    await set_cache_value(1, 2023, 100, mock_redis)

    # Assert that the Redis set method was called with the correct parameters
    mock_redis.set.assert_called_once_with(name="balance_1_2023", value=100)

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime

from redis.asyncio import ConnectionPool, Redis

from lcfs.services.tfrs.redis_balance import (
    init_org_balance_cache,
    set_cache_value,
    RedisBalanceService,
)


@pytest.mark.anyio
async def test_init_org_balance_cache():
    # Mock the session and repositories
    mock_session = AsyncMock()

    # Mock the Redis client
    mock_redis = AsyncMock()

    # Mock the settings
    mock_settings = AsyncMock()
    mock_settings.redis_url = "redis://localhost"

    current_year = datetime.now().year
    last_year = current_year - 1

    # Patch the Redis and session creation
    with patch("redis.asyncio.Redis.from_url", return_value=mock_redis):
        with patch("sqlalchemy.ext.asyncio.AsyncSession", return_value=mock_session):
            with patch(
                "lcfs.web.api.organizations.services.OrganizationsRepository.get_organizations",
                return_value=[
                    AsyncMock(organization_id=1, name="Org1"),
                    AsyncMock(organization_id=2, name="Org2"),
                ],
            ):
                with patch(
                    "lcfs.web.api.transaction.repo.TransactionRepository.get_transaction_start_year",
                    return_value=last_year,
                ):
                    with patch(
                        "lcfs.web.api.transaction.repo.TransactionRepository.calculate_available_balance_for_period",
                        side_effect=[100, 200, 150, 250, 300, 350],
                    ):
                        await init_org_balance_cache()

    # Assert that each cache set operation was called correctly
    calls = mock_redis.set.mock_calls
    assert len(calls) == 4
    mock_redis.set.assert_any_call(name=f"balance_1_{last_year}", value=100)
    mock_redis.set.assert_any_call(name=f"balance_2_{last_year}", value=200)
    mock_redis.set.assert_any_call(name=f"balance_1_{current_year}", value=150)
    mock_redis.set.assert_any_call(name=f"balance_2_{current_year}", value=250)


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

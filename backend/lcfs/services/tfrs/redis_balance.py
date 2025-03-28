import structlog
from datetime import datetime

from fastapi import FastAPI, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import async_engine
from lcfs.services.redis.dependency import get_redis_client
from lcfs.settings import settings
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler

app = FastAPI()
logger = structlog.get_logger(__name__)


async def init_org_balance_cache(app: FastAPI):
    """
    Initialize the organization balance cache and populate it with data.

    :param app: FastAPI application instance.
    """
    # Get the Redis client from app state
    redis: Redis = app.state.redis_client

    async with AsyncSession(async_engine) as session:
        async with session.begin():
            organization_repo = OrganizationsRepository(db=session)
            transaction_repo = TransactionRepository(db=session)

            # Get the oldest transaction year
            oldest_year = await transaction_repo.get_transaction_start_year() or int(
                2019
            )

            # Get the current year
            current_year = datetime.now().year
            logger.info(f"Starting balance cache population for {current_year}")

            # Fetch all organizations
            all_orgs = await organization_repo.get_organizations()

            # Loop from the oldest year to the current year
            for year in range(int(oldest_year), current_year + 1):
                for org in all_orgs:
                    # Calculate the balance for each organization and year
                    balance = (
                        await transaction_repo.calculate_available_balance_for_period(
                            org.organization_id, year
                        )
                    )
                    # Set the balance in Redis
                    await set_cache_value(org.organization_id, year, balance, redis)

            logger.info(f"Cache populated with {len(all_orgs)} organizations")


class RedisBalanceService:
    def __init__(
        self,
        transaction_repo=Depends(TransactionRepository),
        redis_client: Redis = Depends(get_redis_client),
    ):
        self.transaction_repo = transaction_repo
        self.redis_client = redis_client

    @service_handler
    async def populate_organization_redis_balance(
        self,
        organization_id,
    ):
        # Get the current year
        current_year = datetime.now().year
        oldest_year = await self.transaction_repo.get_transaction_start_year()

        # Loop from the oldest year to the current year
        for year in range(int(oldest_year), current_year + 1):
            # Call the function to process transactions for each year
            balance = (
                await self.transaction_repo.calculate_available_balance_for_period(
                    organization_id, year
                )
            )

            await set_cache_value(organization_id, year, balance, self.redis_client)


async def set_cache_value(
    organization_id: int, period: int, balance: int, redis: Redis
) -> None:
    """
    Set a cache value in Redis for a specific organization and period.

    :param organization_id: ID of the organization.
    :param period: The year or period for which the balance is being set.
    :param balance: The balance value to set in the cache.
    :param redis: Redis client instance.
    """
    await redis.set(name=f"balance_{organization_id}_{period}", value=balance)

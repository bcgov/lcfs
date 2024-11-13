import logging
from datetime import datetime

from fastapi import FastAPI, Depends
from redis.asyncio import Redis, ConnectionPool
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import async_engine
from lcfs.services.redis.dependency import get_redis_pool
from lcfs.settings import settings
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler

app = FastAPI()
logger = logging.getLogger(__name__)


async def init_org_balance_cache():
    async with AsyncSession(async_engine) as session:
        async with session.begin():

            organization_repo = OrganizationsRepository(db=session)
            transaction_repo = TransactionRepository(db=session)

            redis = Redis.from_url(
                str(settings.redis_url), encoding="utf8", decode_responses=True
            )

            # Get the oldest transaction year
            oldest_year = await transaction_repo.get_transaction_start_year()

            # Get the current year
            current_year = datetime.now().year
            logger.info(f"Starting balance cache population {current_year}")

            all_orgs = await organization_repo.get_organizations()

            # Loop from the oldest year to the current year
            for year in range(int(oldest_year), current_year + 1):
                # Call the function to process transactions for each year
                for org in all_orgs:
                    balance = (
                        await transaction_repo.calculate_available_balance_for_period(
                            org.organization_id, year
                        )
                    )
                    await set_cache_value(org.organization_id, year, balance, redis)
                    logger.debug(f"Set balance for {org.name} for {year} to {balance}")
            logger.info(f"Cache populated with {len(all_orgs)} organizations")


class RedisBalanceService:
    def __init__(
        self,
        transaction_repo=Depends(TransactionRepository),
        redis_pool: ConnectionPool = Depends(get_redis_pool),
    ):
        self.transaction_repo = transaction_repo
        self.redis_pool = redis_pool

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

            async with Redis(connection_pool=self.redis_pool) as redis:
                await set_cache_value(organization_id, year, balance, redis)
            logger.debug(
                f"Set balance for org {organization_id} for {year} to {balance}"
            )


async def set_cache_value(
    organization_id: int, period: int, balance: int, redis: Redis
) -> None:
    await redis.set(name=f"balance_{organization_id}_{period}", value=balance)

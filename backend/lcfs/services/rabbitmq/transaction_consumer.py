import asyncio
import json
import logging

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import async_engine
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.services.rabbitmq.base_consumer import BaseConsumer
from lcfs.services.tfrs.redis_balance import RedisBalanceService
from lcfs.settings import settings
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository

logger = logging.getLogger(__name__)
consumer = None
consumer_task = None


async def setup_transaction_consumer():
    global consumer, consumer_task
    consumer = TransactionConsumer()
    await consumer.connect()
    consumer_task = asyncio.create_task(consumer.start_consuming())


async def close_transaction_consumer():
    global consumer, consumer_task

    if consumer_task:
        consumer_task.cancel()

    if consumer:
        await consumer.close_connection()


class TransactionConsumer(BaseConsumer):
    def __init__(
        self,
        queue_name=settings.rabbitmq_transaction_queue,
    ):
        super().__init__(queue_name)

    async def process_message(self, body: bytes):
        message_content = json.loads(body.decode())
        compliance_units = message_content.get("compliance_units_amount")
        org_id = message_content.get("organization_id")

        redis = Redis.from_url(
            str(settings.redis_url), encoding="utf8", decode_responses=True
        )

        async with AsyncSession(async_engine) as session:
            async with session.begin():
                repo = OrganizationsRepository(db=session)
                transaction_repo = TransactionRepository(db=session)
                redis_balance_service = RedisBalanceService(
                    transaction_repo=transaction_repo, redis_pool=redis.connection_pool
                )
                org_service = OrganizationsService(
                    repo=repo,
                    transaction_repo=transaction_repo,
                    redis_balance_service=redis_balance_service,
                )

                await org_service.adjust_balance(
                    TransactionActionEnum.Adjustment, compliance_units, org_id
                )
                logger.debug(f"Processed Transaction from TFRS for Org {org_id}")

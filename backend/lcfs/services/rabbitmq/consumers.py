import asyncio

from lcfs.services.rabbitmq.transaction_consumer import (
    setup_transaction_consumer,
    close_transaction_consumer,
)


async def start_consumers():
    await setup_transaction_consumer()


async def stop_consumers():
    await close_transaction_consumer()

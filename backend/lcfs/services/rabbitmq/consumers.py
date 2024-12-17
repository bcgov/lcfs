import asyncio

from lcfs.services.rabbitmq.report_consumer import (
    setup_report_consumer,
    close_report_consumer,
)


async def start_consumers(app):
    await setup_report_consumer(app)


async def stop_consumers():
    await close_report_consumer()

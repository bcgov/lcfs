import asyncio
import logging

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractQueue

from lcfs.settings import settings

logging.getLogger("aiormq").setLevel(logging.WARNING)
logging.getLogger("aio_pika").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


class BaseConsumer:
    def __init__(self, queue_name=None):
        self.connection = None
        self.channel = None
        self.queue = None
        self.queue_name = queue_name

    async def connect(self):
        """Connect to RabbitMQ and set up the consumer."""
        connection_url = f"amqp://{settings.rabbitmq_user}:{settings.rabbitmq_pass}@{settings.rabbitmq_host}:{settings.rabbitmq_port}/{settings.rabbitmq_vhost}"

        self.connection = await aio_pika.connect_robust(connection_url)
        self.channel: AbstractChannel = await self.connection.channel()
        self.queue: AbstractQueue = await self.channel.declare_queue(
            name=self.queue_name,
            auto_delete=False,
            durable=True,
        )

        logger.debug(f"Queue '{self.queue_name}' declared and ready for consuming")

    async def start_consuming(self):
        """Start consuming messages from the queue."""
        if not self.queue:
            raise RuntimeError("Queue is not initialized. Call connect() first.")

        async with self.queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    logger.debug(f"Received message: {message.body.decode()}")
                    await self.process_message(message.body)
                    logger.debug("Message Processed")

    async def process_message(self, body: bytes):
        """Process the incoming message. Override this method in subclasses."""
        logger.warning(
            f"Base process_message called, you probably want to override process_message"
        )

    async def close_connection(self):
        """Close the RabbitMQ connection."""
        if self.connection:
            logger.debug("Closing RabbitMQ Connection")
            await self.connection.close()

import pika
import json

# Variables for RabbitMQ
rabbitmq_host: str = "localhost"
rabbitmq_port: int = 5672
rabbitmq_pass: str = "development_only"
rabbitmq_user: str = "lcfs"
rabbitmq_vhost: str = "lcfs"
rabbitmq_transaction_queue: str = "transaction_queue"

def send_message(tfrs_id: int, organization_id: int, compliance_units_amount: int):
    # Set up the credentials
    credentials = pika.PlainCredentials(rabbitmq_user, rabbitmq_pass)

    # Establish the connection with the credentials
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=rabbitmq_host,
            virtual_host=rabbitmq_vhost,
            port=rabbitmq_port,
            credentials=credentials,
        )
    )
    channel = connection.channel()

    # Declare the queue if not already declared
    channel.queue_declare(queue=rabbitmq_transaction_queue, durable=True)

    # Create the message body
    message = {
        "tfrs_id": tfrs_id,
        "organization_id": organization_id,
        "compliance_units_amount": compliance_units_amount,
    }

    # Publish the message to the queue
    channel.basic_publish(
        exchange="",
        routing_key="transaction_queue",
        body=json.dumps(message),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Make message persistent
        ),
    )

    print(f" [x] Sent message: {message}")

    # Close the connection
    connection.close()


if __name__ == "__main__":
    send_message(tfrs_id=1, organization_id=1, compliance_units_amount=1000)

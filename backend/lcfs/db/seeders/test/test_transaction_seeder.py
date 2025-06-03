import structlog
from sqlalchemy import select
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum

logger = structlog.get_logger(__name__)


async def seed_test_transactions(session):
    """
    Seeds comprehensive transaction data for organizations into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    # Comprehensive list of transactions needed by compliance reports, transfers, and admin adjustments
    transactions_to_seed = [
        # Admin adjustment transactions (1-10) - final adjustments
        {
            "transaction_id": 1,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 1,
        },
        {
            "transaction_id": 2,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 2,
        },
        {
            "transaction_id": 3,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 3,
        },
        {
            "transaction_id": 4,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 4,
        },
        {
            "transaction_id": 5,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 5,
        },
        {
            "transaction_id": 6,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 6,
        },
        {
            "transaction_id": 7,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 7,
        },
        {
            "transaction_id": 8,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 8,
        },
        {
            "transaction_id": 9,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 9,
        },
        {
            "transaction_id": 10,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 10,
        },
        # Transfer transactions (11-16) - transfers
        {
            "transaction_id": 11,
            "compliance_units": -10000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 5,
        },
        {
            "transaction_id": 12,
            "compliance_units": 5000,
            "transaction_action": TransactionActionEnum.Released,
            "organization_id": 5,
        },
        {
            "transaction_id": 13,
            "compliance_units": 100,
            "transaction_action": TransactionActionEnum.Released,
            "organization_id": 2,
        },
        {
            "transaction_id": 14,
            "compliance_units": -1000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 1,
        },
        {
            "transaction_id": 15,
            "compliance_units": 1000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 5,
        },
        {
            "transaction_id": 16,
            "compliance_units": 10000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 1,
        },
        # Compliance report transactions (17-18) - reserved for submitted reports
        {
            "transaction_id": 17,
            "compliance_units": -17639,
            "transaction_action": TransactionActionEnum.Reserved,
            "organization_id": 3,
        },
        {
            "transaction_id": 18,
            "compliance_units": 569,
            "transaction_action": TransactionActionEnum.Reserved,
            "organization_id": 2,
        },
    ]

    for transaction_data in transactions_to_seed:
        # Check if the transaction already exists
        existing_transaction = await session.execute(
            select(Transaction).where(
                Transaction.transaction_id == transaction_data["transaction_id"]
            )
        )
        if existing_transaction.scalar():
            logger.info(
                f"Transaction with ID {transaction_data['transaction_id']} already exists, skipping."
            )
            continue

        # Create and add the new transaction
        transaction = Transaction(**transaction_data)
        session.add(transaction)

    await session.flush()
    logger.info(f"Seeded {len(transactions_to_seed)} transactions.")

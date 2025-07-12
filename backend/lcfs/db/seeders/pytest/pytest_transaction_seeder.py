import structlog
from sqlalchemy import select
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum

logger = structlog.get_logger(__name__)


async def seed_pytest_transactions(session):
    """
    Seeds initial transaction for organizations into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    transactions_to_seed = [
        {
            "transaction_id": 1,
            "compliance_units": 50000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 1,
        },
        {
            "transaction_id": 2,
            "compliance_units": 1000,
            "transaction_action": TransactionActionEnum.Adjustment,
            "organization_id": 1,
        },
    ]

    try:
        for transaction_data in transactions_to_seed:
            # Check if the transaction already exists
            exists = await session.execute(
                select(Transaction).where(
                    Transaction.compliance_units
                    == transaction_data["compliance_units"],
                    Transaction.transaction_action
                    == transaction_data["transaction_action"],
                    Transaction.organization_id == transaction_data["organization_id"],
                )
            )
            if not exists.scalars().first():
                transaction = Transaction(**transaction_data)
                session.add(transaction)

    except Exception as e:
        context = {
            "function": "seed_pytest_transactions",
        }
        logger.error(
            "Error occurred while seeding transactions",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise

import logging
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum

logger = logging.getLogger(__name__)

async def seed_test_transactions(session):
    """
    Seeds transactions into the database, if they do not already exist.

    Args
    """
    transactions_to_seed = [
        {
            "compliance_units": 100,
            "organization_id": 1,
            "transaction_action": TransactionActionEnum.Adjustment,
        },
        {
            "compliance_units": -50,
            "organization_id": 2,
            "transaction_action": TransactionActionEnum.Reserved,
        },
        {
            "compliance_units": -50,
            "organization_id": 1,
            "transaction_action": TransactionActionEnum.Released,
        },
    ]

    try:
        for transaction_data in transactions_to_seed:
            # Check if a Transaction with the same attributes already exists
            exists = await session.execute(
                select(Transaction).where(
                    Transaction.compliance_units == transaction_data["compliance_units"],
                    Transaction.organization_id == transaction_data["organization_id"],
                    Transaction.transaction_action == transaction_data["transaction_action"]
                )
            )
            if not exists.scalars().first():
                transaction = Transaction(**transaction_data)
                session.add(transaction)

        await session.commit()
        logger.info("Transaction seeding completed successfully.")
    except SQLAlchemyError as e:
        logger.error(f"Error occurred while seeding transactions: {e}")
        await session.rollback()
        raise
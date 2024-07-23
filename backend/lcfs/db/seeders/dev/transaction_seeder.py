import logging
from sqlalchemy import select
from lcfs.db.models.transaction.Transaction import Transaction, TransactionActionEnum

logger = logging.getLogger(__name__)


async def seed_transactions(session):
    """
    Seeds initial transaction for organizations into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    transactions_to_seed = [
        {"transaction_id": 1,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 1},
        {"transaction_id": 2,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 2},
        {"transaction_id": 3,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 3},
        {"transaction_id": 4,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 4},
        {"transaction_id": 5,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 5},
        {"transaction_id": 6,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 6},
        {"transaction_id": 7,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 7},
        {"transaction_id": 8,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 8},
        {"transaction_id": 9,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 9},
        {"transaction_id": 10,
            'compliance_units': 50000, 'transaction_action': TransactionActionEnum.Adjustment, 'organization_id': 10}
    ]

    try:
        for transaction_data in transactions_to_seed:
            # Check if the transaction already exists
            exists = await session.execute(
                select(Transaction).where(
                    Transaction.compliance_units ==
                    transaction_data["compliance_units"],
                    Transaction.transaction_action ==
                    transaction_data["transaction_action"],
                    Transaction.organization_id ==
                    transaction_data["organization_id"],
                )
            )
            if not exists.scalars().first():
                transaction = Transaction(**transaction_data)
                session.add(transaction)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding transactions: %s", e)
        raise

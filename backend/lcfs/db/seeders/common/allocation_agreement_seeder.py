import logging
from sqlalchemy import select
from datetime import datetime
from lcfs.db.models.compliance.AllocationTransactionType import AllocationTransactionType

logger = logging.getLogger(__name__)

async def seed_allocation_transaction_types(session):
    """
    Seeds the allocation transaction types into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    allocation_transaction_types_to_seed = [
        {
            "allocation_transaction_type_id": 1,
            "type": "Purchased",
            "description": "Fuel purchased under an allocation agreement",
            "display_order": 1,
            "effective_date": datetime.strptime("2012-01-01", "%Y-%m-%d").date(),
        },
        {
            "allocation_transaction_type_id": 2,
            "type": "Sold",
            "description": "Fuel sold under an allocation agreement",
            "display_order": 2,
            "effective_date": datetime.strptime("2012-01-01", "%Y-%m-%d").date(),
        },
    ]

    try:
        for type_data in allocation_transaction_types_to_seed:
            exists = await session.execute(
                select(AllocationTransactionType).where(
                    AllocationTransactionType.type == type_data["type"])
            )
            if not exists.scalars().first():
                transaction_type = AllocationTransactionType(**type_data)
                session.add(transaction_type)

        await session.commit()
        logger.info("Successfully seeded allocation transaction types.")
    except Exception as e:
        logger.error(
            "Error occurred while seeding allocation transaction types: %s", e)
        await session.rollback()
        raise
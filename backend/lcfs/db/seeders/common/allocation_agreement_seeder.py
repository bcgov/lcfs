import structlog
from sqlalchemy import select
from datetime import datetime
from lcfs.db.models.compliance.AllocationTransactionType import (
    AllocationTransactionType,
)

logger = structlog.get_logger(__name__)


async def seed_allocation_transaction_types(session):
    """
    Seeds the allocation transaction types into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    allocation_transaction_types_to_seed = [
        {
            "allocation_transaction_type_id": 1,
            "type": "Allocated from",
            "description": "Fuel allocated from another supplier under an allocation agreement",
            "display_order": 1,
            "effective_date": datetime.strptime("2012-01-01", "%Y-%m-%d").date(),
        },
        {
            "allocation_transaction_type_id": 2,
            "type": "Allocated to",
            "description": "Fuel allocated to another supplier under an allocation agreement",
            "display_order": 2,
            "effective_date": datetime.strptime("2012-01-01", "%Y-%m-%d").date(),
        },
    ]

    try:
        for type_data in allocation_transaction_types_to_seed:
            exists = await session.execute(
                select(AllocationTransactionType).where(
                    AllocationTransactionType.type == type_data["type"]
                )
            )
            if not exists.scalars().first():
                transaction_type = AllocationTransactionType(**type_data)
                session.add(transaction_type)

    except Exception as e:
        context = {
            "function": "seed_allocation_transaction_types",
        }
        logger.error(
            "Error occurred while seeding allocation transaction types",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise

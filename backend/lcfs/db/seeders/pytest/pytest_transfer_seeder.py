import structlog
from datetime import datetime
from sqlalchemy import select, and_, text
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.organization.Organization import Organization

logger = structlog.get_logger(__name__)


async def seed_pytest_transfers(session):
    """
    Seeds the transfers into the test database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """
    transfers_to_seed = [
        {
            "from_organization_id": 1,
            "to_organization_id": 2,
            "current_status_id": 2,
            "transfer_category_id": 1,
            "agreement_date": datetime.strptime("2023-01-01", "%Y-%m-%d").date(),
            "quantity": 100,
            "price_per_unit": 10.0,
        },
        {
            "from_organization_id": 2,
            "to_organization_id": 1,
            "current_status_id": 2,
            "transfer_category_id": 1,
            "agreement_date": datetime.strptime("2023-01-02", "%Y-%m-%d").date(),
            "quantity": 50,
            "price_per_unit": 5.0,
        },
        {
            "from_organization_id": 2,
            "to_organization_id": 1,
            "current_status_id": 3,
            "transfer_category_id": 1,
            "from_transaction_id": 2,
            "agreement_date": datetime.strptime("2023-01-02", "%Y-%m-%d").date(),
            "quantity": 50,
            "price_per_unit": 5.0,
        },
    ]

    for transfer_data in transfers_to_seed:
        from_org_exists = await session.get(
            Organization, transfer_data["from_organization_id"]
        )
        to_org_exists = await session.get(
            Organization, transfer_data["to_organization_id"]
        )

        if not from_org_exists or not to_org_exists:
            context = {
                "transfer_data": transfer_data,
                "from_org_exists": from_org_exists,
                "to_org_exists": to_org_exists,
            }
            logger.error(
                "Referenced organizations for transfer do not exist.",
                **context,
            )
            continue

        try:
            exists = await session.execute(
                select(Transfer).where(
                    and_(
                        Transfer.from_organization_id
                        == transfer_data["from_organization_id"],
                        Transfer.to_organization_id
                        == transfer_data["to_organization_id"],
                        Transfer.current_status_id
                        == transfer_data["current_status_id"],
                        Transfer.transfer_category_id
                        == transfer_data["transfer_category_id"],
                        Transfer.agreement_date == transfer_data["agreement_date"],
                        Transfer.quantity == transfer_data["quantity"],
                        Transfer.price_per_unit == transfer_data["price_per_unit"],
                    )
                )
            )
            transfer = exists.scalars().first()
            if not transfer:
                transfer = Transfer(**transfer_data)
                session.add(transfer)
            else:
                # Update existing transfer if needed
                pass

        except Exception as e:
            context = {
                "function": "seed_pytest_transfers",
            }
            logger.error(
                "Error occurred while seeding transfers",
                error=str(e),
                exc_info=e,
                **context,
            )
            raise

    # Refresh the materialized view to include the new/updated transfers
    await session.execute(
        text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate")
    )

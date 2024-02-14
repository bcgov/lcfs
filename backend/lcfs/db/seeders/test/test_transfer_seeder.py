import logging
from sqlalchemy import select
from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.Organization import Organization

logger = logging.getLogger(__name__)

async def seed_test_transfers(session):
    """
    Seeds the transfers into the test database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """
    transfers_to_seed = [
        {
            "transfer_id": 1,
            "from_organization_id": 1,
            "to_organization_id": 2,
            "agreement_date": "2023-01-01",
            "quantity": 100,
            "price_per_unit": 10.0,
            "signing_authority_declaration": True,
            "comments": "Initial Transfer"
        },
        {
            "transfer_id": 2,
            "from_organization_id": 2,
            "to_organization_id": 1,
            "agreement_date": "2023-01-02",
            "quantity": 50,
            "price_per_unit": 5.0,
            "signing_authority_declaration": True,
            "comments": "Initial Transfer"
        },
    ]

    for transfer_data in transfers_to_seed:
        from_org_exists = await session.get(Organization, transfer_data["from_organization_id"])
        to_org_exists = await session.get(Organization, transfer_data["to_organization_id"])
        
        if not from_org_exists or not to_org_exists:
            logger.error(f"Referenced organizations for transfer {transfer_data} do not exist.")
            continue

        try:
            exists = await session.execute(
                select(Transfer).where(
                    Transfer.transfer_id == transfer_data["transfer_id"]
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
            logger.error(f"Error occurred while seeding transfers: {e}")
            raise

    await session.commit()

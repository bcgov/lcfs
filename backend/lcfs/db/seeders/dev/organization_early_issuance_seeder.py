import structlog
from sqlalchemy import select
from lcfs.db.models.organization.OrganizationEarlyIssuanceByYear import (
    OrganizationEarlyIssuanceByYear,
)

logger = structlog.get_logger(__name__)


async def seed_organization_early_issuance(session):
    """
    Seeds the organization early issuance data into the database.

    Args:
        session: The database session for committing the new records.
    """

    early_issuance_to_seed = [
        {"organization_id": 1, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 2, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 3, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 4, "compliance_period_id": 16, "has_early_issuance": True},
        {"organization_id": 5, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 6, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 7, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 8, "compliance_period_id": 16, "has_early_issuance": False},
        {"organization_id": 9, "compliance_period_id": 16, "has_early_issuance": False},
        {
            "organization_id": 10,
            "compliance_period_id": 16,
            "has_early_issuance": False,
        },
    ]

    try:
        for early_issuance_data in early_issuance_to_seed:
            # Check if record already exists
            existing_record = await session.execute(
                select(OrganizationEarlyIssuanceByYear).where(
                    OrganizationEarlyIssuanceByYear.organization_id
                    == early_issuance_data["organization_id"],
                    OrganizationEarlyIssuanceByYear.compliance_period_id
                    == early_issuance_data["compliance_period_id"],
                )
            )

            if existing_record.scalars().first():
                logger.info(
                    f"Early issuance record already exists for organization {early_issuance_data['organization_id']}"
                )
                continue

            # Create the early issuance record
            early_issuance_record = OrganizationEarlyIssuanceByYear(
                organization_id=early_issuance_data["organization_id"],
                compliance_period_id=early_issuance_data["compliance_period_id"],
                has_early_issuance=early_issuance_data["has_early_issuance"],
            )

            session.add(early_issuance_record)

        logger.info("Organization early issuance seeding completed successfully")

    except Exception as e:
        context = {
            "function": "seed_organization_early_issuance",
        }
        logger.error(
            "Error occurred while seeding organization early issuance",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise

import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.ComplianceReportOrganizationSnapshot import (
    ComplianceReportOrganizationSnapshot,
)

logger = structlog.get_logger(__name__)


async def seed_test_compliance_report_organization_snapshots(session):
    """
    Seeds the compliance report organization snapshots into the database,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the organization snapshots to seed based on compliance reports and organizations
    organization_snapshots_to_seed = [
        {
            "organization_snapshot_id": 1,
            "compliance_report_id": 1,
            "name": "LCFS Org 1",
            "operating_name": "LCFS Org 1",
            "email": "tfrs@gov.bc.ca",
            "phone": "604-567-8976",
            "head_office_address": "123 Main Street, Victoria, BC, V8X 1Y9",
            "service_address": "123 Main Street, Victoria, BC, V8X 1Y9",
            "records_address": "123 Main Street, Victoria, BC, V8X 1Y9",
            "is_edited": False,
        },
        {
            "organization_snapshot_id": 2,
            "compliance_report_id": 2,
            "name": "LCFS Org 6",
            "operating_name": "LCFS Org 6",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1414",
            "head_office_address": "1234 Volt Street, Floor 567, Electropolis, BC, V3S 8K6",
            "service_address": "1234 Volt Street, Floor 567, Electropolis, BC, V3S 8K6",
            "records_address": "1234 Volt Street, Floor 567, Electropolis, BC, V3S 8K6",
            "is_edited": False,
        },
        {
            "organization_snapshot_id": 3,
            "compliance_report_id": 3,
            "name": "LCFS Org 3",
            "operating_name": "LCFS Org 3",
            "email": "tfrs@gov.bc.ca",
            "phone": "250-765-9901",
            "head_office_address": "345 Radiant Road, Kamloops, BC, V6M 2W8",
            "service_address": "345 Radiant Road, Kamloops, BC, V6M 2W8",
            "records_address": "345 Radiant Road, Kamloops, BC, V6M 2W8",
            "is_edited": False,
        },
        {
            "organization_snapshot_id": 4,
            "compliance_report_id": 4,
            "name": "LCFS Org 2",
            "operating_name": "LCFS Org 2",
            "email": "tfrs@gov.bc.ca",
            "phone": "778-896-1198",
            "head_office_address": "781 112th Street, Floor 5, Unit B, Delta, BC, V4X 4Z7",
            "service_address": "781 112th Street, Floor 5, Unit B, Delta, BC, V4X 4Z7",
            "records_address": "781 112th Street, Floor 5, Unit B, Delta, BC, V4X 4Z7",
            "is_edited": False,
        },
        {
            "organization_snapshot_id": 5,
            "compliance_report_id": 5,
            "name": "LCFS Org 4",
            "operating_name": "LCFS Org 4",
            "email": "tfrs@gov.bc.ca",
            "phone": "250-555-1122",
            "head_office_address": "678 Hazle Boulevard, Unit 3A, Nanaimo, BC, S7K 5T1",
            "service_address": "678 Hazle Boulevard, Unit 3A, Nanaimo, BC, S7K 5T1",
            "records_address": "678 Hazle Boulevard, Unit 3A, Nanaimo, BC, S7K 5T1",
            "is_edited": False,
        },
        {
            "organization_snapshot_id": 6,
            "compliance_report_id": 6,
            "name": "LCFS Org 5",
            "operating_name": "LCFS Org 5",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1313",
            "head_office_address": "890 Nature Lane, Building 987, BioVista, BC, H1A 9B4",
            "service_address": "890 Nature Lane, Building 987, BioVista, BC, H1A 9B4",
            "records_address": "890 Nature Lane, Building 987, BioVista, BC, H1A 9B4",
            "is_edited": False,
        },
    ]

    for snapshot_data in organization_snapshots_to_seed:
        # Check if the organization snapshot already exists
        existing_snapshot = await session.execute(
            select(ComplianceReportOrganizationSnapshot).where(
                ComplianceReportOrganizationSnapshot.organization_snapshot_id
                == snapshot_data["organization_snapshot_id"]
            )
        )
        if existing_snapshot.scalar():
            logger.info(
                f"Organization snapshot with ID {snapshot_data['organization_snapshot_id']} already exists, skipping."
            )
            continue

        # Create and add the new organization snapshot
        organization_snapshot = ComplianceReportOrganizationSnapshot(**snapshot_data)
        session.add(organization_snapshot)

    await session.flush()
    logger.info(f"Seeded {len(organization_snapshots_to_seed)} organization snapshots.")

import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport

logger = structlog.get_logger(__name__)


async def seed_test_compliance_reports(session):
    """
    Seeds the compliance reports into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the compliance reports to seed based on actual test database
    compliance_reports_to_seed = [
        {
            "compliance_report_id": 1,
            "organization_id": 1,
            "compliance_period_id": 15,
            "current_status_id": 1,
            "compliance_report_group_uuid": "ad7eef66-3c42-4188-8ff0-534527a90b8c",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        {
            "compliance_report_id": 2,
            "organization_id": 6,
            "compliance_period_id": 15,
            "current_status_id": 1,
            "compliance_report_group_uuid": "b536659c-0435-467f-9f38-f6791a94004b",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        {
            "compliance_report_id": 3,
            "organization_id": 3,
            "compliance_period_id": 15,
            "current_status_id": 2,
            "transaction_id": 17,
            "compliance_report_group_uuid": "9a2ac61c-6c97-42f2-babd-83d02d6358d0",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        {
            "compliance_report_id": 4,
            "organization_id": 2,
            "compliance_period_id": 15,
            "current_status_id": 2,
            "transaction_id": 18,
            "compliance_report_group_uuid": "d0d75700-48ca-40db-8c28-5b0d1a3a7d44",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        {
            "compliance_report_id": 5,
            "organization_id": 4,
            "compliance_period_id": 15,
            "current_status_id": 1,
            "compliance_report_group_uuid": "ece314c1-94ca-4e64-81ad-c89d2dba5a99",
            "version": 0,
            "reporting_frequency": "QUARTERLY",
            "nickname": "Early Issuance Report",
        },
        {
            "compliance_report_id": 6,
            "organization_id": 5,
            "compliance_period_id": 15,
            "current_status_id": 1,
            "compliance_report_group_uuid": "1122a80e-99a3-447b-a62e-4c758dd83700",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
    ]

    for compliance_report_data in compliance_reports_to_seed:
        # Check if the compliance report already exists
        existing_compliance_report = await session.execute(
            select(ComplianceReport).where(
                ComplianceReport.compliance_report_id
                == compliance_report_data["compliance_report_id"]
            )
        )
        if existing_compliance_report.scalar():
            logger.info(
                f"Compliance report with ID {compliance_report_data['compliance_report_id']} already exists, skipping."
            )
            continue

        # Create and add the new compliance report
        compliance_report = ComplianceReport(**compliance_report_data)
        session.add(compliance_report)

    await session.flush()
    logger.info(f"Seeded {len(compliance_reports_to_seed)} compliance reports.")

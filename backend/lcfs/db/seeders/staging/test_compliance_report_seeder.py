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
        # New LCFS1-10 scenarios (separate IDs to avoid collisions)
        # LCFS1 (org 1, user 7): Draft 2024
        {
            "compliance_report_id": 101,
            "organization_id": 1,
            "compliance_period_id": 15,  # 2024
            "current_status_id": 1,  # Draft
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111101",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        # LCFS2 (org 2, user 8): Submitted 2024, reserved tx 101
        {
            "compliance_report_id": 102,
            "organization_id": 2,
            "compliance_period_id": 15,
            "current_status_id": 2,  # Submitted
            "transaction_id": 101,
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111102",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        # LCFS3 (org 3, user 9): Recommended (Analyst) 2024, reserved tx 104
        {
            "compliance_report_id": 103,
            "organization_id": 3,
            "compliance_period_id": 15,
            "current_status_id": 3,  # Recommended_by_analyst
            "transaction_id": 104,
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111103",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        # LCFS4 (org 4, user 10): Assessed 2024, adjustment tx 102
        {
            "compliance_report_id": 104,
            "organization_id": 4,
            "compliance_period_id": 15,
            "current_status_id": 5,  # Assessed
            "transaction_id": 102,
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111104",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        # LCFS5 (org 5, user 11): Analyst adjustment (gov reassessment) 2025, reserved tx 106
        {
            "compliance_report_id": 105,
            "organization_id": 5,
            "compliance_period_id": 16,  # 2025
            "current_status_id": 1,  # Draft (analyst adjustment draft)
            "transaction_id": 106,
            # Supplemental off existing org 5 baseline (id 6) chain
            "compliance_report_group_uuid": "1122a80e-99a3-447b-a62e-4c758dd83700",
            "version": 1,
            "reporting_frequency": "ANNUAL",
            "nickname": "Supplemental Report 1",
        },
        # LCFS6 (org 6, user 12): Supplier supplemental v1 (post-assessed baseline) 2025, adjustment tx 105
        {
            "compliance_report_id": 106,
            "organization_id": 6,
            "compliance_period_id": 16,
            "current_status_id": 1,  # Draft (supplemental)
            "transaction_id": 105,
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111106",
            "version": 1,
            "reporting_frequency": "ANNUAL",
            "nickname": "Supplemental Report 1",
        },
        # LCFS7 (org 7, user 13): Gov-initiated supplemental on submitted 2025, reserved tx 107
        {
            "compliance_report_id": 107,
            "organization_id": 7,
            "compliance_period_id": 16,
            "current_status_id": 1,  # Draft (gov supplemental)
            "transaction_id": 107,
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111107",
            "version": 1,
            "reporting_frequency": "ANNUAL",
            "nickname": "Supplemental Report 1",
        },
        # LCFS8 (org 8, user 14): Early issuance quarterly draft 2025
        {
            "compliance_report_id": 108,
            "organization_id": 8,
            "compliance_period_id": 16,
            "current_status_id": 1,  # Draft
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111108",
            "version": 0,
            "reporting_frequency": "QUARTERLY",
            "nickname": "Original Report",
        },
        # LCFS9 (org 9, user 15): Pre-2025 assessed baseline (2023) to drive 2025 lock logic, adjustment tx 103
        {
            "compliance_report_id": 109,
            "organization_id": 9,
            "compliance_period_id": 14,  # 2023
            "current_status_id": 5,  # Assessed
            "transaction_id": 103,
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111109",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        # LCFS10 (org 10, user 16): 2025 draft with previous-year assessed baseline existing (see LCFS9)
        {
            "compliance_report_id": 110,
            "organization_id": 10,
            "compliance_period_id": 16,  # 2025
            "current_status_id": 1,  # Draft
            "compliance_report_group_uuid": "11111111-1111-1111-1111-111111111110",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Supplemental Report 1",
        },
        # New chain: Org 2, versions 0-2 in 2025 (submitted -> assessed supplemental -> draft supplemental)
        {
            "compliance_report_id": 111,
            "organization_id": 2,
            "compliance_period_id": 16,
            "current_status_id": 2,  # Submitted
            "transaction_id": 111,
            "compliance_report_group_uuid": "22222222-2222-2222-2222-222222221111",
            "version": 0,
            "reporting_frequency": "ANNUAL",
            "nickname": "Original Report",
        },
        {
            "compliance_report_id": 112,
            "organization_id": 2,
            "compliance_period_id": 16,
            "current_status_id": 5,  # Assessed
            "transaction_id": 112,
            "compliance_report_group_uuid": "22222222-2222-2222-2222-222222221111",
            "version": 1,
            "reporting_frequency": "ANNUAL",
            "nickname": "Supplemental Report 1",
        },
        {
            "compliance_report_id": 113,
            "organization_id": 2,
            "compliance_period_id": 16,
            "current_status_id": 1,  # Draft supplemental
            "transaction_id": 113,
            "compliance_report_group_uuid": "22222222-2222-2222-2222-222222221111",
            "version": 2,
            "reporting_frequency": "ANNUAL",
            "nickname": "Supplemental Report 2",
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

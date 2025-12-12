import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.ComplianceReportHistory import ComplianceReportHistory

logger = structlog.get_logger(__name__)


async def seed_test_compliance_report_history(session):
    """
    Seeds compliance report history records into the database based on actual test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the compliance report history records to seed based on actual test database
    history_records_to_seed = [
        {
            "compliance_report_history_id": 1,
            "compliance_report_id": 1,
            "status_id": 1,
            "user_profile_id": 7,
            "display_name": "Jane Doe",
        },
        {
            "compliance_report_history_id": 2,
            "compliance_report_id": 2,
            "status_id": 1,
            "user_profile_id": 12,
            "display_name": "Frank Wilson",
        },
        {
            "compliance_report_history_id": 3,
            "compliance_report_id": 3,
            "status_id": 1,
            "user_profile_id": 9,
            "display_name": "Alice Woo",
        },
        {
            "compliance_report_history_id": 4,
            "compliance_report_id": 4,
            "status_id": 1,
            "user_profile_id": 8,
            "display_name": "John Smith",
        },
        {
            "compliance_report_history_id": 5,
            "compliance_report_id": 5,
            "status_id": 1,
            "user_profile_id": 10,
            "display_name": "Bob Lee",
        },
        {
            "compliance_report_history_id": 6,
            "compliance_report_id": 6,
            "status_id": 1,
            "user_profile_id": 11,
            "display_name": "David Clark",
        },
        {
            "compliance_report_history_id": 7,
            "compliance_report_id": 3,
            "status_id": 2,
            "user_profile_id": 9,
            "display_name": "Alice Woo",
        },
        {
            "compliance_report_history_id": 8,
            "compliance_report_id": 4,
            "status_id": 2,
            "user_profile_id": 8,
            "display_name": "John Smith",
        },
        # New histories for LCFS1-10 scenarios
        {"compliance_report_history_id": 101, "compliance_report_id": 101, "status_id": 1, "user_profile_id": 7, "display_name": "Jane Doe"},
        {"compliance_report_history_id": 102, "compliance_report_id": 102, "status_id": 1, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 103, "compliance_report_id": 102, "status_id": 2, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 104, "compliance_report_id": 103, "status_id": 1, "user_profile_id": 9, "display_name": "Alice Woo"},
        {"compliance_report_history_id": 105, "compliance_report_id": 103, "status_id": 2, "user_profile_id": 9, "display_name": "Alice Woo"},
        {"compliance_report_history_id": 106, "compliance_report_id": 103, "status_id": 3, "user_profile_id": 9, "display_name": "Alice Woo"},
        {"compliance_report_history_id": 107, "compliance_report_id": 104, "status_id": 1, "user_profile_id": 10, "display_name": "Bob Lee"},
        {"compliance_report_history_id": 108, "compliance_report_id": 104, "status_id": 2, "user_profile_id": 10, "display_name": "Bob Lee"},
        {"compliance_report_history_id": 109, "compliance_report_id": 104, "status_id": 3, "user_profile_id": 10, "display_name": "Bob Lee"},
        {"compliance_report_history_id": 110, "compliance_report_id": 104, "status_id": 5, "user_profile_id": 10, "display_name": "Bob Lee"},
        {"compliance_report_history_id": 111, "compliance_report_id": 105, "status_id": 1, "user_profile_id": 11, "display_name": "David Clark"},
        {"compliance_report_history_id": 113, "compliance_report_id": 106, "status_id": 1, "user_profile_id": 12, "display_name": "Frank Wilson"},
        {"compliance_report_history_id": 114, "compliance_report_id": 107, "status_id": 1, "user_profile_id": 13, "display_name": "Bill Teller"},
        {"compliance_report_history_id": 115, "compliance_report_id": 108, "status_id": 1, "user_profile_id": 14, "display_name": "James Bell"},
        {"compliance_report_history_id": 116, "compliance_report_id": 109, "status_id": 5, "user_profile_id": 15, "display_name": "Leo Martin"},
        {"compliance_report_history_id": 117, "compliance_report_id": 110, "status_id": 1, "user_profile_id": 16, "display_name": "Noah Thomas"},
        {"compliance_report_history_id": 118, "compliance_report_id": 111, "status_id": 1, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 119, "compliance_report_id": 111, "status_id": 2, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 120, "compliance_report_id": 112, "status_id": 1, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 121, "compliance_report_id": 112, "status_id": 2, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 122, "compliance_report_id": 112, "status_id": 5, "user_profile_id": 8, "display_name": "John Smith"},
        {"compliance_report_history_id": 123, "compliance_report_id": 113, "status_id": 1, "user_profile_id": 8, "display_name": "John Smith"},
    ]

    for history_data in history_records_to_seed:
        # Check if the history record already exists
        existing_history = await session.execute(
            select(ComplianceReportHistory).where(
                ComplianceReportHistory.compliance_report_history_id
                == history_data["compliance_report_history_id"]
            )
        )
        if existing_history.scalar():
            logger.info(
                f"Compliance report history record with ID {history_data['compliance_report_history_id']} already exists, skipping."
            )
            continue

        # Create and add the new history record
        history_record = ComplianceReportHistory(**history_data)
        session.add(history_record)

    await session.flush()
    logger.info(
        f"Seeded {len(history_records_to_seed)} compliance report history records."
    )

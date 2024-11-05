import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)

logger = structlog.get_logger(__name__)


async def seed_compliance_report_statuses(session):
    """
    Seeds the compliance report statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    compliance_report_statuses_to_seed = [
        {
            "compliance_report_status_id": 1,
            "status": ComplianceReportStatusEnum.Draft,
        },
        {
            "compliance_report_status_id": 2,
            "status": ComplianceReportStatusEnum.Submitted,
        },
        {
            "compliance_report_status_id": 3,
            "status": ComplianceReportStatusEnum.Recommended_by_analyst,
        },
        {
            "compliance_report_status_id": 4,
            "status": ComplianceReportStatusEnum.Recommended_by_manager,
        },
        {
            "compliance_report_status_id": 5,
            "status": ComplianceReportStatusEnum.Assessed,
        },
        {
            "compliance_report_status_id": 6,
            "status": ComplianceReportStatusEnum.ReAssessed,
        },
    ]

    try:
        for status_data in compliance_report_statuses_to_seed:
            exists = await session.execute(
                select(ComplianceReportStatus).where(
                    ComplianceReportStatus.status == status_data["status"]
                )
            )
            if not exists.scalars().first():
                status = ComplianceReportStatus(**status_data)
                session.add(status)

    except Exception as e:
        context = {
            "function": "seed_compliance_report_statuses",
        }
        logger.error(
            "Error occurred while seeding compliance report statuses",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise

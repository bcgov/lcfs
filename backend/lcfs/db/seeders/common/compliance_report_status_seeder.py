import logging
from sqlalchemy import select
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus, ComplianceReportStatusEnum

logger = logging.getLogger(__name__)

async def seed_compliance_report_statuses(session):
    """
    Seeds the compliance report statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    compliance_report_statuses_to_seed = [
        {
            "status": ComplianceReportStatusEnum.Draft,
        },
        {
            "status": ComplianceReportStatusEnum.Submitted,
        },
        {
            "status": ComplianceReportStatusEnum.Recommended_by_analyst,
        },
        {
            "status": ComplianceReportStatusEnum.Recommended_by_manager,
        },
        {
            "status": ComplianceReportStatusEnum.Assessed,
        },
        {
            "status": ComplianceReportStatusEnum.ReAssessed,
        },
    ]

    try:
        for status_data in compliance_report_statuses_to_seed:
            exists = await session.execute(
                select(ComplianceReportStatus).where(ComplianceReportStatus.status == status_data["status"])
            )
            if not exists.scalars().first():
                status = ComplianceReportStatus(**status_data)
                session.add(status)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding compliance report statuses: %s", e)
        await session.rollback()
        raise

"""
Compliance Report Tasks

This module contains tasks related to compliance report management
and automated status updates.

All functions in this module should:
- Accept a db_session parameter
- Return True for success, False for failure
- Use proper logging with structlog
- Handle exceptions gracefully
"""

import asyncio
import structlog
from datetime import datetime, timedelta
from typing import List
from sqlalchemy import select, and_, text
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


async def auto_submit_overdue_supplemental_reports(db_session: AsyncSession):
    """
    Task to automatically update compliance reports from Draft to Submitted status
    when supplementalInitiator === 'Supplier Supplemental' and update_date is older than 30 days.

    Uses existing service and repository components for proper business logic handling.

    Args:
        db_session: Database session provided by the scheduler

    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Starting auto-submit overdue supplemental reports task")

    try:
        # Lazy imports to avoid circular dependencies
        from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
        from lcfs.web.api.compliance_report.update_service import (
            ComplianceReportUpdateService,
        )
        from lcfs.web.api.compliance_report.summary_repo import (
            ComplianceReportSummaryRepository,
        )
        from lcfs.web.api.compliance_report.summary_service import (
            ComplianceReportSummaryService,
        )
        from lcfs.web.api.organizations.services import OrganizationsService
        from lcfs.web.api.transaction.services import TransactionsService
        from lcfs.web.api.notification.services import NotificationService
        from lcfs.db.models.user.UserProfile import UserProfile
        from lcfs.db.models.compliance.ComplianceReport import SupplementalInitiatorType
        from lcfs.db.models.compliance.ComplianceReportStatus import (
            ComplianceReportStatusEnum,
        )
        from lcfs.web.api.compliance_report.schema import ComplianceReportUpdateSchema

        # Initialize repositories and services using existing architecture
        repo = ComplianceReportRepository(db=db_session)
        summary_repo = ComplianceReportSummaryRepository(db=db_session)
        summary_service = ComplianceReportSummaryService(repo=summary_repo)
        org_service = OrganizationsService()
        trx_service = TransactionsService()
        notfn_service = NotificationService()

        update_service = ComplianceReportUpdateService(
            repo=repo,
            summary_repo=summary_repo,
            summary_service=summary_service,
            org_service=org_service,
            trx_service=trx_service,
            notfn_service=notfn_service,
        )

        # Calculate cutoff date (30 days ago)
        cutoff_date = datetime.now() - timedelta(days=30)

        logger.info(
            f"Looking for supplier supplemental reports in Draft status older than {cutoff_date}"
        )

        # Get overdue draft supplemental reports using existing repo method
        overdue_reports = await get_overdue_draft_supplemental_reports(
            repo, cutoff_date
        )

        if not overdue_reports:
            logger.info("No overdue supplier supplemental reports found")
            return True

        logger.info(
            f"Found {len(overdue_reports)} overdue supplier supplemental reports"
        )

        # Create a system user profile for audit trail
        system_user = await get_or_create_system_user(db_session)

        # Update each report using existing service
        success_count = 0
        total_reports = len(overdue_reports)

        for report in overdue_reports:
            try:
                logger.info(
                    f"Auto-submitting compliance report ID {report.compliance_report_id} "
                    f"(Organization: {report.organization.name if report.organization else 'Unknown'}, "
                    f"Version: {report.version}, Last Updated: {report.update_date})"
                )

                # Use existing service to update the report status
                update_schema = ComplianceReportUpdateSchema(
                    status="Submitted",
                    supplemental_note=f"Auto-submitted by system on {datetime.now().strftime('%Y-%m-%d')} due to 30+ day draft status",
                )

                # Use the existing service which handles all business logic
                await update_service.update_compliance_report(
                    report_id=report.compliance_report_id,
                    report_data=update_schema,
                    user=system_user,
                )

                success_count += 1
                logger.info(
                    f"Successfully auto-submitted compliance report ID {report.compliance_report_id}"
                )

                # Small delay between updates to prevent overwhelming the system
                await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(
                    f"Failed to auto-submit compliance report ID {report.compliance_report_id}: {e}"
                )
                continue

        logger.info(
            f"Auto-submit task completed: {success_count}/{total_reports} reports successfully updated"
        )

        # Return True if at least some reports were updated successfully
        return success_count > 0 or total_reports == 0

    except ImportError as e:
        logger.error(f"Failed to import required modules: {e}")
        return False
    except Exception as e:
        logger.error(
            f"Failed to execute auto-submit overdue supplemental reports task: {e}"
        )
        return False


async def get_overdue_draft_supplemental_reports(
    repo: "ComplianceReportRepository", cutoff_date: datetime
) -> List:
    """
    Get compliance reports that are overdue for auto-submission using existing repo patterns.

    Criteria:
    - supplemental_initiator = 'Supplier Supplemental'
    - current_status = 'Draft'
    - update_date <= cutoff_date (30 days ago)

    Args:
        repo: ComplianceReportRepository instance
        cutoff_date: Reports updated before this date are considered overdue

    Returns:
        List of overdue compliance reports
    """
    try:
        from lcfs.db.models.compliance.ComplianceReport import (
            ComplianceReport,
            SupplementalInitiatorType,
        )
        from lcfs.db.models.compliance.ComplianceReportStatus import (
            ComplianceReportStatus,
            ComplianceReportStatusEnum,
        )

        # Use raw query through repo's db session since this is a specific use case
        query = (
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.current_status),
                joinedload(ComplianceReport.organization),
                joinedload(ComplianceReport.compliance_period),
            )
            .join(ComplianceReportStatus)
            .where(
                and_(
                    ComplianceReport.supplemental_initiator
                    == SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL,
                    ComplianceReportStatus.status == ComplianceReportStatusEnum.Draft,
                    ComplianceReport.update_date <= cutoff_date,
                )
            )
            .order_by(ComplianceReport.update_date)
        )

        result = await repo.db.execute(query)
        reports = result.scalars().all()

        logger.info(f"Retrieved {len(reports)} overdue draft supplemental reports")
        return list(reports)

    except Exception as e:
        logger.error(f"Error retrieving overdue compliance reports: {e}")
        return []


async def get_or_create_system_user(db_session: AsyncSession):
    """
    Get or create a system user for automated operations.

    Args:
        db_session: Database session

    Returns:
        UserProfile object for system user
    """
    try:
        from lcfs.db.models.user.UserProfile import UserProfile
        from sqlalchemy import select

        # Try to find existing system user
        query = select(UserProfile).where(
            UserProfile.keycloak_username == "system-auto-submit"
        )

        result = await db_session.execute(query)
        system_user = result.scalar_one_or_none()

        if not system_user:
            # Create system user if it doesn't exist
            system_user = UserProfile(
                keycloak_username="system-auto-submit",
                first_name="System",
                last_name="Auto Submit",
                email="system@lcfs.gov.bc.ca",
                is_active=True,
            )
            db_session.add(system_user)
            await db_session.commit()
            logger.info("Created system user for auto-submit operations")

        return system_user

    except Exception as e:
        logger.error(f"Error getting/creating system user: {e}")
        # Fallback - create a minimal system user object
        from lcfs.db.models.user.UserProfile import UserProfile

        return UserProfile(
            user_profile_id=None,
            keycloak_username="system-auto-submit",
            first_name="System",
            last_name="Auto Submit",
        )


async def check_overdue_reports_summary(db_session: AsyncSession):
    """
    Task to generate a summary report of overdue compliance reports without updating them.
    Uses existing repository patterns for consistency.

    Args:
        db_session: Database session provided by the scheduler

    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Starting overdue compliance reports summary task")

    try:
        from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
        from sqlalchemy import text

        # Initialize repository
        repo = ComplianceReportRepository(db=db_session)

        # Calculate various cutoff dates
        cutoff_30_days = datetime.now() - timedelta(days=30)
        cutoff_60_days = datetime.now() - timedelta(days=60)
        cutoff_90_days = datetime.now() - timedelta(days=90)

        # Get summary statistics using repo's database session
        summary_query = text(
            """
            SELECT 
                COUNT(*) as total_overdue,
                COUNT(CASE WHEN cr.update_date <= :cutoff_30 THEN 1 END) as overdue_30_days,
                COUNT(CASE WHEN cr.update_date <= :cutoff_60 THEN 1 END) as overdue_60_days,
                COUNT(CASE WHEN cr.update_date <= :cutoff_90 THEN 1 END) as overdue_90_days,
                AVG(EXTRACT(days FROM (NOW() - cr.update_date))) as avg_days_overdue
            FROM compliance_report cr
            JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
            WHERE cr.supplemental_initiator = 'Supplier Supplemental'
            AND crs.status = 'Draft'
            AND cr.update_date <= :cutoff_30
        """
        )

        result = await repo.db.execute(
            summary_query,
            {
                "cutoff_30": cutoff_30_days,
                "cutoff_60": cutoff_60_days,
                "cutoff_90": cutoff_90_days,
            },
        )

        summary = result.fetchone()

        if summary and summary.total_overdue > 0:
            logger.info(
                f"Overdue compliance reports summary: "
                f"Total overdue: {summary.total_overdue}, "
                f"30+ days: {summary.overdue_30_days}, "
                f"60+ days: {summary.overdue_60_days}, "
                f"90+ days: {summary.overdue_90_days}, "
                f"Average days overdue: {summary.avg_days_overdue:.1f}"
            )
        else:
            logger.info("No overdue supplier supplemental compliance reports found")

        return True

    except Exception as e:
        logger.error(f"Failed to generate overdue reports summary: {e}")
        return False


async def test_compliance_report_task(db_session: AsyncSession):
    """
    Simple test task for compliance report module using existing components.

    Args:
        db_session: Database session provided by the scheduler

    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Running test compliance report task")

    try:
        from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
        from sqlalchemy import text

        # Initialize repository to test service layer
        repo = ComplianceReportRepository(db=db_session)

        # Test database connectivity
        result = await repo.db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            logger.info("Database connection test passed")
        else:
            logger.error("Database connection test failed")
            return False

        # Test repository functionality
        try:
            # Try to get a status to test repo functionality
            draft_status = await repo.get_compliance_report_status_by_desc("Draft")
            if draft_status:
                logger.info(
                    f"Repository test passed - found Draft status with ID {draft_status.compliance_report_status_id}"
                )
            else:
                logger.warning(
                    "Repository test - Draft status not found, but repo is functional"
                )
        except Exception as e:
            logger.error(f"Repository test failed: {e}")
            return False

        # Test basic table access
        result = await repo.db.execute(
            text("SELECT COUNT(*) FROM compliance_report LIMIT 1")
        )
        count = result.scalar()
        logger.info(f"Compliance reports table accessible, found {count} total reports")

        return True

    except Exception as e:
        logger.error(f"Test compliance report task failed: {e}")
        return False


if __name__ == "__main__":
    # This is just a placeholder to allow running this module directly for testing
    # In production, these tasks would be scheduled by the dynamic scheduler
    import asyncio

    async def main():
        async with AsyncSession() as session:
            await auto_submit_overdue_supplemental_reports(session)

    asyncio.run(main())
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
from lcfs.db.models.compliance import ComplianceReport, ComplianceReportStatus
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportUpdateSchema
from lcfs.web.api.compliance_report.summary_repo import (
    ComplianceReportSummaryRepository,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transaction.services import TransactionsService
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

        # Initialize repositories and services using existing architecture
        fuel_supply_repo = FuelSupplyRepository(db=db_session)
        repo = ComplianceReportRepository(db=db_session, fuel_supply_repo=fuel_supply_repo)
        summary_repo = ComplianceReportSummaryRepository(db=db_session, fuel_supply_repo=fuel_supply_repo)
        summary_service = ComplianceReportSummaryService(
            repo=summary_repo,
            cr_repo=repo,
            trxn_repo=TransactionRepository(db=db_session),
            notional_transfer_service=NotionalTransferServices(db_session),
        )
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

    except Exception as e:
        logger.error(
            f"Failed to execute auto-submit overdue supplemental reports task: {e}"
        )
        return False



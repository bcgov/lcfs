"""
Compliance Report Tasks

This module contains tasks related to compliance report management
and automated status updates.
These tasks are designed to be run by the dynamic scheduler.
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
    
    Args:
        db_session: Database session provided by the scheduler
        
    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Starting auto-submit overdue supplemental reports task")
    
    try:
        # Calculate cutoff date (30 days ago)
        cutoff_date = datetime.now() - timedelta(days=30)
        
        logger.info(f"Looking for supplier supplemental reports in Draft status older than {cutoff_date}")
        
        # Get overdue draft supplemental reports
        overdue_reports = await get_overdue_draft_supplemental_reports(db_session, cutoff_date)
        
        if not overdue_reports:
            logger.info("No overdue supplier supplemental reports found")
            return True
        
        logger.info(f"Found {len(overdue_reports)} overdue supplier supplemental reports")
        
        # Get the Submitted status
        submitted_status = await get_compliance_report_status_by_name(db_session, "Submitted")
        if not submitted_status:
            logger.error("Could not find 'Submitted' status in database")
            return False
        
        # Update each report
        success_count = 0
        total_reports = len(overdue_reports)
        
        for report in overdue_reports:
            try:
                logger.info(
                    f"Auto-submitting compliance report ID {report.compliance_report_id} "
                    f"(Organization: {report.organization.name if report.organization else 'Unknown'}, "
                    f"Version: {report.version}, Last Updated: {report.update_date})"
                )
                
                # Update the status
                report.current_status = submitted_status
                
                # Add to session and commit
                db_session.add(report)
                
                # Create history record for audit trail
                await create_auto_submit_history_record(db_session, report)
                
                # Commit this individual report update
                await db_session.commit()
                
                success_count += 1
                logger.info(f"Successfully auto-submitted compliance report ID {report.compliance_report_id}")
                
                # Small delay between updates to prevent overwhelming the database
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Failed to auto-submit compliance report ID {report.compliance_report_id}: {e}")
                await db_session.rollback()
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
        logger.error(f"Failed to execute auto-submit overdue supplemental reports task: {e}")
        return False


async def get_overdue_draft_supplemental_reports(db_session: AsyncSession, cutoff_date: datetime) -> List:
    """
    Get compliance reports that are overdue for auto-submission.
    
    Criteria:
    - supplemental_initiator = 'Supplier Supplemental'  
    - current_status = 'Draft'
    - update_date <= cutoff_date (30 days ago)
    
    Args:
        db_session: Database session
        cutoff_date: Reports updated before this date are considered overdue
    
    Returns:
        List of overdue compliance reports
    """
    try:
        # Lazy imports to avoid circular dependencies
        from lcfs.db.models.compliance.ComplianceReport import (
            ComplianceReport, 
            SupplementalInitiatorType
        )
        from lcfs.db.models.compliance.ComplianceReportStatus import (
            ComplianceReportStatus,
            ComplianceReportStatusEnum
        )
        
        # Query for overdue draft supplemental reports
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
                    ComplianceReport.supplemental_initiator == SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL,
                    ComplianceReportStatus.status == ComplianceReportStatusEnum.Draft,
                    ComplianceReport.update_date <= cutoff_date
                )
            )
            .order_by(ComplianceReport.update_date)
        )
        
        result = await db_session.execute(query)
        reports = result.scalars().all()
        
        logger.info(f"Retrieved {len(reports)} overdue draft supplemental reports")
        return list(reports)
        
    except ImportError as e:
        logger.error(f"Failed to import compliance report models: {e}")
        return []
    except Exception as e:
        logger.error(f"Error retrieving overdue compliance reports: {e}")
        return []


async def get_compliance_report_status_by_name(db_session: AsyncSession, status_name: str):
    """
    Get compliance report status by name.
    
    Args:
        db_session: Database session
        status_name: Name of the status (e.g., "Submitted")
    
    Returns:
        ComplianceReportStatus object or None
    """
    try:
        from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatus
        
        query = select(ComplianceReportStatus).where(
            ComplianceReportStatus.status == status_name
        )
        
        result = await db_session.execute(query)
        status = result.scalar_one_or_none()
        
        return status
        
    except Exception as e:
        logger.error(f"Error retrieving compliance report status '{status_name}': {e}")
        return None


async def create_auto_submit_history_record(db_session: AsyncSession, report):
    """
    Create a history record for the auto-submission action.
    
    Args:
        db_session: Database session
        report: ComplianceReport that was auto-submitted
    """
    try:
        from lcfs.db.models.compliance.ComplianceReportHistory import ComplianceReportHistory
        
        # Create history record indicating this was an automatic submission
        history_record = ComplianceReportHistory(
            compliance_report_id=report.compliance_report_id,
            compliance_report_status_id=report.current_status.compliance_report_status_id,
            user_profile_id=None,  # No user - this was automatic
            create_user="system-auto-submit",
            update_user="system-auto-submit", 
        )
        
        db_session.add(history_record)
        logger.debug(f"Created auto-submit history record for report {report.compliance_report_id}")
        
    except Exception as e:
        logger.error(f"Failed to create history record for report {report.compliance_report_id}: {e}")
        # Don't fail the whole operation for history record issues
        pass


async def check_overdue_reports_summary(db_session: AsyncSession):
    """
    Task to generate a summary report of overdue compliance reports without updating them.
    Useful for monitoring and reporting purposes.
    
    Args:
        db_session: Database session provided by the scheduler
        
    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Starting overdue compliance reports summary task")
    
    try:
        from sqlalchemy import text
        
        # Calculate various cutoff dates
        cutoff_30_days = datetime.now() - timedelta(days=30)
        cutoff_60_days = datetime.now() - timedelta(days=60)
        cutoff_90_days = datetime.now() - timedelta(days=90)
        
        # Get summary statistics using raw SQL for better performance
        summary_query = text("""
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
        """)
        
        result = await db_session.execute(summary_query, {
            'cutoff_30': cutoff_30_days,
            'cutoff_60': cutoff_60_days, 
            'cutoff_90': cutoff_90_days
        })
        
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
    Simple test task for compliance report module.
    
    Args:
        db_session: Database session provided by the scheduler
        
    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Running test compliance report task")
    
    try:
        from sqlalchemy import text
        
        # Test database connectivity
        result = await db_session.execute(text("SELECT 1"))
        if result.scalar() == 1:
            logger.info("Database connection test passed")
        else:
            logger.error("Database connection test failed")
            return False
            
        # Test basic compliance report table access
        result = await db_session.execute(
            text("SELECT COUNT(*) FROM compliance_report LIMIT 1")
        )
        count = result.scalar()
        logger.info(f"Compliance reports table accessible, found {count} total reports")
        
        return True
        
    except Exception as e:
        logger.error(f"Test compliance report task failed: {e}")
        return False
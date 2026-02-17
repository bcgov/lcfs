import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from lcfs.services.redis.dependency import get_redis_client
from lcfs.services.tfrs.redis_balance import RedisBalanceService
from sqlalchemy import text
from fastapi import FastAPI

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportUpdateSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_repo import (
    ComplianceReportSummaryRepository,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
    ComplianceDataService,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.internal_comment.services import InternalCommentService
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.api.email.repo import CHESEmailRepository
from lcfs.web.api.notification.repo import NotificationRepository
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.api.user.repo import UserRepository
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.final_supply_equipment.services import FinalSupplyEquipmentServices

logger = logging.getLogger(__name__)


async def submit_supplemental_report(report_id: int, app: FastAPI):
    """
    Submits a supplemental report by updating its status to 'Submitted'.
    """
    logger.info(f"Submitting supplemental report with ID: {report_id}")
    session_factory = app.state.db_session_factory
    async with session_factory() as session:
        try:
            # Instantiate repositories
            compliance_report_repo = ComplianceReportRepository(session)
            summary_repo = ComplianceReportSummaryRepository(session)
            org_repo = OrganizationsRepository(session)
            transaction_repo = TransactionRepository(session)
            user_repo = UserRepository(session)

            # Instantiate services
            document_service = DocumentService()
            snapshot_service = OrganizationSnapshotService(session)
            final_supply_equipment_service = FinalSupplyEquipmentServices(session)
            internal_comment_service = InternalCommentService(session)

            compliance_report_services = ComplianceReportServices(
                request=None,
                repo=compliance_report_repo,
                org_repo=org_repo,
                snapshot_services=snapshot_service,
                final_supply_equipment_service=final_supply_equipment_service,
                document_service=document_service,
                transaction_repo=transaction_repo,
                internal_comment_service=internal_comment_service,
            )

            notional_transfer_repo = NotionalTransferRepository(session)
            fuel_code_repo = FuelCodeRepository(session)
            notional_transfer_service = NotionalTransferServices(
                repo=notional_transfer_repo,
                fuel_repo=fuel_code_repo,
                compliance_report_repo=compliance_report_repo,
            )
            summary_service = ComplianceReportSummaryService(
                repo=summary_repo,
                cr_repo=compliance_report_repo,
                trxn_repo=transaction_repo,
                notional_transfer_service=notional_transfer_service,
                fuel_supply_repo=FuelSupplyRepository(session),
                fuel_export_repo=FuelExportRepository(session),
                allocation_agreement_repo=AllocationAgreementRepository(
                    db=session, fuel_repo=fuel_code_repo
                ),
                other_uses_repo=OtherUsesRepository(session),
                compliance_data_service=ComplianceDataService(),
            )
            org_service = OrganizationsService(
                repo=org_repo,
                transaction_repo=transaction_repo,
                redis_balance_service=RedisBalanceService(
                    transaction_repo=transaction_repo,
                    redis_client=app.state.redis_client,
                ),
            )

            trx_service = TransactionsService(repo=transaction_repo)

            ches_email_repo = CHESEmailRepository(session)
            ches_email_service = CHESEmailService(ches_email_repo)
            notfn_repo = NotificationRepository(session)
            notfn_service = NotificationService(notfn_repo, ches_email_service)

            update_service = ComplianceReportUpdateService(
                repo=compliance_report_repo,
                summary_repo=summary_repo,
                summary_service=summary_service,
                org_service=org_service,
                trx_service=trx_service,
                notfn_service=notfn_service,
            )

            # Get system user
            system_user = await user_repo.get_user_by_username("system-auto-submit")
            if not system_user:
                logger.error("System user not found. Cannot submit report.")
                return

            # Create update schema
            update_schema = ComplianceReportUpdateSchema(
                status="Submitted",
                supplemental_note=f"Auto-submitted by system on {datetime.now().strftime('%Y-%m-%d')} due to 30+ day draft status",
            )

            # Update the report
            await update_service.update_compliance_report(
                report_id, update_schema, system_user
            )
            await session.commit()
            logger.info(
                f"Successfully submitted supplemental report with ID: {report_id}"
            )

        except Exception as e:
            logger.error(
                f"Failed to submit supplemental report with ID: {report_id}. Error: {e}",
                exc_info=True,
            )
            raise


async def check_overdue_supplemental_reports(app: FastAPI):
    """
    Checks for overdue supplemental reports and submits them.
    """
    logger.info("Starting check for overdue supplemental reports...")
    session_factory = app.state.db_session_factory
    async with session_factory() as session:
        try:
            now_pst = datetime.now(ZoneInfo("America/Vancouver"))
            cutoff_date = now_pst - timedelta(days=30)
            query = text(
                """
                SELECT 
                    cr.compliance_report_id,
                    cr.version,
                    cr.update_date,
                    cr.organization_id,
                    cr.organization_name
                FROM v_compliance_report cr
                WHERE cr.supplemental_initiator = 'SUPPLIER_SUPPLEMENTAL'::supplementalinitiatortype
                AND cr.report_status = 'Draft'
                AND cr.update_date <= :cutoff_date
                AND cr.compliance_period::int >= 2024
                ORDER BY cr.update_date
            """
            )

            result = await session.execute(query, {"cutoff_date": cutoff_date})
            overdue_reports = result.fetchall()

            logger.info(f"Found {len(overdue_reports)} overdue supplemental reports.")

            for report in overdue_reports:
                report_id = report.compliance_report_id
                try:
                    logger.info(f"Processing report ID: {report_id}")
                    await submit_supplemental_report(report_id, app)
                except Exception as e:
                    logger.error(
                        f"Failed to process report ID: {report_id}. Error: {e}",
                        exc_info=True,
                    )
                    continue

        except Exception as e:
            logger.error(
                f"An error occurred during the overdue report check: {e}", exc_info=True
            )
            raise

    logger.info("Finished check for overdue supplemental reports.")

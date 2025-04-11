import json
from typing import Tuple

from fastapi import Depends, HTTPException

from lcfs.db.models import UserProfile
from lcfs.db.models.compliance import ComplianceReportSummary
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    SupplementalInitiatorType,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    RETURN_STATUS_MAPPER,
    ComplianceReportUpdateSchema,
    ReturnStatus,
    ComplianceReportBaseSchema,
)
from lcfs.web.api.compliance_report.summary_repo import (
    ComplianceReportSummaryRepository,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.notification.schema import (
    COMPLIANCE_REPORT_STATUS_NOTIFICATION_MAPPER,
    NotificationMessageSchema,
    NotificationRequestSchema,
)
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException


class ComplianceReportUpdateService:
    def __init__(
        self,
        repo: ComplianceReportRepository = Depends(),
        summary_repo: ComplianceReportSummaryRepository = Depends(),
        summary_service: ComplianceReportSummaryService = Depends(),
        org_service: OrganizationsService = Depends(OrganizationsService),
        trx_service: TransactionsService = Depends(TransactionsService),
        trx_repo: TransactionRepository = Depends(TransactionRepository),
        notfn_service: NotificationService = Depends(NotificationService),
    ):
        self.summary_repo = summary_repo
        self.trx_repo = trx_repo
        self.repo = repo
        self.summary_service = summary_service
        self.org_service = org_service
        self.trx_service = trx_service
        self.notfn_service = notfn_service

    async def update_compliance_report(
        self,
        report_id: int,
        report_data: ComplianceReportUpdateSchema,
        user: UserProfile,
    ) -> ComplianceReportBaseSchema:
        """Updates an existing compliance report."""
        # Get and validate report
        report = await self._check_report_exists(report_id)

        # Store original status
        current_status = report_data.status

        # Handle status changes
        if report_data.status in [status.value for status in ReturnStatus]:
            new_status, status_has_changed = await self._handle_return_status(
                report_data
            )
            report_data.status = new_status

            # Handle "Return to supplier"
            if current_status == ReturnStatus.SUPPLIER.value:
                await self.summary_repo.reset_summary_lock(report.compliance_report_id)
                await self.trx_repo.delete_transaction(report.transaction_id, report_id)
        else:
            # Handle normal status change
            status_has_changed = report.current_status.status != getattr(
                ComplianceReportStatusEnum, report_data.status.replace(" ", "_")
            )

        # Get new status object
        new_status = await self.repo.get_compliance_report_status_by_desc(
            report_data.status
        )

        # Update report
        report.current_status = new_status
        report.supplemental_note = report_data.supplemental_note
        report.assessment_statement = report_data.assessment_statement
        updated_report = await self.repo.update_compliance_report(report)

        # Handle status change related actions
        if status_has_changed:
            await self.handle_status_change(report, new_status.status, user)
            # Add history record
            await self.repo.add_compliance_report_history(report, user)

        # Handle notifications
        await self._perform_notification_call(report, current_status, user)

        return updated_report

    async def _perform_notification_call(self, report, status, user: UserProfile):
        """Send notifications based on the current status of the transfer."""
        status_mapper = status.replace(" ", "_")
        notifications = COMPLIANCE_REPORT_STATUS_NOTIFICATION_MAPPER.get(
            (
                ComplianceReportStatusEnum[status_mapper]
                if status_mapper in ComplianceReportStatusEnum.__members__
                else status
            ),
            None,
        )
        message_data = {
            "service": "ComplianceReport",
            "id": report.compliance_report_id,
            "transactionId": report.transaction_id,
            "compliancePeriod": report.compliance_period.description,
            "status": status.lower(),
        }
        notification_data = NotificationMessageSchema(
            type=f"Compliance report {status.lower().replace('return', 'returned')}",
            related_transaction_id=f"CR{report.compliance_report_id}",
            message=json.dumps(message_data),
            related_organization_id=report.organization_id,
            origin_user_profile_id=user.user_profile_id,
        )
        if notifications and isinstance(notifications, list):
            await self.notfn_service.send_notification(
                NotificationRequestSchema(
                    notification_types=notifications,
                    notification_data=notification_data,
                )
            )

    async def handle_status_change(
        self,
        report: ComplianceReport,
        new_status: ComplianceReportStatusEnum,
        user: UserProfile,
    ):
        """Handle status-specific actions based on the new status."""
        status_handlers = {
            ComplianceReportStatusEnum.Draft: self.handle_draft_status,
            ComplianceReportStatusEnum.Submitted: self.handle_submitted_status,
            ComplianceReportStatusEnum.Analyst_adjustment: self.handle_analyst_adjustment_status,
            ComplianceReportStatusEnum.Recommended_by_analyst: self.handle_recommended_by_analyst_status,
            ComplianceReportStatusEnum.Recommended_by_manager: self.handle_recommended_by_manager_status,
            ComplianceReportStatusEnum.Assessed: self.handle_assessed_status,
        }

        handler = status_handlers.get(new_status)
        if handler:
            await handler(report, user)
        else:
            raise ServiceException(f"Unsupported status change to {new_status}")

    async def _check_report_exists(self, report_id: int) -> ComplianceReport:
        """Verify report exists and return it."""
        report = await self.repo.get_compliance_report_by_id(report_id, is_model=True)
        if not report:
            raise DataNotFoundException(
                f"Compliance report with ID {report_id} not found"
            )
        return report

    async def handle_draft_status(self, report: ComplianceReport, user: UserProfile):
        """Handle actions when a report is set to Draft status."""
        # Implement logic for Draft status
        has_supplier_role = user_has_roles(user, [RoleEnum.SUPPLIER])
        if not has_supplier_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

    async def _handle_return_status(
        self, report_data: ComplianceReportUpdateSchema
    ) -> Tuple[str, bool]:
        """Handle return status logic and return new status and change flag."""
        mapped_status = RETURN_STATUS_MAPPER.get(report_data.status)

        return mapped_status, False

    async def handle_submitted_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is submitted."""
        has_supplier_roles = user_has_roles(
            user, [RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY]
        )
        if not has_supplier_roles:
            raise HTTPException(status_code=403, detail="Forbidden.")
        calculated_summary = await self._calculate_and_lock_summary(report, user)
        credit_change = report.summary.line_20_surplus_deficit_units
        await self._create_or_update_reserve_transaction(credit_change, report)
        await self.repo.update_compliance_report(report)

        return calculated_summary

    async def handle_analyst_adjustment_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is Recommended by analyst."""
        # Implement logic for Recommended by analyst status
        has_analyst_role = user_has_roles(user, [RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
        if not has_analyst_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

    async def handle_recommended_by_analyst_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is Recommended by analyst."""
        # Implement logic for Recommended by analyst status
        has_analyst_role = user_has_roles(user, [RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
        if not has_analyst_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        # If its a government adjustment, create a transaction and lock the summary
        if (
            report.supplemental_initiator
            and report.supplemental_initiator
            == SupplementalInitiatorType.GOVERNMENT_REASSESSMENT
        ):
            summary = await self._calculate_and_lock_summary(report, user)
            credit_change = summary.line_20_surplus_deficit_units
            await self._create_or_update_reserve_transaction(credit_change, report)

    async def handle_recommended_by_manager_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is Recommended by manager."""
        # Implement logic for Recommended by manager status
        has_compliance_manager_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.COMPLIANCE_MANAGER]
        )
        if not has_compliance_manager_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

    async def handle_assessed_status(self, report: ComplianceReport, user: UserProfile):
        """Handle actions when a report is Assessed."""
        has_director_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
        )
        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        if report.transaction:
            # Update the transaction to assessed
            report.transaction.transaction_action = TransactionActionEnum.Adjustment
            report.transaction.update_user = user.keycloak_username
        await self.repo.update_compliance_report(report)

    async def _create_or_update_reserve_transaction(self, credit_change, report):
        if report.transaction is not None:
            report.transaction.compliance_units = credit_change
        elif credit_change != 0:
            available_balance = await self.org_service.calculate_available_balance(
                report.organization_id
            )
            # Only need a Transaction if they have credits
            if available_balance > 0:
                units_to_reserve = credit_change

                # If not enough credits, reserve what is left
                if credit_change < 0 and abs(credit_change) > available_balance:
                    units_to_reserve = available_balance * -1

                report.transaction = await self.org_service.adjust_balance(
                    transaction_action=TransactionActionEnum.Reserved,
                    compliance_units=units_to_reserve,
                    organization_id=report.organization_id,
                )

    async def _calculate_and_lock_summary(
        self, report, user
    ) -> ComplianceReportSummary:
        # Fetch the existing summary from the database, if any
        existing_summary = await self.summary_repo.get_summary_by_report_id(
            report.compliance_report_id
        )
        # Calculate a new summary based on the current report data
        calculated_summary = (
            await self.summary_service.calculate_compliance_report_summary(
                report.compliance_report_id
            )
        )
        if not calculated_summary.can_sign:
            raise ServiceException("ComplianceReportSummary is not able to be signed")

        # If there's an existing summary, preserve user-edited values
        if existing_summary:
            for row in calculated_summary.renewable_fuel_target_summary:
                if row.line == 6:
                    # Preserve line 6 values (renewable fuel retained)
                    row.gasoline = (
                        existing_summary.line_6_renewable_fuel_retained_gasoline
                        or row.gasoline
                    )
                    row.diesel = (
                        existing_summary.line_6_renewable_fuel_retained_diesel
                        or row.diesel
                    )
                    row.jet_fuel = (
                        existing_summary.line_6_renewable_fuel_retained_jet_fuel
                        or row.jet_fuel
                    )
                elif row.line == 7:
                    # Preserve line 7 values (previously retained)
                    row.gasoline = (
                        existing_summary.line_7_previously_retained_gasoline
                        or row.gasoline
                    )
                    row.diesel = (
                        existing_summary.line_7_previously_retained_diesel or row.diesel
                    )
                    row.jet_fuel = (
                        existing_summary.line_7_previously_retained_jet_fuel
                        or row.jet_fuel
                    )
                elif row.line == 8:
                    # Preserve line 8 values (obligation deferred)
                    row.gasoline = (
                        existing_summary.line_8_obligation_deferred_gasoline
                        or row.gasoline
                    )
                    row.diesel = (
                        existing_summary.line_8_obligation_deferred_diesel or row.diesel
                    )
                    row.jet_fuel = (
                        existing_summary.line_8_obligation_deferred_jet_fuel
                        or row.jet_fuel
                    )
        # Lock the summary to prevent further edits
        calculated_summary.is_locked = True
        # Save the summary
        if report.summary:
            new_summary = await self.summary_repo.save_compliance_report_summary(
                calculated_summary
            )
            report.summary = new_summary
        else:
            # Create new summary if it doesn't exist
            new_summary = await self.summary_repo.add_compliance_report_summary(
                calculated_summary
            )
            report.summary = new_summary
        return report.summary

        credit_change = report.summary.line_20_surplus_deficit_units
        if credit_change != 0:
            if report.transaction is not None:
                # Update existing transaction
                report.transaction.compliance_units = credit_change
            else:
                available_balance = await self.org_service.calculate_available_balance(
                    report.organization_id
                )
                # Only need a Transaction if they have credits
                if available_balance > 0:
                    units_to_reserve = credit_change

                    # If not enough credits, reserve what is left
                    if credit_change < 0 and abs(credit_change) > available_balance:
                        units_to_reserve = available_balance * -1

                    report.transaction = await self.org_service.adjust_balance(
                        transaction_action=TransactionActionEnum.Reserved,
                        compliance_units=units_to_reserve,
                        organization_id=report.organization_id,
                    )

        await self.repo.update_compliance_report(report)

        return calculated_summary

    async def handle_recommended_by_analyst_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is Recommended by analyst."""
        # Implement logic for Recommended by analyst status
        has_analyst_role = user_has_roles(user, [RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
        if not has_analyst_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

    async def handle_recommended_by_manager_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is Recommended by manager."""
        # Implement logic for Recommended by manager status
        has_compliance_manager_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.COMPLIANCE_MANAGER]
        )
        if not has_compliance_manager_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

    async def handle_assessed_status(self, report: ComplianceReport, user: UserProfile):
        """Handle actions when a report is Assessed."""
        has_director_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
        )
        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        if report.transaction:
            # Update the transaction to assessed
            report.transaction.transaction_action = TransactionActionEnum.Adjustment
            report.transaction.update_user = user.keycloak_username
        await self.repo.update_compliance_report(report)

    async def handle_reassessed_status(self, report: ComplianceReport):
        """Handle actions when a report is Reassessed."""
        # Implement logic for Reassessed status
        pass

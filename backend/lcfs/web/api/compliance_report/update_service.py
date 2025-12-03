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
from lcfs.web.api.transaction.services import TransactionsService
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

# Import TYPE_CHECKING to avoid circular imports at runtime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from lcfs.web.api.charging_equipment.repo import ChargingEquipmentRepository


class ComplianceReportUpdateService:
    def __init__(
        self,
        repo: ComplianceReportRepository = Depends(),
        summary_repo: ComplianceReportSummaryRepository = Depends(),
        summary_service: ComplianceReportSummaryService = Depends(),
        org_service: OrganizationsService = Depends(OrganizationsService),
        trx_service: TransactionsService = Depends(TransactionsService),
        notfn_service: NotificationService = Depends(NotificationService),
    ):
        self.summary_repo = summary_repo
        self.repo = repo
        self.summary_service = summary_service
        self.org_service = org_service
        self.trx_service = trx_service
        self.notfn_service = notfn_service
        self._charging_equipment_repo = None

    @property
    def charging_equipment_repo(self) -> "ChargingEquipmentRepository":
        """Lazy-load charging equipment repository to avoid circular imports."""
        if self._charging_equipment_repo is None:
            from lcfs.web.api.charging_equipment.repo import (
                ChargingEquipmentRepository,
            )

            self._charging_equipment_repo = ChargingEquipmentRepository(db=self.repo.db)
        return self._charging_equipment_repo

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
                report_data, report
            )
            report_data.status = new_status

            # Handle "Return to supplier" - unlock summary to allow refresh again
            if current_status == ReturnStatus.SUPPLIER.value:
                await self.summary_repo.reset_summary_lock(report.compliance_report_id)
                await self.trx_service.repo.delete_transaction(
                    report.transaction_id, report_id
                )
            # Handle "Return to analyst" - unlock summary to allow refresh again
            elif current_status == ReturnStatus.ANALYST.value:
                await self.summary_repo.reset_summary_lock(report.compliance_report_id)
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

        # Handle non-assessment flag changes
        if report_data.is_non_assessment is not None:
            old_is_non_assessment = report.is_non_assessment
            report.is_non_assessment = report_data.is_non_assessment

            # If changing TO non-assessment, lock summary
            if not old_is_non_assessment and report_data.is_non_assessment:
                # Lock the summary since this report won't go through normal assessment workflow
                await self._calculate_and_lock_summary(
                    report, user, skip_can_sign_check=True
                )

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
        report = await self.repo.get_compliance_report_by_id(report_id)
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
        self, report_data: ComplianceReportUpdateSchema, report: ComplianceReport
    ) -> Tuple[str, bool]:
        """Handle return status logic and return new status and change flag."""
        # Check if this is a government adjustment being returned to analyst
        if (
            report_data.status == ReturnStatus.ANALYST.value
            and report.supplemental_initiator
            == SupplementalInitiatorType.GOVERNMENT_REASSESSMENT
        ):
            # Government adjustments should return to "Analyst adjustment" status, not "Submitted"
            return ComplianceReportStatusEnum.Analyst_adjustment.value, False

        # Default mapping for all other cases
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

        # Auto-submit all FSE records in Draft or Updated status to Submitted status
        await self.charging_equipment_repo.auto_submit_draft_updated_fse_for_report(
            report.compliance_report_id
        )

        # Simply ensure summary exists - it will continue to refresh dynamically
        # because we're NOT locking it (unlike the old behavior)
        if not report.summary:
            # Create summary if it doesn't exist
            calculated_summary = (
                await self.summary_service.calculate_compliance_report_summary(
                    report.compliance_report_id
                )
            )
            report.summary = calculated_summary

        # Always recalculate to get latest values for transaction
        await self.summary_service.calculate_compliance_report_summary(
            report.compliance_report_id
        )

        credit_change = report.summary.line_20_surplus_deficit_units
        reserve_units = await self._create_or_update_reserve_transaction(
            credit_change, report
        )
        await self.repo.update_compliance_report(report)

        return report.summary

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
        # Check if a newer draft exists, preventing further action on this report
        existing_draft = await self.repo.get_draft_report_by_group_uuid(
            report.compliance_report_group_uuid
        )
        if existing_draft and existing_draft.version > report.version:
            raise HTTPException(
                status_code=409,
                detail="This report has been superseded by a draft supplemental report and cannot be processed further.",
            )

        # Implement logic for Recommended by analyst status
        has_analyst_role = user_has_roles(user, [RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
        if not has_analyst_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        # Auto-validate all submitted FSE records associated with this report
        await self.charging_equipment_repo.auto_validate_submitted_fse_for_report(
            report.compliance_report_id
        )

        # Lock the summary when report is recommended by analyst - this is the snapshot point
        await self._calculate_and_lock_summary(report, user, skip_can_sign_check=True)
        await self.repo.update_compliance_report(report)

    async def handle_recommended_by_manager_status(
        self, report: ComplianceReport, user: UserProfile
    ):
        """Handle actions when a report is Recommended by manager."""
        # Check if a newer draft exists, preventing further action on this report
        existing_draft = await self.repo.get_draft_report_by_group_uuid(
            report.compliance_report_group_uuid
        )
        if existing_draft and existing_draft.version > report.version:
            raise HTTPException(
                status_code=409,
                detail="This report has been superseded by a draft supplemental report and cannot be processed further.",
            )

        # Implement logic for Recommended by manager status
        has_compliance_manager_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.COMPLIANCE_MANAGER]
        )
        if not has_compliance_manager_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        await self.repo.update_compliance_report(report)

    async def handle_assessed_status(self, report: ComplianceReport, user: UserProfile):
        """Handle actions when a report is Assessed."""
        # Check if a newer draft exists, preventing further action on this report
        existing_draft = await self.repo.get_draft_report_by_group_uuid(
            report.compliance_report_group_uuid
        )
        if existing_draft and existing_draft.version > report.version:
            raise HTTPException(
                status_code=409,
                detail="This report has been superseded by a draft supplemental report and cannot be assessed.",
            )

        has_director_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
        )
        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        # Handle transaction creation/update based on assessment type
        if not report.is_non_assessment:
            # For assessment reports: use already-locked summary to create/update transaction
            # Summary should already be locked from "Recommended by Analyst" step
            if not report.summary or not report.summary.is_locked:
                raise HTTPException(
                    status_code=400,
                    detail="Report summary must be locked before assessment. Please ensure the report was recommended by an analyst first.",
                )

            credit_change = report.summary.line_20_surplus_deficit_units

            if report.transaction:
                existing_units = report.transaction.compliance_units
                report.transaction.transaction_action = TransactionActionEnum.Adjustment
                report.transaction.update_user = user.keycloak_username
                report.transaction.compliance_units = existing_units
            else:
                capped_units = await self._create_or_update_reserve_transaction(
                    credit_change, report
                )

                if capped_units != 0:
                    # Ensure a transaction exists before converting to Adjustment
                    report.transaction = await self.org_service.adjust_balance(
                        transaction_action=TransactionActionEnum.Reserved,
                        compliance_units=capped_units,
                        organization_id=report.organization_id,
                    )
                    report.transaction.transaction_action = (
                        TransactionActionEnum.Adjustment
                    )
                    report.transaction.update_user = user.keycloak_username
        else:
            # For non-assessment reports: summary should already be locked when flag was set
            # Just ensure no transactions exist
            if report.transaction_id:
                await self.trx_service.repo.delete_transaction(
                    report.transaction_id, report.compliance_report_id
                )
                report.transaction_id = None

        await self.repo.update_compliance_report(report)

    async def _create_or_update_reserve_transaction(self, credit_change, report):
        available_balance = await self.org_service.calculate_available_balance(
            report.organization_id
        )
        pre_deadline_balance = None
        if credit_change < 0:
            pre_deadline_balance = await self._calculate_pre_deadline_balance(report)

        effective_available_balance = available_balance
        if pre_deadline_balance is not None:
            effective_available_balance = min(available_balance, pre_deadline_balance)

        units_to_reserve = credit_change
        if credit_change < 0:
            eligible_units = min(
                abs(credit_change),
                max(effective_available_balance, 0),
            )
            units_to_reserve = -eligible_units

        if report.transaction is not None:
            # update existing transaction
            report.transaction.compliance_units = units_to_reserve
        elif credit_change != 0 and (
            effective_available_balance > 0 or credit_change > 0
        ):
            # Only need a Transaction if they have credits or it's a gain
            report.transaction = await self.org_service.adjust_balance(
                transaction_action=TransactionActionEnum.Reserved,
                compliance_units=units_to_reserve,
                organization_id=report.organization_id,
            )

        return units_to_reserve

    async def _calculate_pre_deadline_balance(self, report: ComplianceReport) -> int:
        compliance_period = getattr(report, "compliance_period", None)
        period_description = getattr(compliance_period, "description", None)

        try:
            compliance_year = int(period_description)
        except (TypeError, ValueError):
            return await self.org_service.calculate_available_balance(
                report.organization_id
            )

        pre_deadline_balance = await self.org_service.calculate_available_balance_for_period(
            report.organization_id, compliance_year
        )
        return pre_deadline_balance

    async def _calculate_and_lock_summary(
        self, report, user, skip_can_sign_check=False
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
        # Skip can_sign check for assessment operations
        if not skip_can_sign_check and not calculated_summary.can_sign:
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

    async def handle_reassessed_status(self, report: ComplianceReport):
        """Handle actions when a report is Reassessed."""
        # Implement logic for Reassessed status
        pass

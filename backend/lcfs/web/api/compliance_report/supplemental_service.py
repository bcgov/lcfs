from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    SupplementalInitiatorType,
    ChangeType,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportBaseSchema
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException
from lcfs.web.core.decorators import service_handler
from fastapi import Depends, Request
from lcfs.db.models.user.UserProfile import UserProfile


class SupplementalReportService:
    def __init__(
        self,
        request: Request = None,
        repo: ComplianceReportRepository = Depends(),
        fuel_supply_repo: FuelSupplyRepository = Depends(),
    ):
        self.request = request
        self.repo = repo
        self.fuel_supply_repo = fuel_supply_repo

    @service_handler
    async def create_supplemental_report(
        self,
        original_report_id: int,
    ) -> ComplianceReportBaseSchema:
        """
        Creates a new supplemental compliance report.

        :param original_report_id: The ID of the original compliance report.
        :return: The newly created supplemental compliance report.
        """
        user: UserProfile = self.request.user

        # Fetch the original report
        original_report = await self.repo.get_compliance_report_by_id(
            original_report_id, is_model=True
        )
        if not original_report:
            raise DataNotFoundException("Original compliance report not found.")

        # Validate that the user is allowed to create a supplemental report
        if user.organization_id != original_report.organization_id:
            raise ServiceException(
                "You do not have permission to create a supplemental report for this organization."
            )

        # Get the last report in the chain
        last_report_in_chain = await self.repo.get_last_report_in_supplemental_chain(
            original_report_id
        )
        chain_index = (
            last_report_in_chain.chain_index + 1 if last_report_in_chain else 1
        )
        previous_report_id = (
            last_report_in_chain.compliance_report_id
            if last_report_in_chain
            else original_report_id
        )

        # Get the 'Draft' status ID
        draft_status = await self.repo.get_compliance_report_status_by_desc("Draft")
        if not draft_status:
            raise DataNotFoundException("Draft status not found.")

        # Create the new compliance report
        new_report = ComplianceReport(
            compliance_period_id=original_report.compliance_period_id,
            organization_id=original_report.organization_id,
            current_status_id=draft_status.compliance_report_status_id,
            reporting_frequency=original_report.reporting_frequency,
            # Supplemental fields
            original_report_id=original_report_id,
            previous_report_id=previous_report_id,
            chain_index=chain_index,
            supplemental_initiator=SupplementalInitiatorType.SUPPLIER_INITIATED_SUPPLEMENTAL,
            nickname=f"Supplemental Report {chain_index}",
        )

        # Add the new compliance report
        new_report = await self.repo.add_compliance_report(new_report)

        # Return the new report
        return ComplianceReportBaseSchema.model_validate(new_report)

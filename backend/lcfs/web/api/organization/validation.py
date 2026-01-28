import datetime
from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.compliance_report.schema import ComplianceReportCreateSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.report_opening.repo import ReportOpeningRepository
from lcfs.utils.constants import LCFS_Constants


class OrganizationValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
        report_opening_repo: ReportOpeningRepository = Depends(ReportOpeningRepository),
    ):
        self.org_repo = org_repo
        self.request = request
        self.transaction_repo = transaction_repo
        self.report_repo = report_repo
        self.report_opening_repo = report_opening_repo

    def _extract_compliance_year(self, description: str) -> int | None:
        if not description:
            return None

        try:
            return int(description)
        except (TypeError, ValueError):
            digits = "".join(filter(str.isdigit, str(description)))
            return int(digits) if digits else None

    async def check_available_balance(self, organization_id, quantity):
        available_balance = await self.transaction_repo.calculate_available_balance(
            organization_id
        )
        if available_balance < quantity:
            return {
                "adjusted": True,
                "available_balance": available_balance,
                "original_quantity": quantity,
                "adjusted_quantity": available_balance,
            }

        return {
            "adjusted": False,
            "available_balance": available_balance,
            "original_quantity": quantity,
            "adjusted_quantity": quantity,
        }

    async def create_transfer(
        self, organization_id, transfer_create: TransferCreateSchema
    ):
        balance_check = await self.check_available_balance(
            organization_id, transfer_create.quantity
        )

        if balance_check["adjusted"]:
            # Adjust quantity to available balance
            transfer_create.quantity = balance_check["adjusted_quantity"]

        is_to_org_registered = await self.org_repo.is_registered_for_transfer(
            transfer_create.to_organization_id
        )
        if (
            (
                transfer_create.from_organization_id != organization_id
                and transfer_create.current_status
                not in LCFS_Constants.FROM_ORG_TRANSFER_STATUSES  # ensure the allowed statuses for creating transfer
            )
            or self.request.user.organization.org_status.organization_status_id != 2
            or not is_to_org_registered
        ):  # ensure the organizations are registered for transfer
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validation for authorization failed.",
            )
        return

    async def update_transfer(
        self, organization_id, transfer_create: TransferCreateSchema
    ):
        # Before updating, check for available balance
        valid_status = (
            transfer_create.current_status in LCFS_Constants.FROM_ORG_TRANSFER_STATUSES
        )

        await self.check_available_balance(
            transfer_create.from_organization_id, transfer_create.quantity
        )
        if (
            transfer_create.from_organization_id == organization_id and valid_status
        ) or (  # status changes allowed for from-organization
            transfer_create.to_organization_id == organization_id
            and transfer_create.current_status
            in LCFS_Constants.TO_ORG_TRANSFER_STATUSES
        ):  # status changes allowed for to-organization
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Validation for authorization failed.",
        )

    async def create_compliance_report(
        self, organization_id, report_data: ComplianceReportCreateSchema
    ):
        if self.request.user.organization.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validation for authorization failed.",
            )
        # Before creating ensure that there isn't any existing report for the given compliance period.
        period = await self.report_repo.get_compliance_period(
            report_data.compliance_period
        )
        if not period:
            raise HTTPException(status_code=404, detail="Compliance period not found")

        compliance_year = self._extract_compliance_year(period.description)
        if compliance_year is not None:
            year_config = await self.report_opening_repo.ensure_year(compliance_year)
            # Check for early issuance eligibility if the reporting window is not open
            if (
                compliance_year == datetime.datetime.now().year
                and not year_config.compliance_reporting_enabled
                and year_config.early_issuance_enabled
            ):
                early_issuance = await self.org_repo.get_early_issuance_by_year(
                    organization_id, str(compliance_year)
                )
                if not early_issuance or not early_issuance.has_early_issuance:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"{compliance_year} reporting is only available to early issuance suppliers.",
                    )
                return
            if not year_config.compliance_reporting_enabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"{compliance_year} reporting is not currently available.",
                )

        is_report_present = await self.report_repo.get_compliance_report_by_period(
            organization_id, report_data.compliance_period
        )
        if is_report_present:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate report for the compliance period",
            )
        return

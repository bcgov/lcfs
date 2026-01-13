from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.compliance_report.schema import ComplianceReportCreateSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.utils.constants import LCFS_Constants
from lcfs.settings import settings


class OrganizationValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.org_repo = org_repo
        self.request = request
        self.transaction_repo = transaction_repo
        self.report_repo = report_repo

    async def check_available_balance(self, organization_id, quantity):
        available_balance = await self.transaction_repo.calculate_available_balance(
            organization_id
        )
        if available_balance < quantity:
            return {
                "adjusted": True,
                "available_balance": available_balance,
                "original_quantity": quantity,
                "adjusted_quantity": available_balance
            }

        return {
            "adjusted": False,
            "available_balance": available_balance,
            "original_quantity": quantity,
            "adjusted_quantity": quantity
        }

    async def create_transfer(
        self, organization_id, transfer_create: TransferCreateSchema
    ):
        balance_check = await self.check_available_balance(
        organization_id,
        transfer_create.quantity
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

        # Feature flag check for 2025 reporting period.
        # This flag gates access to 2025 compliance reports until regulatory requirements are finalized.
        # Configure via environment variable: LCFS_FEATURE_REPORTING_2025_ENABLED=true
        # Frontend also has a corresponding flag: reporting2025Enabled in config.js
        if period.description == "2025" and not settings.feature_reporting_2025_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="2025 reporting is not yet available.",
            )

        # 2026 reporting availability is tied to the 2025 feature flag.
        # When 2025 reporting is disabled, 2026 is also disabled UNLESS the organization
        # has early issuance enabled for 2026 (set via OrganizationEarlyIssuanceByYear table).
        if period.description == "2026" and not settings.feature_reporting_2025_enabled:
            early_issuance = await self.org_repo.get_early_issuance_by_year(
                organization_id, "2026"
            )
            if not early_issuance or not early_issuance.has_early_issuance:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="2026 reporting is not yet available.",
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

    # async def save_final_supply_equipment_rows(
    #     self, organization_id, report_id, fse_list
    # ):
    #     report = await self.report_repo.get_compliance_report_by_id(report_id)
    #     if not report:
    #         raise HTTPException(status_code=404, detail="Report not found")
    #     # TODO: validate each row data
    #     return

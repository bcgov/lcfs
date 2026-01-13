from fastapi import Depends, HTTPException, Request

from lcfs.db.models import ComplianceReport
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.organizations.repo import OrganizationsRepository
from fastapi import status
from lcfs.web.api.role.schema import user_has_roles
from lcfs.settings import settings


class ComplianceReportValidation:
    def __init__(
        self,
        request: Request = None,
        repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
    ) -> None:
        self.request = request
        self.repo = repo
        self.org_repo = org_repo

    async def validate_organization_access(self, compliance_report_id: int):
        compliance_report = await self.repo.get_compliance_report_schema_by_id(
            compliance_report_id
        )
        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found.",
            )

        organization_id = compliance_report.organization_id
        compliance_year = compliance_report.compliance_period.description

        # Feature flag check for 2025 reporting period.
        # This flag gates access to 2025 compliance reports until regulatory requirements are finalized.
        # Configure via environment variable: LCFS_FEATURE_REPORTING_2025_ENABLED=true
        # Frontend also has a corresponding flag: reporting2025Enabled in config.js
        if compliance_year == "2025" and not settings.feature_reporting_2025_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="2025 reporting is not yet available.",
            )

        # 2026 reporting availability is tied to the 2025 feature flag.
        # When 2025 reporting is disabled, 2026 is also disabled UNLESS the organization
        # has early issuance enabled for 2026 (set via OrganizationEarlyIssuanceByYear table).
        if compliance_year == "2026" and not settings.feature_reporting_2025_enabled:
            early_issuance = await self.org_repo.get_early_issuance_by_year(
                organization_id, "2026"
            )
            if not early_issuance or not early_issuance.has_early_issuance:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="2026 reporting is not yet available.",
                )

        user_organization_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )

        if (
            not user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
            and organization_id != user_organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this compliance report.",
            )

        return compliance_report

    async def validate_compliance_report_access(
        self, compliance_report: ComplianceReport
    ):
        """Validates government user access to draft reports"""
        is_supplier = user_has_roles(self.request.user, [RoleEnum.SUPPLIER])
        if (
            not is_supplier
            and compliance_report.current_status.status
            == ComplianceReportStatusEnum.Draft
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this compliance report.",
            )

        is_analyst_or_director = user_has_roles(
            self.request.user, [RoleEnum.ANALYST]
        ) or user_has_roles(self.request.user, [RoleEnum.DIRECTOR])
        if (
            not is_analyst_or_director
            and compliance_report.current_status.status
            == ComplianceReportStatusEnum.Analyst_adjustment
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this compliance report.",
            )

    async def validate_compliance_report_editable(
        self, compliance_report: ComplianceReport
    ):
        """Validates if compliance report can be edited based on its status"""
        editable_statuses = [
            ComplianceReportStatusEnum.Draft,
            ComplianceReportStatusEnum.Analyst_adjustment,
        ]

        # Get the current status - handle both enum and string values
        current_status = compliance_report.current_status.status
        if hasattr(current_status, "value"):
            # If it's an enum, get the string value
            current_status_value = current_status.value
        else:
            # If it's already a string
            current_status_value = current_status

        # Check if the status value matches any of the editable status values
        editable_status_values = [status.value for status in editable_statuses]

        if current_status_value not in editable_status_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Compliance report cannot be edited in {current_status_value} status. Editing is only allowed in Draft or Analyst adjustment status.",
            )

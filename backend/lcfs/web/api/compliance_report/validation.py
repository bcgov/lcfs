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
        """
        Validates that the user has access to the specified compliance report.

        TEMPORARY SOLUTION - Issue #3730
        This method includes temporary year-based access checks for 2025/2026.
        A more robust long-term solution should be implemented to support future years
        dynamically (e.g., database-driven configuration per compliance period).

        Compliance year access rules (also enforced in organization/validation.py):
        - 2025: Blocked when feature_reporting_2025_enabled is False
        - 2026: ALWAYS requires early issuance, regardless of 2025 flag status
        """
        compliance_report = await self.repo.get_compliance_report_schema_by_id(
            compliance_report_id
        )
        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found.",
            )

        organization_id = compliance_report.organization_id
        user_organization_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )

        is_government = user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])

        if not is_government and organization_id != user_organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this compliance report.",
            )

        # For non-government users, validate access to 2025/2026 compliance periods
        # Government users can always access all reports for oversight
        if not is_government and user_organization_id:
            compliance_period = compliance_report.compliance_period
            period_desc = (
                compliance_period.description
                if hasattr(compliance_period, "description")
                else str(compliance_period)
            )

            # 2025: Blocked when feature_reporting_2025_enabled is False
            if period_desc == "2025" and not settings.feature_reporting_2025_enabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="2025 reporting is not yet available.",
                )

            # 2026: ALWAYS requires early issuance, regardless of 2025 flag status
            if period_desc == "2026":
                early_issuance = await self.org_repo.get_early_issuance_by_year(
                    user_organization_id, "2026"
                )
                if not early_issuance or not early_issuance.has_early_issuance:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="2026 reporting is only available to early issuance suppliers.",
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

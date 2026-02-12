from fastapi import Depends, HTTPException, Request

from lcfs.db.models import ComplianceReport
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.organizations.repo import OrganizationsRepository
from fastapi import status
from lcfs.web.api.role.schema import user_has_roles


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

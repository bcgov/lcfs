from fastapi import Depends, HTTPException, Request
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from fastapi import status
from lcfs.web.api.role.schema import user_has_roles


class ComplianceReportValidation:
    def __init__(
        self,
        request: Request = None,
        repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ) -> None:
        self.request = request
        self.repo = repo

    async def validate_organization_access(self, compliance_report_id: int):
        compliance_report = await self.repo.check_compliance_report(
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

        if (
            not user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
            and organization_id != user_organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this compliance report.",
            )

        return compliance_report

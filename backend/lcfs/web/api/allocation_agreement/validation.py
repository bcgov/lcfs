from typing import List
from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementCreateSchema,
)


class AllocationAgreementValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.org_repo = org_repo
        self.request = request
        self.report_repo = report_repo

    async def validate_organization_access(self, compliance_report_id: int):
        compliance_report = await self.report_repo.get_compliance_report(
            compliance_report_id
        )
        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found.",
            )

        organization_id = compliance_report.organization_id
        user_organization_id = self.request.user.organization.organization_id

        if organization_id != user_organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this compliance report.",
            )

    async def validate_compliance_report_id(
        self,
        compliance_report_id: int,
        allocation_agreements: List[AllocationAgreementCreateSchema],
    ):
        for allocation_agreement in allocation_agreements:
            if allocation_agreement.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mismatch compliance_report_id in allocation agreement: {allocation_agreement}",
                )

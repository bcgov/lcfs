from typing import List
from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
)


class NotionalTransferValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        report_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
    ):
        self.org_repo = org_repo
        self.request = request
        self.report_repo = report_repo

    async def validate_compliance_report_id(
        self,
        compliance_report_id: int,
        notional_transfers: List[NotionalTransferCreateSchema],
    ):
        for notional_transfer in notional_transfers:
            if notional_transfer.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mismatch compliance_report_id in notional transfer: {notional_transfer}",
                )

from typing import List
from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
)


class OtherUsesValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
    ):
        self.org_repo = org_repo
        self.request = request

    async def validate_compliance_report_id(
        self, compliance_report_id: int, other_uses: List[OtherUsesCreateSchema]
    ):
        for other_use in other_uses:
            if other_use.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mismatch compliance_report_id in other use: {other_use}",
                )

from typing import List
from fastapi import Depends, HTTPException, Request
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from starlette import status

from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
)


class OtherUsesValidation:
    def __init__(
        self,
        request: Request = None,
        repo: OtherUsesRepository = Depends(OtherUsesRepository),
    ):
        self.request = request
        self.repo = repo

    async def validate_compliance_report_id(
        self, compliance_report_id: int, other_uses: List[OtherUsesCreateSchema]
    ):
        for other_use in other_uses:
            if other_use.compliance_report_id != compliance_report_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mismatch compliance_report_id in other use: {other_use}",
                )

    async def validate_duplicate(self, other_use: OtherUsesCreateSchema):
        # This method should call the repository to check for duplicates
        return await self.repo.check_duplicate(other_use)

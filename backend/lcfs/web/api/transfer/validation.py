from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.db.models.TransferStatus import TransferStatusEnum

from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.organizations.repo import OrganizationsRepository

from lcfs.utils.constants import LCFS_Constants


class TransferValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
    ) -> None:
        self.org_repo = org_repo
        self.request = request

    async def government_update_transfer(self, request: Request, transfer_create: TransferCreateSchema):
        # Ensure only the valid statuses are passed.
        if transfer_create.current_status not in LCFS_Constants.GOV_TRANSFER_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Validation for authorization failed.",
            )
        # Before recording the transfer ensure both the organizations are still registered for transfer.
        if TransferStatusEnum.Recorded.value == transfer_create.current_status:
            is_to_org_registered = await self.org_repo.is_registered_for_transfer(
                transfer_create.to_organization_id
            )
            is_from_org_registered = await self.org_repo.is_registered_for_transfer(
                transfer_create.from_organization_id
            )
            if not is_to_org_registered or not is_from_org_registered:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Validation for authorization failed.",
                )
            # TODO: Ensure the logged in user has the necessary permissions and roles.


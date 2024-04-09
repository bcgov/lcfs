from fastapi import Depends, HTTPException, Request
from starlette import status

from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.utils.constants import LCFS_Constants


class OrganizationValidation:
    def __init__(
        self,
        request: Request = None,
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
    ):
        self.org_repo = org_repo
        self.request = request
        self.transaction_repo = transaction_repo

    async def check_available_balance(self, organization_id, quantity):
        available_balance = await self.transaction_repo.calculate_available_balance(organization_id)
        if available_balance < quantity:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Organization does not have enough compliance units to create this transfer.",
            )

    async def create_transfer(
        self, organization_id, transfer_create: TransferCreateSchema
    ):
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
        # Before creation, check for available balance
        await self.check_available_balance(organization_id, transfer_create.quantity)
        return

    async def update_transfer(self, organization_id, transfer_create: TransferCreateSchema):
        # Before updating, check for available balance
        await self.check_available_balance(organization_id, transfer_create.quantity)
        if (
            transfer_create.from_organization_id == organization_id
            and transfer_create.current_status
            in LCFS_Constants.FROM_ORG_TRANSFER_STATUSES
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

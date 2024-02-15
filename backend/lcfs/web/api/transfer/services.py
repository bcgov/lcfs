from logging import getLogger
from typing import List

from fastapi import Depends, Request
from datetime import datetime

from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.Comment import Comment
from lcfs.web.api.organization.repo import OrganizationRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transfer.schema import TransferSchema, TransferCreate, TransferUpdate

logger = getLogger("transfer_service")

class TransferServices:
    def __init__(
        self,
        request: Request = None,
        repo: TransferRepository = Depends(TransferRepository),
        org_repo: OrganizationRepository = Depends(OrganizationRepository)
    ) -> None:
        self.repo = repo
        self.request = request
        self.org_repo = org_repo

    @service_handler
    async def get_all_transfers(self) -> List[TransferSchema]:
        """Fetches all transfer records and converts them to Pydantic models."""
        transfers = await self.repo.get_all_transfers()
        return [TransferSchema.model_validate(transfer) for transfer in transfers]

    @service_handler
    async def get_transfers_paginated(self, page: int, size: int) -> List[TransferSchema]:
        transfers = await self.repo.get_transfers_paginated(page, size)
        return [TransferSchema.model_validate(transfer) for transfer in transfers]

    @service_handler
    async def get_transfer(self, transfer_id: int) -> TransferSchema:
        '''Fetches a single transfer by its ID and converts it to a Pydantic model.'''
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer:
            raise DataNotFoundException(f"Transfer with ID {transfer_id} not found")

        return TransferSchema.model_validate(transfer)

    @service_handler
    async def create_transfer(self, transfer_data: TransferCreate) -> TransferSchema:
        """
          Handles creating a transfer, including creating a comment and any necessary
          preprocessing. This method fetches organization instances and creates a new
          transfer record along with a comment (if provided). If any part of the process
          fails due to missing data or database issues, appropriate exceptions are raised
          and handled by the @service_handler decorator.
        """
        # Fetch organization instances
        from_org = await self.org_repo.get_organization_lite(transfer_data.from_organization_id)
        to_org = await self.org_repo.get_organization_lite(transfer_data.to_organization_id)

        if not from_org or not to_org:
            raise DataNotFoundException("One or more organizations not found")

        # Create a new Comment instance
        new_comment = Comment(comment=transfer_data.comments) if transfer_data.comments else None

        status = await self.repo.get_transfer_status(transfer_status_id=1)
        category = await self.repo.get_transfer_category(transfer_category_id=1)

        transfer_model = Transfer(
            from_organization=from_org,
            to_organization=to_org,
            agreement_date=datetime.strptime(transfer_data.agreement_date, "%Y-%m-%d").date(),
            quantity=transfer_data.quantity,
            price_per_unit=transfer_data.price_per_unit,
            signing_authority_declaration=transfer_data.signing_authority_declaration,
            comments=new_comment,  # Associate the comment with the transfer
            transfer_status=status,
            transfer_category=category
        )

        # Persist the transfer model and its comment in the database
        created_transfer = await self.repo.create_transfer(transfer_model)

        # Convert the ORM model to a Pydantic model for the response
        return TransferSchema.model_validate(created_transfer)

    @service_handler
    async def update_transfer(self, transfer_data: TransferUpdate) -> TransferSchema:
        '''Updates an existing transfer record with new data.'''
        transfer = await self.repo.get_transfer_by_id(transfer_data.transfer_id)
        if not transfer:
            raise DataNotFoundException(f"Transfer with ID {transfer_data.transfer_id} not found")

        transfer.agreement_date = datetime.strptime(transfer_data.agreement_date, "%Y-%m-%d").date()
        transfer.quantity = transfer_data.quantity
        transfer.price_per_unit = transfer_data.price_per_unit
        transfer.signing_authority_declaration = transfer_data.signing_authority_declaration
        transfer.to_organization_id = transfer_data.to_organization_id

        if transfer_data.comments:
            if transfer.comments:
                transfer.comments.comment = transfer_data.comments
            else:
                transfer.comments = Comment(comment=transfer_data.comments)

        updated_transfer = await self.repo.update_transfer(transfer)
        return TransferSchema.model_validate(updated_transfer)
from logging import getLogger
from typing import List
from fastapi import Depends, Request, HTTPException

from lcfs.web.api.transfer.validation import TransferValidation
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

# models
from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.Comment import Comment
from lcfs.db.models.Transaction import TransactionActionEnum

# services
from lcfs.web.api.organizations.services import OrganizationsService

# schema
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.api.transfer.schema import (
    TransferCommentSchema,
    TransferSchema,
    TransferCreateSchema,
    TransferStatusEnum,
)

# repo
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transaction.repo import TransactionRepository

logger = getLogger("transfer_service")


class TransferServices:
    def __init__(
        self,
        request: Request = None,
        validate: TransferValidation = Depends(TransferValidation),
        repo: TransferRepository = Depends(TransferRepository),
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
    ) -> None:
        self.validate = validate
        self.repo = repo
        self.request = request
        self.org_repo = org_repo
        self.org_service = org_service
        self.transaction_repo = transaction_repo

    @service_handler
    async def get_all_transfers(self) -> List[TransferSchema]:
        """Fetches all transfer records and converts them to Pydantic models."""
        transfers = await self.repo.get_all_transfers()
        return [TransferSchema.model_validate(transfer) for transfer in transfers]

    @service_handler
    async def get_transfers_paginated(
        self, page: int, size: int
    ) -> List[TransferSchema]:
        transfers = await self.repo.get_transfers_paginated(page, size)
        return [TransferSchema.model_validate(transfer) for transfer in transfers]

    @service_handler
    async def get_transfer(self, transfer_id: int) -> TransferSchema:
        """Fetches a single transfer by its ID and converts it to a Pydantic model."""
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer:
            raise DataNotFoundException(f"Transfer with ID {transfer_id} not found")

        transfer_view = TransferSchema.model_validate(transfer)
        comments: List[TransferCreateSchema] = []
        if (transfer.from_org_comment != None and transfer.from_org_comment != ''):
            comments.append(
                TransferCommentSchema(
                    name=transfer.from_organization.name,
                    comment=transfer.from_org_comment,
                )
            )
        if (transfer.to_org_comment != None and transfer.to_org_comment != ''):
            comments.append(
                TransferCommentSchema(
                    name=transfer.to_organization.name,
                    comment=transfer.to_org_comment,
                )
            )
        if (transfer.current_status.status in [TransferStatusEnum.Recorded.value, TransferStatusEnum.Refused.value]):
            comments.append(
                TransferCommentSchema(
                    name="Government of British Columbia",
                    comment=transfer.gov_comment,
                )
            )
        transfer_view.comments = comments
        # Hide Recommended status to organizations
        if (transfer_view.current_status.status == TransferStatusEnum.Recommended.value and self.request.user.organization is not None):
            transfer_view.current_status = await self.repo.get_transfer_status_by_name(TransferStatusEnum.Submitted.value)
            transfer_view.transfer_history = list(filter(lambda history: history.transfer_status.status != TransferStatusEnum.Recommended.value, transfer_view.transfer_history))
        return transfer_view

    @service_handler
    async def create_transfer(
        self, transfer_data: TransferCreateSchema
    ) -> TransferSchema:
        """
        Handles creating a transfer, including creating a comment and any necessary
        preprocessing. This method fetches organization instances and creates a new
        transfer record along with a comment (if provided). If any part of the process
        fails due to missing data or database issues, appropriate exceptions are raised
        and handled by the @service_handler decorator.
        """
        transfer = Transfer(
            **transfer_data.model_dump(exclude={"current_status"})
        )
        current_status = await self.repo.get_transfer_status_by_name(
            transfer_data.current_status
        )
        # TODO: Currenty by default category id is set to CATEGORY - A
        transfer.transfer_category_id = 1

        transfer.current_status = current_status
        if current_status == TransferStatusEnum.Sent:
            await self.validate.sign_and_send_from_supplier(transfer)

        transfer = await self.repo.create_transfer(transfer)
        # Add a new transfer history record if the status has changed
        await self.repo.add_transfer_history(
            transfer.transfer_id, 
            current_status.transfer_status_id,
            self.request.user.user_profile_id
        )
        return transfer

    @service_handler
    async def update_transfer(
        self, transfer_data: TransferCreateSchema
    ) -> Transfer:
        """Updates an existing transfer record with new data."""
        current_status = await self.repo.get_transfer_status_by_name(
            transfer_data.current_status
        )
        transfer = await self.repo.get_transfer_by_id(transfer_data.transfer_id)
        # if data not found
        if not transfer:
            raise DataNotFoundException(
                f"Transfer with id {transfer_data.transfer_id} not found"
            )

        # if the transfer status is Draft or Sent then update all the fields within the transfer
        if (
            transfer_data.current_status == TransferStatusEnum.Draft.value
        ) or (  # if the status of the transfer is already sent then don't update other information
            transfer.current_status != current_status
            and transfer_data.current_status == TransferStatusEnum.Sent.value
        ):
            transfer.to_organization_id = transfer_data.to_organization_id
            transfer.to_organization.oranization_id = transfer_data.to_organization_id
            transfer.agreement_date = transfer_data.agreement_date
            transfer.quantity = transfer_data.quantity
            transfer.price_per_unit = transfer_data.price_per_unit
            transfer.signing_authority_declaration = (
                transfer_data.signing_authority_declaration
            )
            transfer.from_org_comment = transfer_data.from_org_comment
        # update comments
        elif transfer_data.current_status in [TransferStatusEnum.Submitted]:
            transfer.to_org_comment = transfer_data.to_org_comment
        else:
            transfer.gov_comment = transfer_data.gov_comment

        if transfer_data.signing_authority_declaration == None:
            transfer.signing_authority_declaration = False
        if transfer_data.recommendation != transfer.recommendation:
            transfer.recommendation = transfer_data.recommendation

        if (transfer.current_status != current_status):
            if current_status == TransferStatusEnum.Sent:
                await self.sign_and_send_from_supplier(transfer)
            if current_status == TransferStatusEnum.Recorded:
                await self.director_record_transfer(transfer)
            if current_status == TransferStatusEnum.Declined:
                await self.decline_transfer(transfer)    
            # Add a new transfer history record if the status has changed
            await self.repo.add_transfer_history(
                transfer.transfer_id, 
                current_status.transfer_status_id,
                self.request.user.user_profile_id
            )

        transfer.current_status = current_status
        return await self.repo.update_transfer(transfer)

    async def sign_and_send_from_supplier(self, transfer):
        """Create reserved transaction to reserve compliance units for sending organization."""
        user = self.request.user
        has_signing_role = user_has_roles(user, ["SUPPLIER", "SIGNING_AUTHORITY"])
        if not has_signing_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        from_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Reserved,
            compliance_units=-transfer.quantity,  # Negative quantity for sending org
            organization_id=transfer.from_organization_id,
        )
        transfer.from_transaction = from_transaction

    async def director_record_transfer(self, transfer):
        """Confirm transaction for sending organization and create new transaction for receiving org."""
        user = self.request.user
        has_director_role = user_has_roles(user, ["GOVERNMENT", "DIRECTOR"])

        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        if transfer.from_transaction is None:
            raise ServiceException(
                f"From transaction not found for transfer \
                                   {transfer.transfer_id}. Contact support."
            )

        confirm_result = await self.transaction_repo.confirm_transaction(
            transfer.from_transaction_id
        )
        if not confirm_result:
            raise ServiceException(
                f"Failed to confirm transaction \
                                   {transfer.from_transaction_id} for transfer {transfer.transfer_id}. Update cancelled."
            )

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=transfer.quantity,  # Positive quantity for receiving org
            organization_id=transfer.to_organization_id,
        )
        transfer.to_transaction = to_transaction

    async def decline_transfer(self, transfer):
        """Release the reserved transaction when transfer is declined."""
        release_result = await self.transaction_repo.release_transaction(
            transfer.transaction_id
        )
        if not release_result:
            raise ServiceException(
                f"Failed to release transaction \
                                   {transfer.transaction_id} for transfer {transfer.transfer_id}. Update cancelled."
            )

    def _update_comments(self, transfer, transfer_data):
        """Update the comments on a transfer record, if provided."""
        if transfer_data.comments:
            if transfer.comments:
                transfer.comments.comment = transfer_data.comments
            else:
                transfer.comments = Comment(comment=transfer_data.comments)

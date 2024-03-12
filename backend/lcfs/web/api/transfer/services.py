from logging import getLogger
from datetime import datetime
from typing import List
from fastapi import Depends, Request, HTTPException

from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

# models
from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.Comment import Comment
from lcfs.db.models.Transaction import TransactionActionEnum
from lcfs.db.models.OrganizationStatus import OrgStatusEnum

# services
from lcfs.web.api.organizations.services import OrganizationsService

# schema
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.api.transfer.schema import TransferSchema, TransferCreate, TransferUpdate
from lcfs.web.api.transfer.schema import TransferSchema, TransferCreate, TransferUpdate, TransferStatusEnum

# repo
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transaction.repo import TransactionRepository

logger = getLogger("transfer_service")


class TransferServices:
    def __init__(
        self,
        request: Request = None,
        repo: TransferRepository = Depends(TransferRepository),
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        transaction_repo: TransactionRepository = Depends(
            TransactionRepository)
    ) -> None:
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
    async def get_transfers_paginated(self, page: int, size: int) -> List[TransferSchema]:
        transfers = await self.repo.get_transfers_paginated(page, size)
        return [TransferSchema.model_validate(transfer) for transfer in transfers]

    @service_handler
    async def get_transfer(self, transfer_id: int) -> TransferSchema:
        """Fetches a single transfer by its ID and converts it to a Pydantic model."""
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer:
            raise DataNotFoundException(
                f"Transfer with ID {transfer_id} not found")

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

        # Check if both the organizations are registered for transfer
        if from_org.org_status.status != OrgStatusEnum.Registered or to_org.org_status.status != OrgStatusEnum.Registered:
            raise HTTPException(status_code=406,
                                detail="One or more organizations are not registered for transfer"
                                )
        # Create a new Comment instance
        new_comment = Comment(
            comment=transfer_data.comments) if transfer_data.comments else None

        status = await self.repo.get_transfer_status(transfer_status_id=1)
        category = await self.repo.get_transfer_category(transfer_category_id=1)

        transfer_model = Transfer(
            from_organization=from_org,
            to_organization=to_org,
            agreement_date=datetime.strptime(
                transfer_data.agreement_date, "%Y-%m-%d").date(),
            quantity=transfer_data.quantity,
            price_per_unit=transfer_data.price_per_unit,
            signing_authority_declaration=transfer_data.signing_authority_declaration,
            comments=new_comment,  # Associate the comment with the transfer
            current_status=status,
            transfer_category=category
        )

        # Persist the transfer model and its comment in the database
        created_transfer = await self.repo.create_transfer(transfer_model)

        # Convert the ORM model to a Pydantic model for the response
        return TransferSchema.model_validate(created_transfer)

    @service_handler
    async def update_transfer_draft(self, transfer_id: int, transfer_data: TransferCreate) -> TransferSchema:
        """Updates an existing transfer record with new data."""
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer:
            raise DataNotFoundException(
                f"Transfer with ID {transfer_id} not found")

        transfer.agreement_date = datetime.strptime(
            transfer_data.agreement_date, "%Y-%m-%d").date()
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

    # --------------------------------------
    # Update Transfer Methods
    # --------------------------------------

    @service_handler
    async def update_transfer(self, transfer_id: int, transfer_data: TransferUpdate) -> TransferSchema:
        """Updates an existing transfer record with new data."""
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer:
            raise DataNotFoundException(
                f"Transfer with ID {transfer_id} not found")

        # Check if both the organizations are registered for transfer before recording the transfer.
        if (
            transfer_data.current_status_id == TransferStatusEnum.get_index(
                TransferStatusEnum.Recorded)
            and (
                transfer.from_organization.org_status.status != OrgStatusEnum.Registered
                or transfer.to_organization.org_status.status
                != OrgStatusEnum.Registered
            )
        ):
            raise HTTPException(status_code=406,
                                detail="One or more organizations are not registered for transfer"
                                )

        self._update_comments(transfer, transfer_data)

        # Handle specific actions required when the transfer status changes
        if transfer_data.current_status_id != transfer.current_status_id:
            await self.handle_status_change(transfer, transfer_data)

        updated_transfer = await self.repo.update_transfer(transfer)
        validated_model = TransferSchema.model_validate(updated_transfer)
        return validated_model

    async def handle_status_change(self, transfer, transfer_data):
        """Handle specific actions required when the transfer status changes."""
        new_status = transfer_data.current_status_id
        transfer.current_status_id = transfer_data.current_status_id

        # Add a new transfer history record if the status has changed
        await self.repo.add_transfer_history(transfer.transfer_id, new_status)

        if new_status == 3:
            # Handle signing and sending from supplier
            await self.sign_and_send_from_supplier(transfer)
        elif new_status == 6:
            # Handle director recording transfer
            await self.director_record_transfer(transfer)
        elif new_status == 8:
            # Handle transfer status updated to 'Declined'
            await self.decline_transfer(transfer)

    async def sign_and_send_from_supplier(self, transfer):
        """Create reserved transaction to reserve compliance units for sending organization."""
        user = self.request.user
        has_signing_role = user_has_roles(
            user, ['SUPPLIER', 'SIGNING_AUTHORITY'])
        if not has_signing_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        from_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Reserved,
            compliance_units=-transfer.quantity,  # Negative quantity for sending org
            organization_id=transfer.from_organization_id
        )
        transfer.from_transaction = from_transaction

    async def director_record_transfer(self, transfer):
        """Confirm transaction for sending organization and create new transaction for receiving org."""
        user = self.request.user
        has_director_role = user_has_roles(user, ['GOVERNMENT', 'DIRECTOR'])

        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        if transfer.from_transaction is None:
            raise ServiceException(f"From transaction not found for transfer {
                                   transfer.transfer_id}. Contact support.")

        confirm_result = await self.transaction_repo.confirm_transaction(transfer.from_transaction_id)
        if not confirm_result:
            raise ServiceException(f"Failed to confirm transaction {
                                   transfer.from_transaction_id} for transfer {transfer.transfer_id}. Update cancelled.")

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=transfer.quantity,  # Positive quantity for receiving org
            organization_id=transfer.to_organization_id
        )
        transfer.to_transaction = to_transaction

    async def decline_transfer(self, transfer):
        """Release the reserved transaction when transfer is declined."""
        release_result = await self.transaction_repo.release_transaction(transfer.transaction_id)
        if not release_result:
            raise ServiceException(f"Failed to release transaction {
                                   transfer.transaction_id} for transfer {transfer.transfer_id}. Update cancelled.")

    def _update_comments(self, transfer, transfer_data):
        """Update the comments on a transfer record, if provided."""
        if transfer_data.comments:
            if transfer.comments:
                transfer.comments.comment = transfer_data.comments
            else:
                transfer.comments = Comment(comment=transfer_data.comments)

from logging import getLogger
from typing import List, Optional
from fastapi import Depends, Request, HTTPException
from datetime import datetime
from dateutil.relativedelta import relativedelta

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.transfer.validation import TransferValidation
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

# models
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.db.models.transfer.TransferCategory import TransferCategoryEnum
from lcfs.db.models.transaction.Transaction import TransactionActionEnum

# services
from lcfs.web.api.organizations.services import OrganizationsService

# schema
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.api.transfer.schema import (
    TransferCommentSchema,
    TransferSchema,
    TransferCreateSchema,
    TransferCategorySchema,
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

    # @service_handler
    # async def get_transfers_paginated(
    #     self, page: int, size: int
    # ) -> List[TransferSchema]:
    #     transfers = await self.repo.get_transfers_paginated(page, size)
    #     return [TransferSchema.model_validate(transfer) for transfer in transfers]

    @service_handler
    async def get_transfer(self, transfer_id: int) -> TransferSchema:
        """Fetches a single transfer by its ID and converts it to a Pydantic model."""
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        if not transfer:
            raise DataNotFoundException(f"Transfer with ID {transfer_id} not found")

        transfer_view = TransferSchema.model_validate(transfer)
        comments: List[TransferCreateSchema] = []
        if (
            transfer.from_org_comment != None
            and transfer.from_org_comment != ""
            and transfer.current_status.status != TransferStatusEnum.Draft
        ):
            comments.append(
                TransferCommentSchema(
                    name=transfer.from_organization.name,
                    comment=transfer.from_org_comment,
                )
            )
        if transfer.to_org_comment != None and transfer.to_org_comment != "":
            comments.append(
                TransferCommentSchema(
                    name=transfer.to_organization.name,
                    comment=transfer.to_org_comment,
                )
            )
        if (
            transfer.gov_comment != None
            and transfer.gov_comment != ""
            and transfer.current_status.status
            in [TransferStatusEnum.Recorded, TransferStatusEnum.Refused]
        ):
            comments.append(
                TransferCommentSchema(
                    name="Government of British Columbia",
                    comment=transfer.gov_comment,
                )
            )
        transfer_view.comments = comments
        # Hide Recommended status to organizations or if the transfer is returned to analyst by the director and it is in Submitted status
        if (
            self.request.user.organization is not None
            or transfer_view.current_status.status == TransferStatusEnum.Submitted.value
        ):
            if (
                transfer_view.current_status.status
                == TransferStatusEnum.Recommended.value
            ):
                transfer_view.current_status = (
                    await self.repo.get_transfer_status_by_name(
                        TransferStatusEnum.Submitted.value
                    )
                )
            transfer_view.transfer_history = list(
                filter(
                    lambda history: history.transfer_status.status
                    != TransferStatusEnum.Recommended.value,
                    transfer_view.transfer_history,
                )
            )
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
        transfer = Transfer(**transfer_data.model_dump(exclude={"current_status"}))
        current_status = await self.repo.get_transfer_status_by_name(
            transfer_data.current_status
        )
        # TODO: Currenty by default category id is set to CATEGORY - A
        # transfer.transfer_category_id = 1

        transfer.current_status = current_status
        if current_status.status == TransferStatusEnum.Sent:
            await self.sign_and_send_from_supplier(transfer)

        transfer = await self.repo.create_transfer(transfer)
        # Add a new transfer history record if the status has changed
        await self.repo.add_transfer_history(
            transfer.transfer_id,
            current_status.transfer_status_id,
            self.request.user.user_profile_id,
        )
        return transfer

    @service_handler
    async def update_transfer(self, transfer_data: TransferCreateSchema) -> Transfer:
        """Updates an existing transfer record with new data."""
        new_status = await self.repo.get_transfer_status_by_name(
            transfer_data.current_status
        )
        transfer = await self.repo.get_transfer_by_id(transfer_data.transfer_id)

        if not transfer:
            raise DataNotFoundException(
                f"Transfer with id {transfer_data.transfer_id} not found"
            )

        # Check if the new status is different from the current status of the transfer
        status_has_changed = transfer.current_status != new_status
        re_recommended = (
            any(
                history.transfer_status.status == TransferStatusEnum.Recommended
                for history in transfer.transfer_history
            )
            and new_status.status == TransferStatusEnum.Recommended
        )
        # if the transfer status is Draft or Sent then update all the fields within the transfer
        if transfer_data.current_status in [
            TransferStatusEnum.Draft.value,
            TransferStatusEnum.Sent.value,
        ]:
            # Only update certain fields if the status is Draft or changing to Sent
            if (
                status_has_changed
                or transfer_data.current_status == TransferStatusEnum.Draft.value
            ):
                transfer.to_organization_id = transfer_data.to_organization_id
                transfer.agreement_date = transfer_data.agreement_date
                transfer.quantity = transfer_data.quantity
                transfer.price_per_unit = transfer_data.price_per_unit
                transfer.from_org_comment = transfer_data.from_org_comment
        # update comments
        elif status_has_changed and new_status.status in [
            TransferStatusEnum.Submitted,
            TransferStatusEnum.Declined,
        ]:
            transfer.to_org_comment = transfer_data.to_org_comment
        transfer.gov_comment = transfer_data.gov_comment
        # if the transfer is returned back to analyst by the director then don't store the history.
        if (
            new_status.status == TransferStatusEnum.Submitted
            and transfer.current_status.status == TransferStatusEnum.Recommended
        ) or re_recommended:
            status_has_changed = False
        if (
            transfer_data.recommendation
            and transfer_data.recommendation != transfer.recommendation
        ):
            transfer.recommendation = transfer_data.recommendation
        # Update existing history record
        if re_recommended:
            transfer.current_status = await self.repo.update_transfer_history(
                transfer_id=transfer.transfer_id,
                transfer_status_id=new_status.transfer_status_id,
                user_profile_id=self.request.user.user_profile_id,
            )
        # Update transfer history and handle status-specific actions if the status has changed
        if status_has_changed:
            logger.debug(
                f"Status change: \
                  {transfer.current_status.status} -> {new_status.status}"
            )

            # Matching the current status with enums directly is safer if they are comparable
            if new_status.status == TransferStatusEnum.Sent:
                await self.sign_and_send_from_supplier(transfer)
            elif new_status.status == TransferStatusEnum.Recorded:

                await self.director_record_transfer(transfer)
            elif new_status.status in [
                TransferStatusEnum.Declined,
                TransferStatusEnum.Rescinded,
                TransferStatusEnum.Refused,
            ]:
                await self.cancel_transfer(transfer)

            new_status = await self.repo.get_transfer_status_by_name(
                transfer_data.current_status
            )
            # Add a new transfer history record to reflect the status change
            await self.repo.add_transfer_history(
                transfer_data.transfer_id,
                new_status.transfer_status_id,
                self.request.user.user_profile_id,
            )

        # Finally, update the transfer's status and save the changes
        transfer.current_status = new_status
        return await self.repo.update_transfer(transfer)

    async def sign_and_send_from_supplier(self, transfer):
        """Create reserved transaction to reserve compliance units for sending organization."""
        user = self.request.user
        has_signing_role = user_has_roles(
            user, [RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY]
        )
        if not has_signing_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        from_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Reserved,
            compliance_units=-transfer.quantity,  # Negative quantity for sending org
            organization_id=transfer.from_organization_id,
        )
        transfer.from_transaction = from_transaction

    async def director_record_transfer(self, transfer: Transfer):
        """Confirm transaction for sending organization and create new transaction for receiving org."""

        user = self.request.user
        has_director_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
        )

        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        if transfer.from_transaction is None:
            raise ServiceException(
                f"From transaction not found for transfer \
                                   {transfer.transfer_id}. Contact support."
            )

        # Confirm transaction of sending organization
        confirm_result = await self.transaction_repo.confirm_transaction(
            transfer.from_transaction_id
        )

        if not confirm_result:
            raise ServiceException(
                f"Failed to confirm transaction \
                                   {transfer.from_transaction_id} for transfer {transfer.transfer_id}. Update cancelled."
            )

        await self.repo.refresh_transfer(transfer)

        if not hasattr(transfer.transfer_category, "category"):
            today = datetime.now()

            diff = relativedelta(today, transfer.agreement_date)

            category = "A"
            if (diff.years == 0 and diff.months >= 6 and diff.days > 1) or (
                diff.years == 1 and diff.months == 0 and diff.days == 1
            ):
                category = "B"
            elif diff.years >= 1:
                category = "C"

            await self.update_category(transfer.transfer_id, category)

        await self.repo.refresh_transfer(transfer)

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=transfer.quantity,  # Positive quantity for receiving org
            organization_id=transfer.to_organization_id,
        )
        transfer.to_transaction = to_transaction

        await self.repo.refresh_transfer(transfer)

    async def cancel_transfer(self, transfer):
        """ "
        Handle the cancellation of a transfer by releasing reserved transactions.
        This method is invoked when a transfer is declined, rescinded, or refused.
        """
        release_result = await self.transaction_repo.release_transaction(
            transfer.from_transaction_id
        )
        if not release_result:
            raise ServiceException(
                f"Failed to release transaction \
                                   {transfer.from_transaction_id} for transfer {transfer.transfer_id}. Update cancelled."
            )

    def is_valid_category(self, category: str) -> bool:
        return category in (item.value for item in TransferCategoryEnum)

    @service_handler
    async def update_category(self, transfer_id: int, category: Optional[str] = None):
        new_category = None

        if category != None:
            valid_category = self.is_valid_category(category)

            if not valid_category:
                raise ServiceException(f"Not a valid category")

            new_category = await self.repo.get_transfer_category_by_name(category)

        transfer = await self.repo.get_transfer_by_id(transfer_id)

        transfer.transfer_category = new_category

        return transfer

import json
import structlog
from datetime import datetime
from fastapi import Depends, HTTPException
from typing import List, Optional

from lcfs.db.models import UserProfile
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferCategory import TransferCategoryEnum
from lcfs.db.models.transfer.TransferComment import TransferCommentSourceEnum
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.notification.schema import (
    TRANSFER_STATUS_NOTIFICATION_MAPPER,
    NotificationMessageSchema,
    NotificationRequestSchema,
)
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.transfer.repo import TransferRepository
from lcfs.web.api.transfer.schema import (
    CreateTransferHistorySchema,
    TransferCommentSchema,
    TransferSchema,
    TransferCreateSchema,
)
from lcfs.web.api.transfer.validation import TransferValidation
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

logger = structlog.get_logger(__name__)


class TransferServices:
    def __init__(
        self,
        validate: TransferValidation = Depends(TransferValidation),
        repo: TransferRepository = Depends(TransferRepository),
        org_repo: OrganizationsRepository = Depends(OrganizationsRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
        notfn_service: NotificationService = Depends(NotificationService),
    ) -> None:
        self.validate = validate
        self.repo = repo
        self.org_repo = org_repo
        self.org_service = org_service
        self.transaction_repo = transaction_repo
        self.notfn_service = notfn_service

    @service_handler
    async def get_all_transfers(self) -> List[TransferSchema]:
        """Fetches all transfer records and converts them to Pydantic models."""
        transfers = await self.repo.get_all_transfers()
        result_list = []
        for t in transfers:
            # Convert to schema
            transfer_schema = TransferSchema.model_validate(t)
            # Sort the existing comments by create_date
            sorted_comments = sorted(
                t.transfer_comments, key=lambda c: c.create_date or datetime.min
            )
            transfer_schema.comments = [
                TransferCommentSchema.model_validate(c) for c in sorted_comments
            ]
            result_list.append(transfer_schema)
        return result_list

    @service_handler
    async def get_transfer(self, user: UserProfile, transfer_id: int) -> TransferSchema:
        """Fetches a single transfer by its ID and converts it to a Pydantic model."""
        transfer = await self.repo.get_transfer_by_id(transfer_id)
        # Check if the current viewer is a gov user
        is_government_viewer = user_has_roles(user, [RoleEnum.GOVERNMENT])
        if not transfer or (
            is_government_viewer
            and transfer.current_status.status
            in [
                TransferStatusEnum.Draft,
                TransferStatusEnum.Sent,
            ]
            or (
                transfer.current_status.status == TransferStatusEnum.Rescinded
                and not any(
                    history.transfer_status.status == TransferStatusEnum.Submitted
                    and history.create_date < transfer.update_date
                    for history in transfer.transfer_history
                )
            )
        ):
            raise DataNotFoundException(f"Transfer with ID {transfer_id} not found")

        transfer_view = TransferSchema.model_validate(transfer)

        # Gather the comments from the new transfer_comment table
        sorted_comments = sorted(
            transfer.transfer_comments, key=lambda c: c.create_date
        )

        # Build the final list of comment schemas
        final_comments = []
        for c in sorted_comments:
            comment_schema = TransferCommentSchema.model_validate(c)

            # 1) If created_by is null/empty, fallback to org name or Government
            if not comment_schema.created_by:
                if c.comment_source == TransferCommentSourceEnum.FROM_ORG:
                    comment_schema.created_by_org = transfer.from_organization.name
                elif c.comment_source == TransferCommentSourceEnum.TO_ORG:
                    comment_schema.created_by_org = transfer.to_organization.name
                else:
                    # c.comment_source == TransferCommentSourceEnum.GOVERNMENT
                    comment_schema.created_by_org = "Government of British Columbia"

            # 2) If the comment source is GOV, and the viewer is not gov,
            #    we hide the actual name.
            if (
                c.comment_source == TransferCommentSourceEnum.GOVERNMENT
                and not is_government_viewer
            ):
                comment_schema.created_by = None

            final_comments.append(comment_schema)

        transfer_view.comments = final_comments

        # Hide Recommended status to organizations or if the transfer is returned to analyst by the director and it is in Submitted status
        if (
            user.organization is not None
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
        self, transfer_data: TransferCreateSchema, user: UserProfile
    ) -> TransferSchema:
        """
        Handles creating a transfer, including creating a comment and any necessary
        preprocessing. This method fetches organization instances and creates a new
        transfer record along with a comment (if provided). If any part of the process
        fails due to missing data or database issues, appropriate exceptions are raised
        and handled by the @service_handler decorator.
        """
        transfer = Transfer(
            **transfer_data.model_dump(
                exclude={
                    "current_status",
                    "from_org_comment",
                    "to_org_comment",
                    "gov_comment",
                }
            )
        )
        current_status = await self.repo.get_transfer_status_by_name(
            transfer_data.current_status
        )

        transfer.current_status = current_status
        if current_status.status == TransferStatusEnum.Sent:
            await self.sign_and_send_from_supplier(transfer, user)

        transfer = await self.repo.create_transfer(transfer)

        # Upsert the comments
        if transfer_data.from_org_comment is not None:
            await self.repo.upsert_transfer_comment(
                transfer_id=transfer.transfer_id,
                comment=transfer_data.from_org_comment,
                comment_source=TransferCommentSourceEnum.FROM_ORG,
            )

        if transfer_data.to_org_comment is not None:
            await self.repo.upsert_transfer_comment(
                transfer_id=transfer.transfer_id,
                comment=transfer_data.to_org_comment,
                comment_source=TransferCommentSourceEnum.TO_ORG,
            )

        if transfer_data.gov_comment is not None:
            await self.repo.upsert_transfer_comment(
                transfer_id=transfer.transfer_id,
                comment=transfer_data.gov_comment,
                comment_source=TransferCommentSourceEnum.GOVERNMENT,
            )

        # Add a new transfer history record if the status has changed
        await self.repo.add_transfer_history(
            CreateTransferHistorySchema(
                transfer_history_id=None,
                transfer_id=transfer.transfer_id,
                transfer_status_id=current_status.transfer_status_id,
                user_profile_id=user.user_profile_id,
                display_name=(f"{user.first_name} {user.last_name}"),
            )
        )
        await self._perform_notification_call(transfer, current_status.status, user)
        return transfer

    @service_handler
    async def update_transfer(
        self, transfer_data: TransferCreateSchema, user: UserProfile
    ) -> Transfer:
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

        # Upsert the comments
        if transfer_data.from_org_comment is not None:
            await self.repo.upsert_transfer_comment(
                transfer_id=transfer.transfer_id,
                comment=transfer_data.from_org_comment,
                comment_source=TransferCommentSourceEnum.FROM_ORG,
            )

        if transfer_data.to_org_comment is not None:
            await self.repo.upsert_transfer_comment(
                transfer_id=transfer.transfer_id,
                comment=transfer_data.to_org_comment,
                comment_source=TransferCommentSourceEnum.TO_ORG,
            )

        if transfer_data.gov_comment is not None:
            await self.repo.upsert_transfer_comment(
                transfer_id=transfer.transfer_id,
                comment=transfer_data.gov_comment,
                comment_source=TransferCommentSourceEnum.GOVERNMENT,
            )

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
                user_profile_id=user.user_profile_id,
            )
        # Update transfer history and handle status-specific actions if the status has changed
        if status_has_changed:
            logger.info(
                f"Status change: \
                  {transfer.current_status.status} -> {new_status.status}"
            )

            # Matching the current status with enums directly is safer if they are comparable
            if new_status.status == TransferStatusEnum.Sent:
                await self.sign_and_send_from_supplier(transfer, user)
            elif new_status.status == TransferStatusEnum.Recorded:
                await self.director_record_transfer(transfer, user)
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
                CreateTransferHistorySchema(
                    transfer_history_id=None,
                    transfer_id=transfer_data.transfer_id,
                    transfer_status_id=new_status.transfer_status_id,
                    user_profile_id=user.user_profile_id,
                    display_name=user.first_name + " " + user.last_name,
                )
            )

        # Finally, update the transfer's status and save the changes
        transfer.current_status = new_status
        transfer_result = await self.repo.update_transfer(transfer)
        await self._perform_notification_call(
            transfer,
            status=(
                new_status.status
                if status_has_changed or re_recommended
                else "Return to analyst"
            ),
            user=user,
        )
        return transfer_result

    async def _perform_notification_call(
        self,
        transfer: TransferSchema,
        status: TransferStatusEnum,
        user: UserProfile,
    ):
        """Send notifications based on the current status of the transfer."""
        notifications = TRANSFER_STATUS_NOTIFICATION_MAPPER.get(status)
        status_val = (
            status.value if isinstance(status, TransferStatusEnum) else status
        ).lower()
        organization_ids = []
        if status in [
            TransferStatusEnum.Submitted,
            TransferStatusEnum.Recommended,
            TransferStatusEnum.Declined,
        ]:
            organization_ids = [transfer.from_organization.organization_id]
        elif status in [
            TransferStatusEnum.Sent,
            TransferStatusEnum.Rescinded,
        ]:
            organization_ids = [transfer.to_organization.organization_id]
        elif status in [
            TransferStatusEnum.Recorded,
            TransferStatusEnum.Refused,
        ]:
            organization_ids = [
                transfer.to_organization.organization_id,
                transfer.from_organization.organization_id,
            ]
        message_data = {
            "service": "Transfer",
            "id": transfer.transfer_id,
            "transactionId": (
                transfer.from_transaction.transaction_id
                if getattr(transfer, "from_transaction", None)
                else None
            ),
            "status": status_val,
            "fromOrganizationId": transfer.from_organization.organization_id,
            "fromOrganization": transfer.from_organization.name,
            "toOrganizationId": transfer.to_organization.organization_id,
            "toOrganization": transfer.to_organization.name,
        }
        type = f"Transfer {status_val}"
        if status_val == "sent":
            type = "Transfer received"
        elif status_val == "return to analyst":
            type = "Transfer returned"
        for org_id in organization_ids:
            notification_data = NotificationMessageSchema(
                type=type,
                related_transaction_id=f"CT{transfer.transfer_id}",
                message=json.dumps(message_data),
                related_organization_id=org_id,
                origin_user_profile_id=user.user_profile_id,
            )
            if notifications and isinstance(notifications, list):
                await self.notfn_service.send_notification(
                    NotificationRequestSchema(
                        notification_types=notifications,
                        notification_data=notification_data,
                    )
                )

    async def sign_and_send_from_supplier(self, transfer: Transfer, user: UserProfile):
        """Create reserved transaction to reserve compliance units for sending organization."""
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

    async def director_record_transfer(self, transfer: Transfer, user: UserProfile):
        """Confirm transaction for sending organization and create new transaction for receiving org."""
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

        if transfer.transfer_category is None or not hasattr(
            transfer.transfer_category, "category"
        ):
            today = datetime.now()
            diff_seconds = today.timestamp() - transfer.agreement_date.timestamp()
            # Define approximate thresholds in seconds
            ONE_DAY = 24 * 60 * 60
            SIX_MONTHS = 6 * 30 * ONE_DAY
            ONE_YEAR = 365 * ONE_DAY

            category = "A"
            if (diff_seconds >= SIX_MONTHS) and (diff_seconds < ONE_YEAR):
                category = "B"
            elif diff_seconds >= ONE_YEAR:
                category = "C"

            updated_transfer = await self.update_category(
                transfer.transfer_id, category
            )
            updated_transfer.transaction_effective_date = datetime.now()

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=transfer.quantity,  # Positive quantity for receiving org
            organization_id=transfer.to_organization_id,
        )
        transfer.to_transaction = to_transaction
        transfer.to_transaction_id = to_transaction.transaction_id

        await self.repo.update_transfer(transfer)
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

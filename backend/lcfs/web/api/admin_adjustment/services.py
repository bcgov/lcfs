from datetime import datetime, timezone
from fastapi import Depends, Request, HTTPException
from lcfs.db.models.admin_adjustment import AdminAdjustment
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import (
    AdminAdjustmentStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.admin_adjustment.schema import (
    AdminAdjustmentCreateSchema,
    AdminAdjustmentSchema,
    AdminAdjustmentUpdateSchema,
    CreateAdminAdjustmentHistorySchema,
)
from lcfs.web.api.admin_adjustment.repo import AdminAdjustmentRepository
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.role.schema import user_has_roles
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.internal_comment.services import InternalCommentService
from lcfs.web.api.internal_comment.schema import (
    InternalCommentCreateSchema,
    AudienceScopeEnum,
    EntityTypeEnum,
)


class AdminAdjustmentServices:
    def __init__(
        self,
        repo: AdminAdjustmentRepository = Depends(AdminAdjustmentRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        internal_comment_service: InternalCommentService = Depends(
            InternalCommentService
        ),
        request: Request = None,
    ) -> None:
        self.repo = repo
        self.org_service = org_service
        self.internal_comment_service = internal_comment_service
        self.request = request

    @service_handler
    async def get_admin_adjustment(
        self, admin_adjustment_id: int
    ) -> AdminAdjustmentSchema:
        """Fetch an admin adjustment by its ID."""
        admin_adjustment = await self.repo.get_admin_adjustment_by_id(
            admin_adjustment_id
        )
        return AdminAdjustmentSchema.from_orm(admin_adjustment)

    @service_handler
    async def update_admin_adjustment(
        self, admin_adjustment_data: AdminAdjustmentUpdateSchema
    ) -> AdminAdjustmentSchema:
        """Update an existing admin adjustment."""
        admin_adjustment = await self.repo.get_admin_adjustment_by_id(
            admin_adjustment_data.admin_adjustment_id
        )
        if not admin_adjustment:
            raise DataNotFoundException(
                f"Admin Adjustment with ID {admin_adjustment_data.admin_adjustment_id} not found."
            )

        new_status = await self.repo.get_admin_adjustment_status_by_name(
            admin_adjustment_data.current_status
        )
        status_has_changed = admin_adjustment.current_status != new_status

        current_status_enum = admin_adjustment.current_status.status
        new_status_enum = new_status.status

        # Validate status transitions before applying any changes
        if status_has_changed:
            # Prevent skipping Recommended: Draft -> Approved requires Recommended first
            if (
                current_status_enum == AdminAdjustmentStatusEnum.Draft
                and new_status_enum == AdminAdjustmentStatusEnum.Approved
            ):
                raise HTTPException(
                    status_code=403,
                    detail="An admin adjustment must be recommended before it can be approved.",
                )

            # Only Analysts can set the status to Recommended
            if new_status_enum == AdminAdjustmentStatusEnum.Recommended:
                if not user_has_roles(
                    self.request.user, [RoleEnum.GOVERNMENT, RoleEnum.ANALYST]
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="Only Analysts can recommend an admin adjustment.",
                    )

        # Fields that may only be edited while the transaction is in Draft status
        DRAFT_ONLY_FIELDS = {
            "transaction_effective_date",
            "compliance_units",
            "to_organization_id",
        }
        is_draft = current_status_enum == AdminAdjustmentStatusEnum.Draft

        # Update the fields except for 'current_status'
        for field, value in admin_adjustment_data.dict(exclude_unset=True).items():
            if field != "current_status":
                if not is_draft and field in DRAFT_ONLY_FIELDS:
                    continue
                setattr(admin_adjustment, field, value)

        # Initialize status flags
        returned, re_recommended = False, False

        if status_has_changed:
            admin_adjustment.current_status = new_status

            # Issue compliance units by Director if status is approved
            if new_status.status == AdminAdjustmentStatusEnum.Approved:
                await self.director_approve_admin_adjustment(admin_adjustment)

            # Check previous recommended status
            previous_recommended = any(
                history.admin_adjustment_status.status
                == AdminAdjustmentStatusEnum.Recommended
                for history in admin_adjustment.history
            )

            if previous_recommended:
                if new_status.status == AdminAdjustmentStatusEnum.Draft:
                    returned = True
                elif new_status.status == AdminAdjustmentStatusEnum.Recommended:
                    re_recommended = True

            # Update or add history record based on status flags
            history_method = (
                self.repo.update_admin_adjustment_history
                if re_recommended
                else self.repo.add_admin_adjustment_history
            )
            # We only track history changes on Recommended and Approved, not Draft
            if new_status.status != AdminAdjustmentStatusEnum.Draft:
                await history_method(CreateAdminAdjustmentHistorySchema(
                    admin_adjustment_id=admin_adjustment.admin_adjustment_id,
                    admin_adjustment_status_id=new_status.admin_adjustment_status_id,
                    user_profile_id=self.request.user.user_profile_id,
                    display_name=(f"{self.request.user.first_name} {self.request.user.last_name}")
                ))

        # Save the updated admin adjustment
        updated_admin_adjustment = await self.repo.update_admin_adjustment(
            admin_adjustment
        )

        # Return the updated admin adjustment schema with the returned status flag
        aa_schema = AdminAdjustmentSchema.from_orm(updated_admin_adjustment)
        aa_schema.returned = returned

        return aa_schema

    @service_handler
    async def create_admin_adjustment(
        self, admin_adjustment_data: AdminAdjustmentCreateSchema
    ) -> AdminAdjustmentSchema:
        """
        Handles creating an admin adjustment, including creating a comment (if provided).
        """
        # Fetch the status for the admin adjustment
        current_status = await self.repo.get_admin_adjustment_status_by_name(
            admin_adjustment_data.current_status
        )

        # Create the admin adjustment
        admin_adjustment = AdminAdjustment(
            **admin_adjustment_data.model_dump(
                exclude={"current_status", "internal_comment"}
            )
        )

        admin_adjustment.current_status = current_status

        # Save the admin adjustment
        admin_adjustment = await self.repo.create_admin_adjustment(admin_adjustment)

        if current_status.status == AdminAdjustmentStatusEnum.Recommended:
            await self.repo.add_admin_adjustment_history(CreateAdminAdjustmentHistorySchema(
                admin_adjustment_id=admin_adjustment.admin_adjustment_id,
                admin_adjustment_status_id=current_status.admin_adjustment_status_id,
                user_profile_id=self.request.user.user_profile_id,
                display_name=(f"{self.request.user.first_name} {self.request.user.last_name}")
            ))

        # Create internal comment if provided
        if admin_adjustment_data.internal_comment:
            internal_comment_data = InternalCommentCreateSchema(
                entity_type=EntityTypeEnum.ADMIN_ADJUSTMENT,
                entity_id=admin_adjustment.admin_adjustment_id,
                comment=admin_adjustment_data.internal_comment,
                audience_scope=AudienceScopeEnum.ANALYST,
            )
            await self.internal_comment_service.create_internal_comment(
                internal_comment_data
            )

        return AdminAdjustmentSchema.from_orm(admin_adjustment)

    async def director_approve_admin_adjustment(
        self, admin_adjustment: AdminAdjustment
    ):
        """Create ledger transaction for approved admin adjustment"""

        user = self.request.user
        has_director_role = user_has_roles(
            user, [RoleEnum.GOVERNMENT, RoleEnum.DIRECTOR]
        )

        if not has_director_role:
            raise HTTPException(status_code=403, detail="Forbidden.")

        if admin_adjustment.transaction != None:
            raise HTTPException(status_code=403, detail="Transaction already exists.")

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=admin_adjustment.compliance_units,
            organization_id=admin_adjustment.to_organization_id,
        )
        admin_adjustment.transaction = to_transaction

        # Set effective date to today if the analyst left it blank
        if admin_adjustment.transaction_effective_date is None:
            admin_adjustment.transaction_effective_date = datetime.now(timezone.utc).date()

        await self.repo.refresh_admin_adjustment(admin_adjustment)

import json
import math
from typing import Optional
from lcfs.web.api.notification.schema import (
    INITIATIVE_AGREEMENT_STATUS_NOTIFICATION_MAPPER,
    NotificationMessageSchema,
    NotificationRequestSchema,
)
from lcfs.web.api.notification.services import NotificationService
import structlog
from datetime import datetime, timezone
from fastapi import Depends, Request, HTTPException
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_ANALYST_ASSIGNED,
    EVENT_ANALYST_REASSIGNED,
    EVENT_ANALYST_UNASSIGNED,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
)
from lcfs.web.api.internal_comment.services import sanitize_comment_text
from lcfs.web.api.initiative_agreement.schema import (
    DesignatedActionProfileSchema,
    AnalystAssignmentSchema,
    DesignatedActionSchema,
    DesignatedActionsListSchema,
    IAAnalystSchema,
    CreateInitiativeAgreementHistorySchema,
    LastCommentSchema,
    InitiativeAgreementCreateSchema,
    InitiativeAgreementListItemSchema,
    InitiativeAgreementProfileSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementsListSchema,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
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

logger = structlog.get_logger(__name__)

# Upper bound on grid page size; the frontend asks for 25.
MAX_PAGE_SIZE = 200


class InitiativeAgreementServices:
    def __init__(
        self,
        repo: InitiativeAgreementRepository = Depends(InitiativeAgreementRepository),
        org_service: OrganizationsService = Depends(OrganizationsService),
        internal_comment_service: InternalCommentService = Depends(
            InternalCommentService
        ),
        notfn_service: NotificationService = Depends(NotificationService),
        request: Request = None,
    ) -> None:
        self.repo = repo
        self.org_service = org_service
        self.internal_comment_service = internal_comment_service
        self.request = request
        self.notfn_service = notfn_service

    @service_handler
    async def get_initiative_agreement(
        self, initiative_agreement_id: int
    ) -> InitiativeAgreementSchema:
        """Fetch an initiative agreement by its ID."""
        initiative_agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        return InitiativeAgreementSchema.from_orm(initiative_agreement)

    @staticmethod
    def _last_comment_payload(latest, agreement_id) -> Optional[LastCommentSchema]:
        entry = latest.get(agreement_id)
        if not entry:
            return None
        comment, full_name = entry
        if not full_name:
            return None
        # comment_search_text is the sanitized plain text the search index
        # already stores; fall back to stripping the rich text.
        text = comment.comment_search_text or sanitize_comment_text(comment.comment)
        return LastCommentSchema(
            full_name=full_name,
            comment=text,
            create_date=comment.create_date,
        )

    @staticmethod
    def _list_item_kwargs(agreement: InitiativeAgreement) -> dict:
        """Shared field mapping for list items and the profile response."""
        return dict(
            initiative_agreement_id=agreement.initiative_agreement_id,
            ia_code=agreement.ia_code,
            agreement_type=agreement.agreement_type,
            title=agreement.title,
            contact_name=agreement.contact_name,
            entry_date=agreement.entry_date,
            agreement_start_date=agreement.agreement_start_date,
            agreement_end_date=agreement.agreement_end_date,
            total_credits_allocated=agreement.total_credits_allocated,
            total_credits_issued=agreement.total_credits_issued,
            update_date=agreement.update_date,
            lifecycle_status=agreement.lifecycle_status,
            organization=agreement.to_organization,
        )

    @service_handler
    async def get_initiative_agreements_paginated(
        self, pagination: PaginationRequestSchema
    ) -> InitiativeAgreementsListSchema:
        """
        Paginated agreements list for the agreement-management grid.
        Government users see all agreements; other users are scoped to
        their own organization.
        """
        pagination = validate_pagination(pagination)
        pagination.size = min(pagination.size, MAX_PAGE_SIZE)
        organization_id = None
        user = self.request.user if self.request else None
        if user is not None and not user_has_roles(user, [RoleEnum.GOVERNMENT]):
            organization_id = (
                user.organization.organization_id if user.organization else -1
            )
        agreements, total_count = await self.repo.get_initiative_agreements_paginated(
            pagination, organization_id
        )
        # Non-government callers never receive internal comment text.
        latest_comments = await self.repo.get_latest_comments_by_agreement_ids(
            [a.initiative_agreement_id for a in agreements],
            include_internal=organization_id is None,
        )
        return InitiativeAgreementsListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=(
                    math.ceil(total_count / pagination.size) if pagination.size else 0
                ),
            ),
            initiative_agreements=[
                InitiativeAgreementListItemSchema(
                    **self._list_item_kwargs(agreement),
                    last_comment=self._last_comment_payload(
                        latest_comments, agreement.initiative_agreement_id
                    ),
                )
                for agreement in agreements
            ],
        )

    @service_handler
    async def get_lifecycle_statuses(self):
        """Lifecycle statuses for the agreement grid's status filter."""
        return await self.repo.get_lifecycle_statuses()

    @service_handler
    async def get_initiative_agreement_profile(
        self, initiative_agreement_id: int
    ) -> InitiativeAgreementProfileSchema:
        """Agreement profile with its designated actions for the detail page."""
        agreement = await self.repo.get_initiative_agreement_profile(
            initiative_agreement_id
        )
        if not agreement:
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        # Current version of each action only: a change order appends a row
        # sharing group_uuid, so the raw relationship shows amended actions
        # once per version.
        designated_actions = await self.repo.get_current_designated_actions(
            initiative_agreement_id
        )
        return InitiativeAgreementProfileSchema(
            **self._list_item_kwargs(agreement),
            project_description=agreement.project_description,
            contact_email=agreement.contact_email,
            contact_phone=agreement.contact_phone,
            create_date=agreement.create_date,
            designated_actions=designated_actions,
        )

    @service_handler
    async def get_designated_actions_paginated(
        self, initiative_agreement_id: int, pagination: PaginationRequestSchema
    ) -> DesignatedActionsListSchema:
        """Paginated designated actions for one agreement's grid (#4896)."""
        agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        if not agreement:
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        pagination = validate_pagination(pagination)
        pagination.size = min(pagination.size, MAX_PAGE_SIZE)
        actions, total_count = await self.repo.get_designated_actions_paginated(
            initiative_agreement_id, pagination
        )
        # The grid endpoint is IDIR-only, so internal comments are visible.
        latest_comments = await self.repo.get_latest_comments_by_designated_action_ids(
            actions, include_internal=True
        )
        rows = []
        for action in actions:
            row = DesignatedActionSchema.model_validate(action)
            entry = latest_comments.get(action.designated_action_id)
            if entry:
                comment, full_name = entry
                if full_name:
                    text = comment.comment_search_text or sanitize_comment_text(
                        comment.comment
                    )
                    row = row.model_copy(
                        update={
                            "last_comment": LastCommentSchema(
                                full_name=full_name,
                                comment=text,
                                create_date=comment.create_date,
                            )
                        }
                    )
            rows.append(row)
        return DesignatedActionsListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=(
                    math.ceil(total_count / pagination.size) if pagination.size else 0
                ),
            ),
            designated_actions=rows,
        )

    @service_handler
    async def get_designated_action_profile(
        self, designated_action_id: int
    ) -> DesignatedActionProfileSchema:
        """The action detail page's record (#4840)."""
        action = await self.repo.get_designated_action_by_id(designated_action_id)
        if not action:
            raise DataNotFoundException(
                f"Designated action with id {designated_action_id} not found"
            )
        siblings = await self.repo.get_current_designated_actions(
            action.initiative_agreement_id
        )
        base = DesignatedActionSchema.model_validate(action)
        return DesignatedActionProfileSchema(
            **base.model_dump(),
            initiative_agreement_id=action.initiative_agreement_id,
            ia_code=action.initiative_agreement.ia_code,
            sibling_action_ids=[s.designated_action_id for s in siblings],
        )

    @service_handler
    async def get_available_analysts(self) -> list[IAAnalystSchema]:
        analysts = await self.repo.get_active_ia_analysts()
        return [IAAnalystSchema.model_validate(a) for a in analysts]

    @service_handler
    async def assign_designated_action_analyst(
        self,
        designated_action_id: int,
        data: AnalystAssignmentSchema,
        user,
    ) -> DesignatedActionSchema:
        """
        Assign, reassign or unassign the analyst on a designated action.

        Mutates the current row in place and records the change in
        designated_action_history — assignment is operational state, not a
        change order, so it must never append a version row (#4896).
        """
        action = await self.repo.get_designated_action_by_id(designated_action_id)
        if not action:
            raise DataNotFoundException(
                f"Designated action with id {designated_action_id} not found"
            )

        new_analyst_id = data.assigned_analyst_id
        if new_analyst_id is not None:
            analysts = await self.repo.get_active_ia_analysts()
            if new_analyst_id not in {a.user_profile_id for a in analysts}:
                raise HTTPException(
                    status_code=400,
                    detail="assigned_analyst_id is not an active IA analyst.",
                )

        old_analyst_id = action.assigned_analyst_id
        if old_analyst_id is None and new_analyst_id is not None:
            event = EVENT_ANALYST_ASSIGNED
        elif old_analyst_id is not None and new_analyst_id is None:
            event = EVENT_ANALYST_UNASSIGNED
        elif old_analyst_id != new_analyst_id:
            event = EVENT_ANALYST_REASSIGNED
        else:
            # No change; do not write a history row for a no-op.
            return DesignatedActionSchema.model_validate(action)

        action.assigned_analyst_id = new_analyst_id
        display_name = " ".join(
            p for p in (user.first_name, user.last_name) if p
        ).strip()
        await self.repo.add_designated_action_history(
            DesignatedActionHistory(
                designated_action_id=action.designated_action_id,
                designated_action_group_uuid=action.group_uuid,
                event=event,
                user_profile_id=getattr(user, "user_profile_id", None),
                display_name=display_name or None,
                snapshot={
                    "from_analyst_id": old_analyst_id,
                    "to_analyst_id": new_analyst_id,
                },
            )
        )
        refreshed = await self.repo.get_designated_action_by_id(designated_action_id)
        return DesignatedActionSchema.model_validate(refreshed)

    @service_handler
    async def update_initiative_agreement(
        self, initiative_agreement_data: InitiativeAgreementCreateSchema
    ) -> InitiativeAgreementSchema:
        """Update an existing initiative agreement."""
        # Fetch the existing initiative agreement
        initiative_agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_data.initiative_agreement_id
        )
        if not initiative_agreement:
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_data.initiative_agreement_id} not found"
            )

        # Fetch the new status
        new_status = await self.repo.get_initiative_agreement_status_by_name(
            initiative_agreement_data.current_status
        )
        status_has_changed = initiative_agreement.current_status != new_status

        # Update the fields except for 'current_status'
        for field, value in initiative_agreement_data.dict(exclude_unset=True).items():
            if field != "current_status":
                setattr(initiative_agreement, field, value)

        # Initialize status flags
        returned, re_recommended = False, False

        if status_has_changed:
            initiative_agreement.current_status = new_status

            # Issue compliance units by Director if status is approved
            if new_status.status == InitiativeAgreementStatusEnum.Approved:
                await self.director_approve_initiative_agreement(initiative_agreement)

            # Check previous recommended status
            previous_recommended = any(
                history.initiative_agreement_status.status
                == InitiativeAgreementStatusEnum.Recommended
                for history in initiative_agreement.history
            )

            if previous_recommended:
                if new_status.status == InitiativeAgreementStatusEnum.Draft:
                    returned = True
                elif new_status.status == InitiativeAgreementStatusEnum.Recommended:
                    re_recommended = True

            # Update or add history record based on status flags
            history_method = (
                self.repo.update_initiative_agreement_history
                if re_recommended
                else self.repo.add_initiative_agreement_history
            )
            # We only track history changes on Recommended and Approved, not Draft
            if new_status.status != InitiativeAgreementStatusEnum.Draft:
                await history_method(
                    CreateInitiativeAgreementHistorySchema(
                        initiative_agreement_id=initiative_agreement.initiative_agreement_id,
                        initiative_agreement_status_id=new_status.initiative_agreement_status_id,
                        user_profile_id=self.request.user.user_profile_id,
                        display_name=(
                            f"{self.request.user.first_name} {self.request.user.last_name}"
                        ),
                    )
                )

        # Save the updated initiative agreement
        updated_initiative_agreement = await self.repo.update_initiative_agreement(
            initiative_agreement
        )

        # Return the updated initiative agreement schema with the returned status flag
        ia_schema = InitiativeAgreementSchema.from_orm(updated_initiative_agreement)
        ia_schema.returned = returned
        await self._perform_notification_call(updated_initiative_agreement, returned)
        return ia_schema

    @service_handler
    async def create_initiative_agreement(
        self, initiative_agreement_data: InitiativeAgreementCreateSchema
    ) -> InitiativeAgreementSchema:
        """
        Handles creating an initiative agreement, including creating a comment (if provided).
        """
        current_status = await self.repo.get_initiative_agreement_status_by_name(
            initiative_agreement_data.current_status
        )

        initiative_agreement = InitiativeAgreement(
            **initiative_agreement_data.model_dump(
                exclude={"current_status", "internal_comment"}
            )
        )

        initiative_agreement.current_status = current_status

        initiative_agreement = await self.repo.create_initiative_agreement(
            initiative_agreement
        )

        # If we skip draft on create and recommend then add history record
        if current_status.status == InitiativeAgreementStatusEnum.Recommended:
            await self.repo.add_initiative_agreement_history(
                CreateInitiativeAgreementHistorySchema(
                    initiative_agreement_id=initiative_agreement.initiative_agreement_id,
                    initiative_agreement_status_id=current_status.initiative_agreement_status_id,
                    user_profile_id=self.request.user.user_profile_id,
                    display_name=(
                        f"{self.request.user.first_name} {self.request.user.last_name}"
                    ),
                )
            )

        # Create internal comment if provided
        if initiative_agreement_data.internal_comment:
            internal_comment_data = InternalCommentCreateSchema(
                entity_type=EntityTypeEnum.INITIATIVE_AGREEMENT,
                entity_id=initiative_agreement.initiative_agreement_id,
                comment=initiative_agreement_data.internal_comment,
                audience_scope=AudienceScopeEnum.ANALYST,
            )
            await self.internal_comment_service.create_internal_comment(
                internal_comment_data
            )
        await self._perform_notification_call(initiative_agreement)
        return initiative_agreement

    async def director_approve_initiative_agreement(
        self, initiative_agreement: InitiativeAgreement
    ):
        """Create ledger transaction for approved initiative agreement"""

        user = self.request.user
        has_director_role = user_has_roles(user, [RoleEnum.DIRECTOR])

        if not has_director_role:
            logger.error(
                "Non-Director tried to approve Agreement",
                initiative_agreement_id=initiative_agreement.initiative_agreement_id,
            )
            raise HTTPException(status_code=403, detail="Forbidden.")

        if initiative_agreement.transaction != None:
            raise HTTPException(status_code=422, detail="Transaction already exists.")

        # Create new transaction for receiving organization
        to_transaction = await self.org_service.adjust_balance(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=initiative_agreement.compliance_units,
            organization_id=initiative_agreement.to_organization_id,
        )
        initiative_agreement.transaction = to_transaction

        # Set effective date to today if the analyst left it blank
        if initiative_agreement.transaction_effective_date is None:
            initiative_agreement.transaction_effective_date = datetime.now(
                timezone.utc
            ).date()

        await self.repo.refresh_initiative_agreement(initiative_agreement)

    async def _perform_notification_call(self, ia, returned=False):
        """Send notifications based on the current status of the transfer."""
        status = ia.current_status.status if not returned else "Return to analyst"
        status_val = (
            status.value
            if isinstance(status, InitiativeAgreementStatusEnum)
            else status
        ).lower()
        notifications = INITIATIVE_AGREEMENT_STATUS_NOTIFICATION_MAPPER.get(
            status, None
        )
        message_data = {
            "service": "InitiativeAgreement",
            "id": ia.initiative_agreement_id,
            "transactionId": ia.transaction_id,
            "status": status_val,
        }
        notification_data = NotificationMessageSchema(
            type=f"Initiative agreement {status_val}",
            related_transaction_id=f"IA{ia.initiative_agreement_id}",
            message=json.dumps(message_data),
            related_organization_id=ia.to_organization_id,
            origin_user_profile_id=self.request.user.user_profile_id,
        )
        if notifications and isinstance(notifications, list):
            await self.notfn_service.send_notification(
                NotificationRequestSchema(
                    notification_types=notifications,
                    notification_data=notification_data,
                )
            )

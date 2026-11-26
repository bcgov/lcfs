import json
import math
from datetime import datetime, timezone
from decimal import Decimal
from html import unescape
from typing import List, Optional

import nh3
import structlog
from fastapi import Depends, HTTPException, Request
from pydantic.alias_generators import to_camel

from lcfs.db.models.initiative_agreement.DesignatedAction import DesignatedAction
from lcfs.db.models.initiative_agreement.InitiativeAgreementChangeOrder import (
    CHANGE_ORDER_STATUS_ACCEPTED,
    CHANGE_ORDER_STATUS_DRAFT,
)
from lcfs.db.models.initiative_agreement.DesignatedActionHistory import (
    EVENT_ANALYST_ASSIGNED,
    EVENT_ANALYST_REASSIGNED,
    EVENT_ANALYST_UNASSIGNED,
    EVENT_CREDITS_ISSUED,
    EVENT_DETAILS_EDITED,
    DesignatedActionHistory,
)
from lcfs.db.models.initiative_agreement.EvidenceRequirement import (
    REVIEW_OUTCOME_INFORMATION_REQUESTED,
    REVIEW_OUTCOME_SATISFACTORY,
    REVIEW_OUTCOMES,
    EvidenceRequirement,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    AGREEMENT_TYPES,
    RECORD_KIND_AGREEMENT,
    RECORD_KIND_LEGACY_AWARD,
    InitiativeAgreement,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementLifecycleHistory import (
    InitiativeAgreementLifecycleHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementNote import (
    InitiativeAgreementNote,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.utils.dates import PACIFIC_TZ
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    SortOrder,
    validate_pagination,
)
from lcfs.web.api.initiative_agreement.change_order import (
    AGREEMENT,
    DESIGNATED_ACTION,
    EVIDENCE_REQUIREMENT,
    NOTE,
    RECORD_TYPES,
    ChangeOrderService,
    ChangeOrderView,
    check_issued_credits,
    is_removed,
)
from lcfs.web.api.initiative_agreement.repo import InitiativeAgreementRepository
from lcfs.web.api.initiative_agreement.schema import (
    AllDesignatedActionsListSchema,
    AssignedAnalystSchema,
    DesignatedActionListItemSchema,
    AgreementCreateSchema,
    AgreementUpdateSchema,
    AnalystAssignmentSchema,
    ChangeOrderSchema,
    CreateInitiativeAgreementHistorySchema,
    DesignatedActionCreateSchema,
    DesignatedActionHistorySchema,
    DesignatedActionProfileSchema,
    DesignatedActionSchema,
    DesignatedActionsListSchema,
    DesignatedActionUpdateSchema,
    DesignatedActionWorkflowSchema,
    EvidenceRequirementCreateSchema,
    EvidenceRequirementSchema,
    EvidenceRequirementUpdateSchema,
    IAAnalystSchema,
    InitiativeAgreementCreateSchema,
    InitiativeAgreementListItemSchema,
    InitiativeAgreementNoteCreateSchema,
    InitiativeAgreementNoteSchema,
    InitiativeAgreementNoteUpdateSchema,
    InitiativeAgreementProfileSchema,
    InitiativeAgreementSchema,
    InitiativeAgreementsListSchema,
    LastCommentSchema,
    OrganizationSchema,
    RecordVersionSchema,
)
from lcfs.web.api.initiative_agreement.workflow import (
    ACTION_APPROVE,
    LIFECYCLE_STATUS_UNDERWAY,
    LIFECYCLE_STATUSES_SETTABLE_UNDERWAY,
    PACKAGE_EDITOR_ROLES,
    SET_UNDERWAY_ROLES,
    STATUS_APPROVED,
    STATUS_NOT_STARTED,
    TRANSITIONS,
    WORKFLOW_ACTIONS,
    change_order_actions,
    ensure_package_editable,
    has_any_role,
    hidden_lifecycle_statuses,
    initial_lifecycle_status,
    is_government,
    is_hidden_from,
    is_package_editable,
    lifecycle_status_aliases,
)
from lcfs.web.api.internal_comment.schema import (
    AudienceScopeEnum,
    EntityTypeEnum,
    InternalCommentCreateSchema,
)
from lcfs.web.api.internal_comment.services import (
    InternalCommentService,
    sanitize_comment_text,
)
from lcfs.web.api.notification.schema import (
    INITIATIVE_AGREEMENT_STATUS_NOTIFICATION_MAPPER,
    NotificationMessageSchema,
    NotificationRequestSchema,
)
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.organizations.services import OrganizationsService
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = structlog.get_logger(__name__)

# Upper bound on grid page size; the frontend asks for 25.
MAX_PAGE_SIZE = 200

# Mirrors the allow-list the client enforces in sanitizeCommentHtml.ts. The
# client sanitizes before save and display, but an API caller can bypass it,
# so the server re-sanitizes before persistence.
_NOTE_ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "u",
    "ul",
}
_NOTE_ALLOWED_ATTRIBUTES = {"*": {"class", "href", "rel", "target", "title"}}


def _sanitize_note_html(note_text: Optional[str]) -> str:
    """The note HTML with any markup outside the rich-text allow-list
    stripped."""
    if not note_text:
        return ""
    return nh3.clean(
        note_text,
        tags=_NOTE_ALLOWED_TAGS,
        attributes=_NOTE_ALLOWED_ATTRIBUTES,
        link_rel=None,
    )


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
        transaction_repo: TransactionRepository = Depends(TransactionRepository),
    ) -> None:
        self.repo = repo
        self.org_service = org_service
        self.internal_comment_service = internal_comment_service
        self.request = request
        self.notfn_service = notfn_service
        self.transaction_repo = transaction_repo

    @property
    def change_orders(self) -> ChangeOrderService:
        """Change-order staging, acceptance and the IDIR view of an open
        change order (#5555), on this request's session."""
        service = getattr(self, "_change_orders", None)
        if service is None:
            service = self._change_orders = ChangeOrderService(self.repo.db)
        return service

    def _caller(self):
        return self.request.user if self.request else None

    async def _shown_lifecycle_status(self, lifecycle_status, user):
        """The lifecycle status as this user sees it: an organization sees a
        change order draft as Underway (#5555)."""
        if lifecycle_status is None:
            return None
        alias = lifecycle_status_aliases(user).get(lifecycle_status.status)
        if alias is None:
            return lifecycle_status
        cache = getattr(self, "_lifecycle_alias_cache", None)
        if cache is None:
            cache = self._lifecycle_alias_cache = {}
        if alias not in cache:
            cache[alias] = await self.repo.get_lifecycle_status_by_name(alias)
        return cache[alias] or lifecycle_status

    async def _change_order_of_action(self, action):
        """The open change order of the action's agreement, if any."""
        return await self.change_orders.open_change_order_for(
            action.initiative_agreement
        )

    @staticmethod
    def _require_not_pending(action) -> None:
        """An action a change order added is not part of the agreement until
        the Director accepts it, so it can't be worked yet."""
        if action.pending_change_order_id is not None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This designated action was added in a change order and "
                    "can't be worked until the Director accepts it."
                ),
            )

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
        rows, total_count = await self.repo.get_initiative_agreements_paginated(
            pagination,
            organization_id,
            hidden_statuses=hidden_lifecycle_statuses(user),
            status_aliases=lifecycle_status_aliases(user),
        )
        # Non-government callers never receive internal comment text.
        latest_comments = await self.repo.get_latest_comments_by_agreement_ids(
            [agreement.initiative_agreement_id for agreement, _, _ in rows],
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
                    **{
                        **self._list_item_kwargs(agreement),
                        "lifecycle_status": await self._shown_lifecycle_status(
                            agreement.lifecycle_status, user
                        ),
                    },
                    total_credits=total_credits,
                    awarded_credits=awarded_credits,
                    last_comment=self._last_comment_payload(
                        latest_comments, agreement.initiative_agreement_id
                    ),
                )
                for agreement, total_credits, awarded_credits in rows
            ],
        )

    @service_handler
    async def get_lifecycle_statuses(self):
        """Lifecycle statuses for the agreement grid's status filter, less
        any the caller does not see, or sees under another name (#5555)."""
        user = self._caller()
        hidden = set(hidden_lifecycle_statuses(user)) | set(
            lifecycle_status_aliases(user)
        )
        return [
            lifecycle_status
            for lifecycle_status in await self.repo.get_lifecycle_statuses()
            if lifecycle_status.status not in hidden
        ]

    @service_handler
    async def get_initiative_agreement_profile(
        self, initiative_agreement_id: int
    ) -> InitiativeAgreementProfileSchema:
        """Agreement profile with its designated actions for the detail page.

        An organization reads the accepted package. IDIR staff reading an
        agreement in a change order draft see it as the change order would
        leave it, each record marked with how it changed (#5555)."""
        agreement = await self.repo.get_initiative_agreement_profile(
            initiative_agreement_id
        )
        if not agreement:
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        user = self._caller()
        view = await self.change_orders.view_for(agreement, user)
        designated_actions = await self.repo.get_current_designated_actions(
            initiative_agreement_id, include_change_order_id=view.change_order_id
        )
        profile = InitiativeAgreementProfileSchema(
            **{
                **self._list_item_kwargs(agreement),
                "lifecycle_status": await self._shown_lifecycle_status(
                    agreement.lifecycle_status, user
                ),
            },
            project_description=agreement.project_description,
            project_location=agreement.project_location,
            contact_email=agreement.contact_email,
            contact_phone=agreement.contact_phone,
            create_date=agreement.create_date,
            designated_actions=[
                view.apply(
                    DESIGNATED_ACTION,
                    action,
                    DesignatedActionSchema.model_validate(action),
                )
                for action in designated_actions
            ],
            change_order=(
                ChangeOrderSchema.model_validate(view.change_order)
                if view.change_order is not None
                else None
            ),
            change_order_actions=change_order_actions(
                (
                    agreement.lifecycle_status.status
                    if agreement.lifecycle_status
                    else None
                ),
                user,
            ),
            package_editable=is_package_editable(agreement),
        )
        return view.apply(AGREEMENT, agreement, profile)

    @service_handler
    async def create_agreement(
        self,
        data: AgreementCreateSchema,
        user,
    ) -> InitiativeAgreementProfileSchema:
        """Start a new agreement.

        The record is deliberately thin at birth: an analyst opening a file
        typically has the agreement code and little else, sometimes not
        even the organization (#5186). Everything else is filled in as the
        agreement is negotiated.

        The starting lifecycle status depends on who creates it (see
        INITIAL_LIFECYCLE_STATUS_RULES). An agreement government enters
        starts as a Draft, hidden from the organization until a Director
        sets it Underway (#5553).
        """
        if data.organization_id is not None:
            organization = await self.org_service.get_organization(data.organization_id)
            if not organization:
                raise DataNotFoundException(
                    f"Organization with id {data.organization_id} not found"
                )

        ia_code = (data.ia_code or "").strip()
        if not ia_code:
            raise HTTPException(
                status_code=400, detail="An initiative agreement code is required."
            )
        if await self.repo.get_agreement_by_ia_code(ia_code):
            raise HTTPException(
                status_code=400,
                detail=f"Agreement code '{ia_code}' is already in use.",
            )

        if data.agreement_type not in AGREEMENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"'{data.agreement_type}' is not a valid agreement type.",
            )

        if (
            data.agreement_start_date
            and data.agreement_end_date
            and data.agreement_end_date < data.agreement_start_date
        ):
            raise HTTPException(
                status_code=400,
                detail="The agreement end date cannot precede its start date.",
            )

        status_name = initial_lifecycle_status(user)
        if status_name is None:
            raise HTTPException(
                status_code=403,
                detail="You are not permitted to start an initiative agreement.",
            )
        lifecycle_status = await self.repo.get_lifecycle_status_by_name(status_name)
        if lifecycle_status is None:
            raise HTTPException(
                status_code=500,
                detail=f"Lifecycle status '{status_name}' is not configured.",
            )

        username = getattr(user, "keycloak_username", None)
        agreement = await self.repo.add_agreement(
            InitiativeAgreement(
                record_kind=RECORD_KIND_AGREEMENT,
                to_organization_id=data.organization_id,
                ia_code=ia_code,
                agreement_type=data.agreement_type,
                title=(data.title or None),
                project_description=(data.project_description or None),
                project_location=(data.project_location or None),
                contact_name=(data.contact_name or None),
                contact_email=(data.contact_email or None),
                contact_phone=(data.contact_phone or None),
                entry_date=datetime.now(timezone.utc).date(),
                agreement_start_date=data.agreement_start_date,
                agreement_end_date=data.agreement_end_date,
                lifecycle_status_id=(
                    lifecycle_status.initiative_agreement_lifecycle_status_id
                ),
                create_user=username,
                update_user=username,
            )
        )
        # The status history starts with the status the agreement was
        # created in; the table's audit trigger records the insert itself.
        await self._record_lifecycle_status(agreement, lifecycle_status, user)
        return await self.get_initiative_agreement_profile(
            agreement.initiative_agreement_id
        )

    async def _record_lifecycle_status(self, agreement, lifecycle_status, user):
        """Append the status the agreement just entered, and who put it
        there, to its lifecycle history."""
        username = getattr(user, "keycloak_username", None)
        display_name = " ".join(
            p
            for p in (getattr(user, "first_name", ""), getattr(user, "last_name", ""))
            if p
        ).strip()
        await self.repo.add_lifecycle_history(
            InitiativeAgreementLifecycleHistory(
                initiative_agreement_id=agreement.initiative_agreement_id,
                lifecycle_status_id=(
                    lifecycle_status.initiative_agreement_lifecycle_status_id
                ),
                user_profile_id=getattr(user, "user_profile_id", None),
                display_name=display_name or None,
                create_user=username,
                update_user=username,
            )
        )

    @service_handler
    async def set_agreement_underway(
        self, initiative_agreement_id: int, user
    ) -> InitiativeAgreementProfileSchema:
        """Release a completed draft package to its organization (#5553).

        Only a Director may do it, and only from Draft. The package (the
        agreement, its notes, designated actions and evidence requirements)
        has one lifecycle, the agreement's, so this single update moves all
        of it and can never leave part of it behind. The history row records
        who did it and when, in the same transaction.

        The agreement's row is locked first, so two Directors confirming at
        once cannot both move it and record the change twice.
        """
        if not any(user_has_roles(user, [role]) for role in SET_UNDERWAY_ROLES):
            raise HTTPException(
                status_code=403,
                detail="Only a Director can set an initiative agreement to Underway.",
            )

        agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id, for_update=True
        )
        if (
            not agreement
            or agreement.record_kind != RECORD_KIND_AGREEMENT
            or is_hidden_from(agreement, user)
        ):
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )

        lifecycle = (
            agreement.lifecycle_status.status if agreement.lifecycle_status else None
        )
        if lifecycle not in LIFECYCLE_STATUSES_SETTABLE_UNDERWAY:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only a draft agreement can be set to Underway; this one "
                    f"is '{lifecycle or 'not set'}'."
                ),
            )
        # Underway opens the package to the organization, and the edit that
        # would fill in a missing organization is closed after it.
        if agreement.to_organization_id is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Set the agreement's organization before setting it to Underway."
                ),
            )

        underway = await self.repo.get_lifecycle_status_by_name(
            LIFECYCLE_STATUS_UNDERWAY
        )
        if underway is None:
            raise HTTPException(
                status_code=500,
                detail=f"Lifecycle status '{LIFECYCLE_STATUS_UNDERWAY}' is not configured.",
            )

        agreement.lifecycle_status = underway
        agreement.update_user = getattr(user, "keycloak_username", None)
        await self.repo.db.flush()
        await self._record_lifecycle_status(agreement, underway, user)
        return await self.get_initiative_agreement_profile(initiative_agreement_id)

    @service_handler
    async def update_agreement(
        self,
        initiative_agreement_id: int,
        data: AgreementUpdateSchema,
        user,
    ) -> InitiativeAgreementProfileSchema:
        """Edit an agreement's details while its package is open to edits
        (#5554). A draft is hidden from anyone outside government (#5553),
        so it reads as missing to them here too.

        In a change order draft the edit is staged as the change order's
        version of the details; the organization keeps the accepted ones
        until the Director accepts (#5555)."""
        agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        if (
            not agreement
            or agreement.record_kind != RECORD_KIND_AGREEMENT
            or is_hidden_from(agreement, user)
        ):
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        change_order = await self.change_orders.open_change_order_for(agreement)
        ensure_package_editable(agreement, user)

        provided = data.model_fields_set

        # An agreement may be saved before its organization is known (#5186).
        # The organization can be filled in later, but once set it stays:
        # credits the agreement issues go to that organization. It is not
        # versioned: filling in a blank is not an amendment.
        if (
            "organization_id" in provided
            and data.organization_id != agreement.to_organization_id
        ):
            if agreement.to_organization_id is not None:
                raise HTTPException(
                    status_code=400,
                    detail="The agreement's organization is already set and cannot be changed.",
                )
            agreement.to_organization = await self.org_service.get_organization(
                data.organization_id
            )

        values = (
            await self.change_orders.working_values(change_order, AGREEMENT, agreement)
            if change_order is not None
            else AGREEMENT.live_values(agreement)
        )
        changes = {}

        if "ia_code" in provided:
            ia_code = (data.ia_code or "").strip()
            if not ia_code:
                raise HTTPException(
                    status_code=400,
                    detail="An initiative agreement code is required.",
                )
            if ia_code.lower() != (values["ia_code"] or "").lower():
                existing = await self.repo.get_agreement_by_ia_code(ia_code)
                if existing and (
                    existing.initiative_agreement_id
                    != agreement.initiative_agreement_id
                ):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Agreement code '{ia_code}' is already in use.",
                    )
            changes["ia_code"] = ia_code

        if "agreement_type" in provided and data.agreement_type is not None:
            if data.agreement_type not in AGREEMENT_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{data.agreement_type}' is not a valid agreement type.",
                )
            changes["agreement_type"] = data.agreement_type

        for field in (
            "title",
            "project_description",
            "project_location",
            "contact_name",
            "contact_email",
            "contact_phone",
        ):
            if field in provided:
                value = getattr(data, field)
                changes[field] = (value or "").strip() or None

        if "agreement_start_date" in provided:
            changes["agreement_start_date"] = data.agreement_start_date
        if "agreement_end_date" in provided:
            changes["agreement_end_date"] = data.agreement_end_date

        start_date = changes.get("agreement_start_date", values["agreement_start_date"])
        end_date = changes.get("agreement_end_date", values["agreement_end_date"])
        if start_date and end_date and end_date < start_date:
            raise HTTPException(
                status_code=400,
                detail="The agreement end date cannot precede its start date.",
            )

        if change_order is not None:
            await self.change_orders.stage_update(
                change_order, AGREEMENT, agreement, changes, user
            )
        else:
            for field, value in changes.items():
                setattr(agreement, field, value)
            agreement.update_user = getattr(user, "keycloak_username", None)
        await self.repo.db.flush()
        return await self.get_initiative_agreement_profile(initiative_agreement_id)

    @service_handler
    async def create_designated_action(
        self,
        initiative_agreement_id: int,
        data: DesignatedActionCreateSchema,
        user,
    ) -> DesignatedActionSchema:
        """Add a designated action while the agreement's package is open to
        edits (#5554).

        An analyst sets out the schedule while government prepares the
        agreement as a Draft (#5553). Once it is Underway, a new action
        comes through a change order, and waits for the Director's
        acceptance before the organization sees it (#5555).
        """
        agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        if not agreement or is_hidden_from(agreement, user):
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        ensure_package_editable(agreement, user)
        change_order = await self.change_orders.open_change_order_for(agreement)

        name = (data.name or "").strip()
        if not name:
            raise HTTPException(
                status_code=400, detail="A designated action name is required."
            )

        credits = data.credit_allocation
        if credits is not None and credits < 0:
            raise HTTPException(
                status_code=400,
                detail="Compliance units to be issued cannot be negative.",
            )

        not_started = await self.repo.get_designated_action_status_by_name(
            STATUS_NOT_STARTED
        )
        if not_started is None:
            raise HTTPException(
                status_code=500,
                detail=f"Status '{STATUS_NOT_STARTED}' is not configured.",
            )

        username = getattr(user, "keycloak_username", None)
        action = await self.repo.add_designated_action(
            DesignatedAction(
                initiative_agreement_id=initiative_agreement_id,
                action_number=await self.repo.next_action_number(
                    initiative_agreement_id
                ),
                name=name,
                description=data.description,
                credit_allocation=credits if credits is not None else 0,
                specified_date=data.specified_date,
                current_status_id=not_started.designated_action_status_id,
                pending_change_order_id=(
                    change_order.initiative_agreement_change_order_id
                    if change_order is not None
                    else None
                ),
                create_user=username,
                update_user=username,
            )
        )
        refreshed = await self.repo.get_designated_action_by_id(
            action.designated_action_id
        )
        return await self._action_schema(refreshed, user)

    @service_handler
    async def update_designated_action(
        self,
        designated_action_id: int,
        data: DesignatedActionUpdateSchema,
        user,
    ) -> DesignatedActionSchema:
        """Correct a designated action's details.

        Editable while the agreement's package is open to edits (#5554). In
        a Draft the edit applies at once and every change is recorded with
        its before and after. In a change order draft it is staged as the
        action's next version, and the history records it when the Director
        accepts (#5555).
        """
        action = await self._get_action_or_404(designated_action_id, user)
        change_order = await self._change_order_of_action(action)
        ensure_package_editable(action.initiative_agreement, user)
        current = (
            await self.change_orders.working_values(
                change_order, DESIGNATED_ACTION, action
            )
            if change_order is not None
            else DESIGNATED_ACTION.live_values(action)
        )

        changes = {}

        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise HTTPException(
                    status_code=400,
                    detail="A designated action name is required.",
                )
            if name != current["name"]:
                changes["name"] = {"from": current["name"], "to": name}

        if data.description is not None and data.description != current["description"]:
            changes["description"] = {
                "from": current["description"],
                "to": data.description,
            }

        if data.credit_allocation is not None:
            if data.credit_allocation < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Compliance units to be issued cannot be negative.",
                )
            if data.credit_allocation != current["credit_allocation"]:
                changes["credit_allocation"] = {
                    "from": current["credit_allocation"],
                    "to": data.credit_allocation,
                }

        new_date = None if data.clear_specified_date else data.specified_date
        if (data.clear_specified_date or data.specified_date is not None) and (
            new_date != current["specified_date"]
        ):
            changes["specified_date"] = {
                "from": current["specified_date"],
                "to": new_date,
            }

        if not changes:
            return await self._action_schema(action, user)

        new_values = {name: change["to"] for name, change in changes.items()}
        if change_order is not None:
            if action.pending_change_order_id is None:
                check_issued_credits(
                    action,
                    credit_allocation=new_values.get(
                        "credit_allocation", current["credit_allocation"]
                    ),
                )
            await self.change_orders.stage_update(
                change_order, DESIGNATED_ACTION, action, new_values, user
            )
        else:
            for name, value in new_values.items():
                setattr(action, name, value)
            if "specified_date" in changes:
                changes["specified_date"] = {
                    key: value.isoformat() if value else None
                    for key, value in changes["specified_date"].items()
                }
            await self.repo.add_designated_action_history(
                DesignatedActionHistory(
                    designated_action_id=action.designated_action_id,
                    designated_action_group_uuid=action.group_uuid,
                    event=EVENT_DETAILS_EDITED,
                    status_id=action.current_status_id,
                    user_profile_id=getattr(user, "user_profile_id", None),
                    display_name=self._display_name(user),
                    snapshot={"changed": changes},
                )
            )
            action.update_user = getattr(user, "keycloak_username", None)
        await self.repo.db.flush()

        refreshed = await self.repo.get_designated_action_by_id(designated_action_id)
        return await self._action_schema(refreshed, user)

    @service_handler
    async def remove_designated_action(self, designated_action_id: int, user) -> None:
        """Remove a designated action in a change order (#5555). It stays in
        the package, marked for removal, until the Director accepts; an
        action the change order itself added goes at once. Credits already
        issued for an action keep it in the package."""
        action = await self._get_action_or_404(designated_action_id, user)
        ensure_package_editable(action.initiative_agreement, user)
        change_order = await self._change_order_of_action(action)
        if change_order is None:
            raise HTTPException(
                status_code=400,
                detail=("A designated action can only be removed in a change order."),
            )
        if action.transaction_id is not None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Credits have been issued for this designated action, so it "
                    "cannot be removed."
                ),
            )
        await self.change_orders.stage_removal(
            change_order, DESIGNATED_ACTION, action, user
        )

    @staticmethod
    def _display_name(user) -> Optional[str]:
        name = " ".join(
            p
            for p in (getattr(user, "first_name", ""), getattr(user, "last_name", ""))
            if p
        ).strip()
        return name or None

    async def _action_view(self, action, user) -> ChangeOrderView:
        return await self.change_orders.view_for(action.initiative_agreement, user)

    async def _action_schema(self, action, user, schema=DesignatedActionSchema):
        """The action as this user sees it (see ChangeOrderView)."""
        view = await self._action_view(action, user)
        return view.apply(DESIGNATED_ACTION, action, schema.model_validate(action))

    @service_handler
    async def get_designated_actions_paginated(
        self, initiative_agreement_id: int, pagination: PaginationRequestSchema
    ) -> DesignatedActionsListSchema:
        """Paginated designated actions for one agreement's grid (#4896)."""
        agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        if not agreement or is_hidden_from(
            agreement, self.request.user if self.request else None
        ):
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        pagination = validate_pagination(pagination)
        pagination.size = min(pagination.size, MAX_PAGE_SIZE)
        # During a change order IDIR sees the actions as it would leave them;
        # sorting and filtering still run on the accepted values (#5555).
        view = await self.change_orders.view_for(agreement, self._caller())
        actions, total_count = await self.repo.get_designated_actions_paginated(
            initiative_agreement_id,
            pagination,
            include_change_order_id=view.change_order_id,
        )
        rows = [
            view.apply(DESIGNATED_ACTION, action, row)
            for action, row in zip(
                actions,
                await self._designated_action_rows(actions, DesignatedActionSchema),
            )
        ]
        return DesignatedActionsListSchema(
            pagination=self._pagination_response(pagination, total_count),
            designated_actions=rows,
        )

    @service_handler
    async def get_designated_action_document_targets(
        self, initiative_agreement_id: int, user
    ):
        username = getattr(user, "keycloak_username", None)
        if not username:
            raise HTTPException(status_code=403, detail="User identity is required.")
        return await self.repo.get_designated_action_document_targets(
            initiative_agreement_id, username
        )

    @service_handler
    async def get_all_designated_actions_paginated(
        self, pagination: PaginationRequestSchema
    ) -> AllDesignatedActionsListSchema:
        """Every agreement's designated actions, for the module's
        Designated actions tab (#5078). Newest activity first unless the
        caller sorts otherwise: the tab is a work queue."""
        pagination = validate_pagination(pagination)
        pagination.size = min(pagination.size, MAX_PAGE_SIZE)
        if not pagination.sort_orders:
            pagination.sort_orders = [SortOrder(field="update_date", direction="desc")]
        actions, total_count = await self.repo.get_designated_actions_paginated(
            None,
            pagination,
            hidden_statuses=hidden_lifecycle_statuses(
                self.request.user if self.request else None
            ),
        )
        rows = await self._designated_action_rows(
            actions, DesignatedActionListItemSchema
        )
        for row, action in zip(rows, actions):
            agreement = action.initiative_agreement
            row.ia_code = agreement.ia_code if agreement else None
            # The agreement's organization, for the tab's column (#5203).
            row.organization = (
                OrganizationSchema.model_validate(agreement.to_organization)
                if agreement and agreement.to_organization
                else None
            )
        return AllDesignatedActionsListSchema(
            pagination=self._pagination_response(pagination, total_count),
            designated_actions=rows,
        )

    @staticmethod
    def _pagination_response(pagination, total_count) -> PaginationResponseSchema:
        return PaginationResponseSchema(
            total=total_count,
            page=pagination.page,
            size=pagination.size,
            total_pages=(
                math.ceil(total_count / pagination.size) if pagination.size else 0
            ),
        )

    async def _designated_action_rows(self, actions, schema):
        """Grid rows with each action's newest comment attached.

        Both grids are IDIR-only, so internal comments are visible.
        """
        latest_comments = await self.repo.get_latest_comments_by_designated_action_ids(
            actions, include_internal=True
        )
        rows = []
        for action in actions:
            row = schema.model_validate(action)
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
        return rows

    @service_handler
    async def get_designated_action_profile(
        self, designated_action_id: int
    ) -> DesignatedActionProfileSchema:
        """The action detail page's record (#4840), as the caller sees it
        during a change order (#5555)."""
        action = await self._get_action_or_404(designated_action_id)
        user = self._caller()
        view = await self._action_view(action, user)
        siblings = await self.repo.get_current_designated_actions(
            action.initiative_agreement_id,
            include_change_order_id=view.change_order_id,
        )
        base = view.apply(
            DESIGNATED_ACTION, action, DesignatedActionSchema.model_validate(action)
        )
        return DesignatedActionProfileSchema(
            **base.model_dump(),
            initiative_agreement_id=action.initiative_agreement_id,
            ia_code=action.initiative_agreement.ia_code,
            sibling_action_ids=[s.designated_action_id for s in siblings],
            available_actions=self._available_actions(action, user),
            change_order_number=(
                view.change_order.change_order_number
                if view.change_order is not None
                else None
            ),
            package_editable=is_package_editable(action.initiative_agreement),
            agreement_lifecycle_status=(
                action.initiative_agreement.lifecycle_status.status
                if action.initiative_agreement.lifecycle_status
                else None
            ),
        )

    async def _get_action_or_404(
        self, designated_action_id: int, user=None, *, for_update: bool = False
    ) -> DesignatedAction:
        """The action, unless it is missing or its agreement is hidden from
        the caller. Every route to an action comes through here, so a
        draft's actions read as missing to the organization everywhere,
        not only on the profile (#5553)."""
        if user is None and self.request:
            user = self.request.user
        action = await self.repo.get_designated_action_by_id(
            designated_action_id, for_update=for_update
        )
        if (
            not action
            or is_hidden_from(action.initiative_agreement, user)
            or (not is_government(user) and not self._in_accepted_package(action))
        ):
            raise DataNotFoundException(
                f"Designated action with id {designated_action_id} not found"
            )
        return action

    @staticmethod
    def _in_accepted_package(action) -> bool:
        """An organization sees only actions in the accepted package: not
        one a change order has added and not had accepted, nor a removed
        one (#5555)."""
        return action.pending_change_order_id is None and not is_removed(
            DESIGNATED_ACTION, action
        )

    async def _get_requirement_or_404(self, evidence_requirement_id: int, user):
        """The evidence requirement and its action, unless it is missing or
        its action is hidden from the caller (see _get_action_or_404)."""
        requirement = await self.repo.get_evidence_requirement(evidence_requirement_id)
        action = (
            await self.repo.get_designated_action_by_id(
                requirement.designated_action_id
            )
            if requirement
            else None
        )
        if (
            not action
            or is_hidden_from(action.initiative_agreement, user)
            or (
                not is_government(user)
                and (
                    not self._in_accepted_package(action)
                    or requirement.pending_change_order_id is not None
                )
            )
        ):
            raise DataNotFoundException(
                f"Evidence requirement with id {evidence_requirement_id} not found"
            )
        return requirement, action

    def _user_may(self, transition, user) -> bool:
        return any(user_has_roles(user, [role]) for role in transition.roles)

    def _available_actions(self, action, user) -> List[str]:
        """Actions this caller may take on this action right now. An action
        a change order added has none until it is accepted."""
        if user is None or action.pending_change_order_id is not None:
            return []
        current = action.current_status.status if action.current_status else None
        return [
            name
            for name, transition in TRANSITIONS.items()
            if self._user_may(transition, user) and current in transition.from_statuses
        ]

    async def _evidence_snapshot(self, designated_action_id: int) -> dict:
        """Every requirement's review exactly as it stands.

        Stored on the history event so a round's findings survive the next
        one — requesting more information must never be the reason an
        earlier assessment becomes unreadable.
        """
        requirements = await self.repo.get_evidence_requirements(designated_action_id)
        return {
            "evidence_requirements": [
                {
                    "evidence_requirement_id": r.evidence_requirement_id,
                    "requirement_number": r.requirement_number,
                    "title": r.title,
                    "description": r.description,
                    "analyst_review": r.analyst_review,
                    "review_outcome": r.review_outcome,
                    "review_notes": r.review_notes,
                    "missing_information": r.missing_information,
                    "reviewed_date": (
                        r.reviewed_date.isoformat() if r.reviewed_date else None
                    ),
                }
                for r in requirements
            ]
        }

    async def _all_evidence_satisfactory(self, designated_action_id: int) -> bool:
        requirements = await self.repo.get_evidence_requirements(designated_action_id)
        if not requirements:
            return False
        return all(
            r.review_outcome == REVIEW_OUTCOME_SATISFACTORY for r in requirements
        )

    @service_handler
    async def set_recommended_credits(
        self, designated_action_id: int, credits: Optional[int], user
    ) -> DesignatedActionSchema:
        """Persist the analyst's recommended amount before they recommend.

        No history event: this is a working value until a recommendation is
        actually made, and that event records the figure that counted.
        """
        action = await self._get_action_or_404(
            designated_action_id, user, for_update=True
        )
        self._require_not_pending(action)
        if action.transaction_id is not None or (
            action.current_status and action.current_status.status == STATUS_APPROVED
        ):
            raise HTTPException(
                status_code=400,
                detail="Recommended credits cannot be changed after approval.",
            )
        if credits is not None:
            if credits < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Recommended credits cannot be negative.",
                )
            if (
                action.credit_allocation is not None
                and credits > action.credit_allocation
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Recommended credits cannot exceed the "
                        f"{action.credit_allocation} allocated to this action."
                    ),
                )
        action.recommended_credits = credits
        action.update_user = getattr(user, "keycloak_username", None)
        await self.repo.db.flush()
        refreshed = await self.repo.get_designated_action_by_id(designated_action_id)
        return DesignatedActionSchema.model_validate(refreshed)

    @service_handler
    async def perform_workflow_action(
        self, designated_action_id: int, data: DesignatedActionWorkflowSchema, user
    ) -> DesignatedActionSchema:
        """Advance a designated action through its review workflow (#4898)."""
        # Hold through issuance to serialize approvals and returns.
        action = await self._get_action_or_404(
            designated_action_id, user, for_update=True
        )
        self._require_not_pending(action)

        transition = TRANSITIONS.get(data.action)
        if transition is None:
            raise HTTPException(
                status_code=400,
                detail="action must be one of: " + ", ".join(WORKFLOW_ACTIONS),
            )
        if not self._user_may(transition, user):
            raise HTTPException(
                status_code=403,
                detail="Your role may not take this action.",
            )

        current = action.current_status.status if action.current_status else None
        if current not in transition.from_statuses:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"A designated action that is '{current}' cannot be "
                    f"'{data.action}'."
                ),
            )

        comment = (data.comment or "").strip()
        if transition.uses_missing_information:
            requirements = await self.repo.get_evidence_requirements(
                designated_action_id
            )
            requested = [
                requirement
                for requirement in requirements
                if requirement.review_outcome == REVIEW_OUTCOME_INFORMATION_REQUESTED
            ]
            if not requested:
                raise HTTPException(
                    status_code=400,
                    detail="Mark at least one EOC as Request information first.",
                )
            if any(
                not unescape(sanitize_comment_text(r.missing_information)).strip()
                for r in requested
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Enter Missing information for every EOC marked "
                        "Request information."
                    ),
                )
            comment = "\n\n".join(
                f"EOC {r.requirement_number} - {r.title or r.description}: "
                f"{r.missing_information.strip()}"
                for r in requested
            )
        if transition.requires_comment and not comment:
            raise HTTPException(
                status_code=400,
                detail="This action requires a comment explaining it.",
            )

        if transition.requires_all_evidence_satisfactory:
            if not await self._all_evidence_satisfactory(designated_action_id):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Every evidence requirement must be marked satisfactory "
                        "first."
                    ),
                )

        if transition.requires_credits:
            credits = (
                data.recommended_credits
                if data.recommended_credits is not None
                else action.recommended_credits
            )
            if credits is None:
                raise HTTPException(
                    status_code=400,
                    detail="A recommended credit amount is required.",
                )
            await self.set_recommended_credits(designated_action_id, credits, user)
            action = await self.repo.get_designated_action_by_id(designated_action_id)

        snapshot = {}
        if comment:
            snapshot["comment"] = comment
        if transition.captures_evidence:
            snapshot.update(await self._evidence_snapshot(designated_action_id))
        if transition.requires_credits:
            snapshot["recommended_credits"] = action.recommended_credits

        status_id = action.current_status_id
        if transition.to_status is not None:
            new_status = await self.repo.get_designated_action_status_by_name(
                transition.to_status
            )
            if new_status is None:
                raise HTTPException(
                    status_code=500,
                    detail=f"Status '{transition.to_status}' is not configured.",
                )
            action.current_status_id = new_status.designated_action_status_id
            status_id = new_status.designated_action_status_id

        display_name = " ".join(
            p
            for p in (getattr(user, "first_name", ""), getattr(user, "last_name", ""))
            if p
        ).strip()
        await self.repo.add_designated_action_history(
            DesignatedActionHistory(
                designated_action_id=action.designated_action_id,
                designated_action_group_uuid=action.group_uuid,
                event=transition.event,
                status_id=status_id,
                user_profile_id=getattr(user, "user_profile_id", None),
                display_name=display_name or None,
                snapshot=snapshot or None,
            )
        )
        if data.action == ACTION_APPROVE:
            await self._issue_designated_action_credits(action, user, display_name)
        action.update_user = getattr(user, "keycloak_username", None)
        await self.repo.db.flush()

        refreshed = await self.repo.get_designated_action_by_id(designated_action_id)
        return DesignatedActionSchema.model_validate(refreshed)

    async def _issue_designated_action_credits(
        self, action: DesignatedAction, user: UserProfile, display_name: str
    ) -> None:
        """Use the existing credit-award records consumed by transaction views."""
        if action.transaction_id is not None:
            return

        credits = action.recommended_credits
        if credits is None or credits < 0:
            raise HTTPException(
                status_code=400,
                detail="A non-negative recommended credit amount is required for approval.",
            )
        if credits > action.credit_allocation:
            raise HTTPException(
                status_code=400,
                detail="Recommended credits cannot exceed the allocation for this action.",
            )
        agreement = action.initiative_agreement
        if agreement.to_organization_id is None:
            raise HTTPException(
                status_code=400,
                detail="The initiative agreement must have a receiving organization.",
            )
        approved = await self.repo.get_initiative_agreement_status_by_name(
            InitiativeAgreementStatusEnum.Approved
        )
        # Match agreement edits: lock the parent before refreshing transaction views.
        await self.repo.add_issued_credits(agreement.initiative_agreement_id, credits)
        # Zero-credit approvals still need an auditable transaction.
        transaction = await self.transaction_repo.create_transaction(
            transaction_action=TransactionActionEnum.Adjustment,
            compliance_units=credits,
            organization_id=agreement.to_organization_id,
        )
        username = getattr(user, "keycloak_username", None)
        today = datetime.now(PACIFIC_TZ).date()
        transaction.effective_date = today
        award = await self.repo.create_initiative_agreement(
            InitiativeAgreement(
                record_kind=RECORD_KIND_LEGACY_AWARD,
                agreement_type=agreement.agreement_type,
                compliance_units=credits,
                to_organization_id=agreement.to_organization_id,
                current_status_id=approved.initiative_agreement_status_id,
                transaction_id=transaction.transaction_id,
                transaction_effective_date=today,
                gov_comment=(
                    f"System-generated from approval of designated action "
                    f"{action.designated_action_id} (DA{action.action_number}), "
                    f"initiative agreement {agreement.ia_code or agreement.initiative_agreement_id}."
                ),
                create_user=username,
                update_user=username,
            )
        )
        action.transaction_id = transaction.transaction_id
        if action.determination_date is None:
            action.determination_date = today
        await self.repo.add_initiative_agreement_history(
            CreateInitiativeAgreementHistorySchema(
                initiative_agreement_id=award.initiative_agreement_id,
                initiative_agreement_status_id=approved.initiative_agreement_status_id,
                user_profile_id=user.user_profile_id,
                display_name=display_name,
            )
        )
        await self.repo.add_designated_action_history(
            DesignatedActionHistory(
                designated_action_id=action.designated_action_id,
                designated_action_group_uuid=action.group_uuid,
                event=EVENT_CREDITS_ISSUED,
                status_id=action.current_status_id,
                display_name="System",
                create_user=username,
                update_user=username,
                snapshot={
                    "system_generated": True,
                    "designated_action_id": action.designated_action_id,
                    "initiative_agreement_id": agreement.initiative_agreement_id,
                    "credit_transaction_id": award.initiative_agreement_id,
                    "transaction_id": transaction.transaction_id,
                    "recommended_credits": credits,
                    "approved_by_user_profile_id": user.user_profile_id,
                },
            )
        )

    @service_handler
    async def get_designated_action_history(
        self, designated_action_id: int
    ) -> List[DesignatedActionHistorySchema]:
        """The audit trail behind the action, newest first.

        Assignment events store analyst ids, which say nothing to a reader,
        so names are resolved here for display. The stored snapshot keeps
        the ids — they are the stable reference.
        """
        await self._get_action_or_404(designated_action_id)
        history = await self.repo.get_designated_action_history(designated_action_id)

        referenced_ids = []
        for entry in history:
            snapshot = entry.snapshot or {}
            referenced_ids.append(snapshot.get("from_analyst_id"))
            referenced_ids.append(snapshot.get("to_analyst_id"))
        names = await self.repo.get_user_display_names(referenced_ids)

        rows = []
        for entry in history:
            row = DesignatedActionHistorySchema.model_validate(entry)
            snapshot = dict(row.snapshot or {})
            if "from_analyst_id" in snapshot or "to_analyst_id" in snapshot:
                snapshot["from_analyst"] = names.get(snapshot.get("from_analyst_id"))
                snapshot["to_analyst"] = names.get(snapshot.get("to_analyst_id"))
                row = row.model_copy(update={"snapshot": snapshot})
            rows.append(row)
        return rows

    @service_handler
    async def get_evidence_requirements(
        self, designated_action_id: int
    ) -> List[EvidenceRequirementSchema]:
        """The evidence of completion list for one designated action, as the
        caller sees it during a change order (#5555)."""
        action = await self._get_action_or_404(designated_action_id)
        view = await self._action_view(action, self._caller())
        requirements = await self.repo.get_evidence_requirements(
            designated_action_id, include_change_order_id=view.change_order_id
        )
        return [
            view.apply(
                EVIDENCE_REQUIREMENT,
                requirement,
                EvidenceRequirementSchema.model_validate(requirement),
            )
            for requirement in requirements
        ]

    @service_handler
    async def create_evidence_requirement(
        self,
        designated_action_id: int,
        data: EvidenceRequirementCreateSchema,
        user,
    ) -> EvidenceRequirementSchema:
        """Add an evidence requirement to an action (the wireframe's Add EOC).
        One added in a change order waits for the Director's acceptance
        (#5555)."""
        action = await self._get_action_or_404(designated_action_id, user)
        change_order = await self._change_order_of_action(action)
        ensure_package_editable(action.initiative_agreement, user)
        title = (data.title or "").strip()
        if not title:
            raise HTTPException(
                status_code=400, detail="A requirement title is required."
            )
        description = (data.description or "").strip()
        if not description:
            raise HTTPException(
                status_code=400, detail="A requirement description is required."
            )
        number = data.requirement_number
        if number is None:
            number = await self.repo.next_requirement_number(designated_action_id)
        username = getattr(user, "keycloak_username", None)
        requirement = await self.repo.add_evidence_requirement(
            EvidenceRequirement(
                designated_action_id=designated_action_id,
                requirement_number=number,
                title=title,
                description=description,
                evidence_type=data.evidence_type,
                pending_change_order_id=(
                    change_order.initiative_agreement_change_order_id
                    if change_order is not None
                    else None
                ),
                create_user=username,
                update_user=username,
            )
        )
        return await self._requirement_schema(action, requirement)

    @service_handler
    async def update_evidence_requirement(
        self,
        evidence_requirement_id: int,
        data: EvidenceRequirementUpdateSchema,
        user,
    ) -> EvidenceRequirementSchema:
        """Edit a requirement's wording or record the analyst's assessment.

        Recording an assessment stamps who decided and when. The previous
        round's finding is not lost when information is requested: the round
        is captured with its full payload in designated_action_history.

        The wording (title, description, type and number) is part of the
        package and changes only while it is open to edits (#5554). In a
        change order draft an edit to it is staged as the requirement's next
        version (#5555). The assessment is the analyst review, which is what
        an Underway package is for, so it stays open and is never versioned.
        """
        requirement, action = await self._get_requirement_or_404(
            evidence_requirement_id, user
        )
        agreement = action.initiative_agreement
        change_order = await self._change_order_of_action(action)
        definition_fields = {
            "title",
            "description",
            "evidence_type",
            "requirement_number",
        }
        review_fields = {
            "analyst_review",
            "review_notes",
            "missing_information",
            "review_outcome",
            "clear_review_outcome",
        }
        provided = set()
        for name in data.model_fields_set:
            value = getattr(data, name)
            if name == "clear_review_outcome":
                if value:
                    provided.add(name)
            elif value is not None or name == "missing_information":
                provided.add(name)
        if provided & review_fields and not has_any_role(user, PACKAGE_EDITOR_ROLES):
            raise HTTPException(
                status_code=403,
                detail="Only an IA analyst or manager can record an assessment.",
            )
        if change_order is not None and provided & definition_fields:
            # Staged against the change order's working values; unchanged
            # wording sent with an assessment stages nothing.
            ensure_package_editable(agreement, user)
            await self._stage_requirement_definition(
                change_order, requirement, data, user
            )
            data = data.model_copy(update={name: None for name in definition_fields})
        elif self._changes_requirement_wording(requirement, data):
            ensure_package_editable(agreement, user)

        # The text an analyst saves deliberately — title, description and
        # evaluation — is recorded with its before and after, the way a
        # correction to the action's own details is. Outcome and notes are
        # not: they are captured whole in the workflow snapshots.
        changes = {}
        if data.title is not None:
            title = data.title.strip()
            if not title:
                raise HTTPException(
                    status_code=400, detail="A requirement title is required."
                )
            if title != requirement.title:
                changes["title"] = {"from": requirement.title, "to": title}
                requirement.title = title
        if data.description is not None:
            description = data.description.strip()
            if not description:
                raise HTTPException(
                    status_code=400, detail="A requirement description is required."
                )
            if description != requirement.description:
                changes["description"] = {
                    "from": requirement.description,
                    "to": description,
                }
                requirement.description = description
        if data.evidence_type is not None:
            requirement.evidence_type = data.evidence_type
        if data.requirement_number is not None:
            requirement.requirement_number = data.requirement_number

        review_touched = False
        if data.analyst_review is not None:
            if data.analyst_review != (requirement.analyst_review or ""):
                changes["evaluation"] = {
                    "from": requirement.analyst_review,
                    "to": data.analyst_review,
                }
            requirement.analyst_review = data.analyst_review
            review_touched = True
        if "missing_information" in data.model_fields_set:
            requirement.missing_information = (
                data.missing_information or ""
            ).strip() or None
        if data.review_notes is not None:
            requirement.review_notes = data.review_notes
            review_touched = True
        if data.clear_review_outcome:
            requirement.review_outcome = None
            review_touched = True
        elif data.review_outcome is not None:
            if data.review_outcome not in REVIEW_OUTCOMES:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "review_outcome must be one of: " + ", ".join(REVIEW_OUTCOMES)
                    ),
                )
            requirement.review_outcome = data.review_outcome
            review_touched = True

        if review_touched:
            requirement.reviewed_by_user_id = getattr(user, "user_profile_id", None)
            requirement.reviewed_date = datetime.now(timezone.utc)
        requirement.update_user = getattr(user, "keycloak_username", None)

        if changes:
            action = await self.repo.get_designated_action_by_id(
                requirement.designated_action_id
            )
            display_name = " ".join(
                p
                for p in (
                    getattr(user, "first_name", ""),
                    getattr(user, "last_name", ""),
                )
                if p
            ).strip()
            await self.repo.add_designated_action_history(
                DesignatedActionHistory(
                    designated_action_id=action.designated_action_id,
                    designated_action_group_uuid=action.group_uuid,
                    event=EVENT_DETAILS_EDITED,
                    status_id=action.current_status_id,
                    user_profile_id=getattr(user, "user_profile_id", None),
                    display_name=display_name or None,
                    snapshot={
                        "changed": changes,
                        "evidence_requirement_id": requirement.evidence_requirement_id,
                        "requirement_number": requirement.requirement_number,
                        "requirement_title": requirement.title
                        or requirement.description,
                    },
                )
            )
        await self.repo.db.flush()

        refreshed = await self.repo.get_evidence_requirement(evidence_requirement_id)
        return await self._requirement_schema(action, refreshed)

    async def _stage_requirement_definition(
        self, change_order, requirement, data, user
    ) -> None:
        """Stage a change order's edit to a requirement's wording (#5555)."""
        current = await self.change_orders.working_values(
            change_order, EVIDENCE_REQUIREMENT, requirement
        )
        changes = {}
        if data.title is not None:
            title = data.title.strip()
            if not title:
                raise HTTPException(
                    status_code=400, detail="A requirement title is required."
                )
            changes["title"] = title
        if data.description is not None:
            description = data.description.strip()
            if not description:
                raise HTTPException(
                    status_code=400, detail="A requirement description is required."
                )
            changes["description"] = description
        if data.evidence_type is not None:
            changes["evidence_type"] = data.evidence_type
        if data.requirement_number is not None:
            changes["requirement_number"] = data.requirement_number
        changes = {
            name: value for name, value in changes.items() if value != current[name]
        }
        if changes:
            await self.change_orders.stage_update(
                change_order, EVIDENCE_REQUIREMENT, requirement, changes, user
            )

    async def _requirement_schema(self, action, requirement):
        view = await self._action_view(action, self._caller())
        return view.apply(
            EVIDENCE_REQUIREMENT,
            requirement,
            EvidenceRequirementSchema.model_validate(requirement),
        )

    @staticmethod
    def _changes_requirement_wording(
        requirement: EvidenceRequirement, data: EvidenceRequirementUpdateSchema
    ) -> bool:
        """Whether this update would change the requirement's wording. A
        value sent unchanged is not a change, so a client that saves the
        whole card does not trip the package lock with an assessment."""
        sent = {
            "title": (data.title or "").strip() if data.title is not None else None,
            "description": (
                (data.description or "").strip()
                if data.description is not None
                else None
            ),
            "evidence_type": data.evidence_type,
            "requirement_number": data.requirement_number,
        }
        return any(
            value is not None and value != getattr(requirement, field)
            for field, value in sent.items()
        )

    @service_handler
    async def deactivate_evidence_requirement(
        self, evidence_requirement_id: int, user
    ) -> None:
        """Remove a requirement from the list without erasing it — a
        requirement that was once reviewed is part of the record. In a
        change order draft the removal waits for the Director's acceptance
        (#5555)."""
        requirement, action = await self._get_requirement_or_404(
            evidence_requirement_id, user
        )
        ensure_package_editable(action.initiative_agreement, user)
        change_order = await self._change_order_of_action(action)
        if change_order is not None:
            await self.change_orders.stage_removal(
                change_order, EVIDENCE_REQUIREMENT, requirement, user
            )
            return
        requirement.is_active = False
        requirement.update_user = getattr(user, "keycloak_username", None)
        await self.repo.db.flush()

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
        action = await self._get_action_or_404(designated_action_id, user)

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

        # Set effective date to today if the analyst left it blank. The
        # transaction views read it as a Pacific calendar date, so take
        # today's Pacific date, not UTC's (which is tomorrow after 5 PM).
        if initiative_agreement.transaction_effective_date is None:
            initiative_agreement.transaction_effective_date = datetime.now(
                PACIFIC_TZ
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

    async def _agreement_or_404(self, initiative_agreement_id: int, user):
        """The agreement, unless it is missing or hidden from the caller."""
        agreement = await self.repo.get_initiative_agreement_by_id(
            initiative_agreement_id
        )
        if not agreement or is_hidden_from(agreement, user):
            raise DataNotFoundException(
                f"Initiative Agreement with id {initiative_agreement_id} not found"
            )
        return agreement

    @staticmethod
    def _require_note_text(note_text: Optional[str]) -> str:
        """The sanitized note HTML, unless it holds no text (an empty Quill
        editor submits ``<p><br></p>``). The client also sanitizes before
        display, but the server re-sanitizes before persistence so an API
        caller can't bypass it and store disallowed markup."""
        sanitized = _sanitize_note_html(note_text)
        if not unescape(sanitize_comment_text(sanitized)).strip():
            raise HTTPException(status_code=400, detail="A note is required.")
        return sanitized

    @staticmethod
    def _note_schema(
        note: InitiativeAgreementNote, editor: Optional[UserProfile]
    ) -> InitiativeAgreementNoteSchema:
        """A note as the notes accordion shows it: the audit update fields
        are the "last edited" user and date."""
        return InitiativeAgreementNoteSchema(
            initiative_agreement_note_id=note.initiative_agreement_note_id,
            initiative_agreement_id=note.initiative_agreement_id,
            note_number=note.note_number,
            note_text=note.note_text,
            last_edited_by=(
                AssignedAnalystSchema.model_validate(editor) if editor else None
            ),
            last_edited_date=note.update_date,
        )

    async def _get_note_schema(
        self, agreement, note_id: int, user
    ) -> InitiativeAgreementNoteSchema:
        view = await self.change_orders.view_for(agreement, user)
        rows = await self.repo.get_notes_with_editors(
            agreement.initiative_agreement_id,
            note_id,
            include_change_order_id=view.change_order_id,
        )
        if not rows:
            raise DataNotFoundException(f"Note with id {note_id} not found")
        note, editor = rows[0]
        return view.apply(NOTE, note, self._note_schema(note, editor))

    @service_handler
    async def get_notes(
        self, initiative_agreement_id: int, user
    ) -> List[InitiativeAgreementNoteSchema]:
        """An agreement's notes, in note-number order, as the caller sees
        them during a change order (#5555)."""
        agreement = await self._agreement_or_404(initiative_agreement_id, user)
        view = await self.change_orders.view_for(agreement, user)
        rows = await self.repo.get_notes_with_editors(
            initiative_agreement_id, include_change_order_id=view.change_order_id
        )
        notes = [
            view.apply(NOTE, note, self._note_schema(note, editor))
            for note, editor in rows
        ]
        # A renumbering in the change order moves the note in the list.
        return sorted(notes, key=lambda note: Decimal(note.note_number))

    @service_handler
    async def get_next_note_number(self, initiative_agreement_id: int, user) -> Decimal:
        """The number the add-note form starts from."""
        agreement = await self._agreement_or_404(initiative_agreement_id, user)
        number = await self.repo.next_note_number(initiative_agreement_id)
        change_order = await self.change_orders.open_change_order_for(agreement)
        if change_order is not None:
            taken = await self.change_orders.note_numbers_in_use(
                initiative_agreement_id, change_order, include_live=True
            )
            if taken:
                number = max(number, max(taken) + Decimal(1))
        return number

    @service_handler
    async def create_note(
        self,
        initiative_agreement_id: int,
        data: InitiativeAgreementNoteCreateSchema,
        user,
    ) -> InitiativeAgreementNoteSchema:
        agreement = await self._agreement_or_404(initiative_agreement_id, user)
        change_order = await self.change_orders.open_change_order_for(agreement)
        ensure_package_editable(agreement, user)
        taken = (
            await self.change_orders.note_numbers_in_use(
                initiative_agreement_id, change_order, include_live=True
            )
            if change_order is not None
            else None
        )
        try:
            note = await self.repo.add_initiative_agreement_note(
                initiative_agreement_id=initiative_agreement_id,
                note_text=self._require_note_text(data.note_text),
                note_number=data.note_number,
                username=getattr(user, "keycloak_username", None),
                pending_change_order_id=(
                    change_order.initiative_agreement_change_order_id
                    if change_order is not None
                    else None
                ),
                taken_numbers=taken,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return await self._get_note_schema(
            agreement, note.initiative_agreement_note_id, user
        )

    @service_handler
    async def update_note(
        self,
        initiative_agreement_id: int,
        note_id: int,
        data: InitiativeAgreementNoteUpdateSchema,
        user,
    ) -> InitiativeAgreementNoteSchema:
        agreement = await self._agreement_or_404(initiative_agreement_id, user)
        change_order = await self.change_orders.open_change_order_for(agreement)
        ensure_package_editable(agreement, user)
        note_text = self._require_note_text(data.note_text)
        if change_order is not None:
            await self._stage_note_update(
                agreement, change_order, note_id, data.note_number, note_text, user
            )
        else:
            try:
                await self.repo.update_initiative_agreement_note(
                    initiative_agreement_id,
                    note_id,
                    note_text,
                    data.note_number,
                    username=getattr(user, "keycloak_username", None),
                )
            except ValueError as error:
                raise HTTPException(status_code=400, detail=str(error)) from error
        return await self._get_note_schema(agreement, note_id, user)

    async def _change_order_note(self, agreement, change_order, note_id: int):
        """A note the change order can act on: an accepted one, or one it
        added itself."""
        note = await self.change_orders.get_live_record(NOTE, note_id)
        if (
            note is None
            or note.initiative_agreement_id != agreement.initiative_agreement_id
            or not note.is_active
            or note.pending_change_order_id
            not in (None, change_order.initiative_agreement_change_order_id)
        ):
            raise DataNotFoundException(f"Note with id {note_id} not found")
        return note

    async def _stage_note_update(
        self, agreement, change_order, note_id, note_number, note_text, user
    ) -> None:
        note = await self._change_order_note(agreement, change_order, note_id)
        added_here = note.pending_change_order_id is not None
        taken = await self.change_orders.note_numbers_in_use(
            agreement.initiative_agreement_id,
            change_order,
            exclude_note_id=note_id,
            include_live=added_here,
        )
        if Decimal(note_number) in taken:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Note number {note_number} is already in use for this "
                    "initiative agreement."
                ),
            )
        await self.change_orders.stage_update(
            change_order,
            NOTE,
            note,
            {"note_number": Decimal(note_number), "note_text": note_text},
            user,
        )

    @service_handler
    async def delete_note(
        self, initiative_agreement_id: int, note_id: int, user
    ) -> None:
        agreement = await self._agreement_or_404(initiative_agreement_id, user)
        change_order = await self.change_orders.open_change_order_for(agreement)
        ensure_package_editable(agreement, user)
        if change_order is not None:
            note = await self._change_order_note(agreement, change_order, note_id)
            await self.change_orders.stage_removal(change_order, NOTE, note, user)
            return
        await self.repo.delete_initiative_agreement_note(
            initiative_agreement_id, note_id
        )

    # --- Change orders (#5555) ----------------------------------------------

    @service_handler
    async def start_change_order(
        self, initiative_agreement_id: int, user
    ) -> InitiativeAgreementProfileSchema:
        """Put an underway agreement into a change order draft."""
        await self._agreement_or_404(initiative_agreement_id, user)
        await self.change_orders.start(initiative_agreement_id, user)
        return await self.get_initiative_agreement_profile(initiative_agreement_id)

    @service_handler
    async def accept_change_order(
        self, initiative_agreement_id: int, accepted_date, user
    ) -> InitiativeAgreementProfileSchema:
        """The Director accepts the open change order, effective
        accepted_date; its versions become the accepted package."""
        await self._agreement_or_404(initiative_agreement_id, user)
        await self.change_orders.accept(initiative_agreement_id, accepted_date, user)
        return await self.get_initiative_agreement_profile(initiative_agreement_id)

    @service_handler
    async def discard_change_order(
        self, initiative_agreement_id: int, user
    ) -> InitiativeAgreementProfileSchema:
        """Drop the open change order's edits and return to Underway."""
        await self._agreement_or_404(initiative_agreement_id, user)
        await self.change_orders.discard(initiative_agreement_id, user)
        return await self.get_initiative_agreement_profile(initiative_agreement_id)

    @service_handler
    async def get_change_orders(
        self, initiative_agreement_id: int, user
    ) -> List[ChangeOrderSchema]:
        """Every change order against the agreement, newest first."""
        await self._agreement_or_404(initiative_agreement_id, user)
        return [
            ChangeOrderSchema.model_validate(change_order)
            for change_order in await self.change_orders.list_change_orders(
                initiative_agreement_id
            )
        ]

    async def _agreement_of_record(self, record_type, row):
        if record_type is AGREEMENT:
            return row.initiative_agreement_id
        if record_type is EVIDENCE_REQUIREMENT:
            action = await self.repo.get_designated_action_by_id(
                row.designated_action_id
            )
            return action.initiative_agreement_id if action else None
        return row.initiative_agreement_id

    @service_handler
    async def get_record_versions(
        self, record_type_key: str, record_id: int, user
    ) -> List[RecordVersionSchema]:
        """Every version of one agreement, note, designated action or
        evidence requirement, oldest first, for IDIR (#5555). A record no
        change order has touched has none."""
        record_type = RECORD_TYPES.get(record_type_key)
        row = (
            await self.change_orders.get_live_record(record_type, record_id)
            if record_type is not None
            else None
        )
        agreement_id = (
            await self._agreement_of_record(record_type, row) if row else None
        )
        if agreement_id is None:
            raise DataNotFoundException(
                f"No {record_type_key} with id {record_id} was found"
            )
        await self._agreement_or_404(agreement_id, user)

        versions = await self.change_orders.record_versions(record_type, record_id)
        in_effect = [
            version.version
            for version in versions
            if version.change_order is None
            or version.change_order.status == CHANGE_ORDER_STATUS_ACCEPTED
        ]
        current = max(in_effect) if in_effect else None
        result = []
        for version in versions:
            change_order = version.change_order
            result.append(
                RecordVersionSchema(
                    version=version.version,
                    action_type=version.action_type.value,
                    change_order_number=(
                        change_order.change_order_number if change_order else None
                    ),
                    change_order_status=change_order.status if change_order else None,
                    accepted_date=change_order.accepted_date if change_order else None,
                    accepted_at=change_order.accepted_at if change_order else None,
                    accepted_by_display_name=(
                        change_order.accepted_by_display_name if change_order else None
                    ),
                    create_date=version.create_date,
                    values={
                        to_camel(name): _version_value(value)
                        for name, value in version.values().items()
                    },
                    is_current=version.version == current,
                    is_pending=(
                        change_order is not None
                        and change_order.status == CHANGE_ORDER_STATUS_DRAFT
                    ),
                )
            )
        return result


def _version_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value

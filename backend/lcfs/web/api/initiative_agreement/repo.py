from fastapi import Depends
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple
from sqlalchemy import and_, asc, desc, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.base import ActionTypeEnum
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.initiative_agreement.DesignatedAction import DesignatedAction
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    RECORD_KIND_AGREEMENT,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementLifecycleStatus import (
    InitiativeAgreementLifecycleStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.comment.InitiativeAgreementInternalComment import (
    InitiativeAgreementInternalComment,
)
from lcfs.db.models.comment.InternalComment import InternalComment
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.internal_comment.schema import CommentVisibilityEnum
from lcfs.web.api.initiative_agreement.schema import (
    CreateInitiativeAgreementHistorySchema,
)

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

# Grid field names (snake_cased by PaginationRequestSchema) -> filter/sort columns
LIST_FIELD_COLUMNS = {
    "status": InitiativeAgreementLifecycleStatus.status,
    "lifecycle_status.status": InitiativeAgreementLifecycleStatus.status,
    "organization": Organization.name,
    "organization.name": Organization.name,
    "ia_code": InitiativeAgreement.ia_code,
    "agreement_type": InitiativeAgreement.agreement_type,
    "title": InitiativeAgreement.title,
    "contact_name": InitiativeAgreement.contact_name,
    "entry_date": InitiativeAgreement.entry_date,
    "agreement_start_date": InitiativeAgreement.agreement_start_date,
    "agreement_end_date": InitiativeAgreement.agreement_end_date,
    "update_date": InitiativeAgreement.update_date,
    "create_date": InitiativeAgreement.create_date,
    "total_credits_allocated": InitiativeAgreement.total_credits_allocated,
    "total_credits_issued": InitiativeAgreement.total_credits_issued,
}
_DATE_FIELDS = {
    "entry_date",
    "agreement_start_date",
    "agreement_end_date",
    "update_date",
    "create_date",
}


def _build_list_filter(filter_model):
    """Translate one AG-Grid filter model into a SQLAlchemy condition."""
    column = LIST_FIELD_COLUMNS.get(filter_model.field)
    if column is None:
        return None

    if filter_model.filter_type == "date" or filter_model.field in _DATE_FIELDS:
        if filter_model.type == "inRange":
            return and_(
                column >= filter_model.date_from, column <= filter_model.date_to
            )
        value = filter_model.date_from or filter_model.filter
        if value is None:
            return None
        if filter_model.type == "equals":
            return column == value
        if filter_model.type == "lessThan":
            return column < value
        if filter_model.type == "greaterThan":
            return column > value
        return None

    value = filter_model.filter
    if value is None:
        return None
    if filter_model.type == "contains":
        return column.ilike(f"%{value}%")
    if filter_model.type == "startsWith":
        return column.ilike(f"{value}%")
    if filter_model.type == "endsWith":
        return column.ilike(f"%{value}")
    if filter_model.type in ("equals", "notEqual"):
        condition = column == value
        return ~condition if filter_model.type == "notEqual" else condition
    return None


class InitiativeAgreementRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_initiative_agreement_by_id(
        self, initiative_agreement_id: int
    ) -> Optional[InitiativeAgreement]:
        query = (
            select(InitiativeAgreement)
            .options(
                selectinload(InitiativeAgreement.to_organization),
                selectinload(InitiativeAgreement.current_status),
                selectinload(InitiativeAgreement.history).selectinload(
                    InitiativeAgreementHistory.user_profile
                ),
                selectinload(InitiativeAgreement.history).selectinload(
                    InitiativeAgreementHistory.initiative_agreement_status
                ),
            )
            .where(
                InitiativeAgreement.initiative_agreement_id == initiative_agreement_id
            )
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def create_initiative_agreement(
        self, initiative_agreement: InitiativeAgreement
    ) -> InitiativeAgreement:
        self.db.add(initiative_agreement)
        await self.db.flush()
        await self.db.refresh(
            initiative_agreement,
            [
                "to_organization",
                "current_status",
                "history",
            ],
        )  # Ensures that all specified relations are up-to-date
        return initiative_agreement

    @repo_handler
    async def update_initiative_agreement(
        self, initiative_agreement: InitiativeAgreement
    ) -> InitiativeAgreement:
        merged_initiative_agreement = await self.db.merge(initiative_agreement)
        await self.db.flush()
        return merged_initiative_agreement

    @repo_handler
    async def get_initiative_agreement_status_by_name(
        self, status_name: str
    ) -> InitiativeAgreementStatus:
        query = await self.db.execute(
            select(InitiativeAgreementStatus).where(
                InitiativeAgreementStatus.status == status_name
            )
        )
        status = query.scalars().first()

        if not status:
            raise DataNotFoundException(
                f"Initiative Agreement status '{status_name}' not found"
            )

        return status

    @repo_handler
    async def add_initiative_agreement_history(
        self, history: CreateInitiativeAgreementHistorySchema
    ) -> InitiativeAgreementHistory:
        """
        Adds a new record to the initiative agreement history in the database.

        Args:
            initiative_agreement_id (int): The ID of the initiative agreement to which this history record relates.
            initiative_agreement_status_id (int): The status ID that describes the current state of the initiative agreement.
            user_profile_id (int): The ID of the user who made the change.

        Returns:
            InitiativeAgreementHistory: The newly created initiative agreement history record.
        """
        new_history_record = InitiativeAgreementHistory(
            initiative_agreement_id=history.initiative_agreement_id,
            initiative_agreement_status_id=history.initiative_agreement_status_id,
            user_profile_id=history.user_profile_id,
            display_name=history.display_name,
        )
        self.db.add(new_history_record)
        await self.db.flush()
        return new_history_record

    @repo_handler
    async def update_initiative_agreement_history(
        self, history: CreateInitiativeAgreementHistorySchema
    ) -> InitiativeAgreementHistory:
        """
        Updates an initiative agreement history record in the database.

        Args:
            initiative_agreement_id (int): The ID of the initiative agreement to which this history record relates.
            initiative_agreement_status_id (int): The status ID that describes the current state of the initiative agreement.
            user_profile_id (int): The ID of the user who made the change.

        Returns:
            InitiativeAgreementHistory: The updated initiative agreement history record.
        """
        existing_history = await self.db.scalar(
            select(InitiativeAgreementHistory).where(
                and_(
                    InitiativeAgreementHistory.initiative_agreement_id
                    == history.initiative_agreement_id,
                    InitiativeAgreementHistory.initiative_agreement_status_id
                    == history.initiative_agreement_status_id,
                )
            )
        )
        existing_history.create_date = datetime.now(timezone.utc)
        existing_history.update_date = datetime.now(timezone.utc)
        existing_history.user_profile_id = history.user_profile_id
        existing_history.display_name = history.display_name
        self.db.add(existing_history)
        await self.db.flush()
        return existing_history

    @repo_handler
    async def refresh_initiative_agreement(
        self, initiative_agreement: InitiativeAgreement
    ) -> InitiativeAgreement:
        """
        Commits and refreshes an initiative agreement object in db session

        """
        await self.db.flush()
        await self.db.refresh(initiative_agreement)
        return initiative_agreement

    @repo_handler
    async def get_initiative_agreements_paginated(
        self,
        pagination: PaginationRequestSchema,
        organization_id: Optional[int] = None,
    ) -> Tuple[List[InitiativeAgreement], int]:
        """
        Paginated, filterable agreements query for the agreement-management
        grid. When organization_id is provided the result is scoped to that
        organization (non-government callers).
        """
        query = (
            select(InitiativeAgreement)
            # Outer join: agreement records carry a lifecycle status, not the
            # credit-award status, and it is nullable until one is set.
            .outerjoin(InitiativeAgreement.lifecycle_status).join(
                InitiativeAgreement.to_organization
            )
            # Excludes the legacy one-row-per-credit-award records that share
            # this table until the transaction-flow cutover.
            .where(InitiativeAgreement.record_kind == RECORD_KIND_AGREEMENT)
        )
        if organization_id is not None:
            query = query.where(
                InitiativeAgreement.to_organization_id == organization_id
            )
        for filter_model in pagination.filters:
            condition = _build_list_filter(filter_model)
            if condition is not None:
                query = query.where(condition)

        order_by_clauses = []
        for order in pagination.sort_orders:
            column = LIST_FIELD_COLUMNS.get(order.field)
            if column is None:
                continue
            order_by_clauses.append(
                desc(column) if order.direction == "desc" else asc(column)
            )
        if not order_by_clauses:
            order_by_clauses = [desc(InitiativeAgreement.update_date)]

        count_query = select(func.count()).select_from(
            query.with_only_columns(
                InitiativeAgreement.initiative_agreement_id
            ).subquery()
        )
        total_count = (await self.db.execute(count_query)).scalar_one()

        offset = (pagination.page - 1) * pagination.size
        result = await self.db.execute(
            query.options(
                selectinload(InitiativeAgreement.lifecycle_status),
                selectinload(InitiativeAgreement.to_organization),
            )
            .order_by(*order_by_clauses)
            .offset(offset)
            .limit(pagination.size)
        )
        return result.scalars().all(), total_count

    @repo_handler
    async def get_initiative_agreement_profile(
        self, initiative_agreement_id: int
    ) -> Optional[InitiativeAgreement]:
        """Agreement with organization, status and designated actions loaded."""
        query = (
            select(InitiativeAgreement)
            .options(
                # The detail card renders the organization's address block, so
                # it must be eager-loaded; a lazy load raises MissingGreenlet.
                selectinload(InitiativeAgreement.to_organization).selectinload(
                    Organization.org_address
                ),
                selectinload(InitiativeAgreement.lifecycle_status),
                selectinload(InitiativeAgreement.designated_actions).selectinload(
                    DesignatedAction.current_status
                ),
                selectinload(InitiativeAgreement.designated_actions).selectinload(
                    DesignatedAction.assigned_analyst
                ),
            )
            .where(
                InitiativeAgreement.initiative_agreement_id == initiative_agreement_id
            )
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_current_designated_actions(
        self, initiative_agreement_id: int
    ) -> List[DesignatedAction]:
        """
        The current version of each designated action.

        Change orders append a row sharing group_uuid with a higher version,
        so selecting every row would show one action once per amendment.
        Mirrors the charging_site latest-version-per-group pattern.
        """
        latest = (
            select(
                DesignatedAction.group_uuid,
                func.max(DesignatedAction.version).label("max_version"),
            )
            .where(DesignatedAction.initiative_agreement_id == initiative_agreement_id)
            .group_by(DesignatedAction.group_uuid)
            .subquery()
        )
        query = (
            select(DesignatedAction)
            .join(
                latest,
                and_(
                    DesignatedAction.group_uuid == latest.c.group_uuid,
                    DesignatedAction.version == latest.c.max_version,
                ),
            )
            .options(
                selectinload(DesignatedAction.current_status),
                selectinload(DesignatedAction.assigned_analyst),
            )
            .where(
                DesignatedAction.initiative_agreement_id == initiative_agreement_id,
                DesignatedAction.action_type != ActionTypeEnum.DELETE,
            )
            .order_by(asc(DesignatedAction.action_number))
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_latest_comments_by_agreement_ids(
        self,
        initiative_agreement_ids: Sequence[int],
        include_internal: bool,
    ) -> Dict[int, Tuple[InternalComment, str]]:
        """
        The newest comment visible to the caller, per agreement.

        One query for the whole page rather than one per row.

        ``include_internal`` is false for non-government callers, and the
        visibility filter is applied *before* ranking on purpose: filtering
        afterwards would return nothing for an agreement whose newest comment
        is internal, rather than the newest comment that caller may actually
        see.
        """
        if not initiative_agreement_ids:
            return {}

        ranked = (
            select(
                InitiativeAgreementInternalComment.initiative_agreement_id.label(
                    "initiative_agreement_id"
                ),
                InternalComment.internal_comment_id.label("internal_comment_id"),
                func.row_number()
                .over(
                    partition_by=(
                        InitiativeAgreementInternalComment.initiative_agreement_id
                    ),
                    order_by=desc(InternalComment.create_date),
                )
                .label("rn"),
            )
            .join(
                InternalComment,
                InternalComment.internal_comment_id
                == InitiativeAgreementInternalComment.internal_comment_id,
            )
            .where(
                InitiativeAgreementInternalComment.initiative_agreement_id.in_(
                    list(initiative_agreement_ids)
                )
            )
        )
        if not include_internal:
            ranked = ranked.where(
                InternalComment.visibility == CommentVisibilityEnum.PUBLIC.value
            )

        ranked_subq = ranked.subquery()

        stmt = (
            select(
                ranked_subq.c.initiative_agreement_id,
                InternalComment,
                UserProfile.first_name,
                UserProfile.last_name,
            )
            .join(
                InternalComment,
                InternalComment.internal_comment_id
                == ranked_subq.c.internal_comment_id,
            )
            .join(
                UserProfile,
                UserProfile.keycloak_username == InternalComment.create_user,
                isouter=True,
            )
            .where(ranked_subq.c.rn == 1)
        )
        result = await self.db.execute(stmt)

        latest: Dict[int, Tuple[InternalComment, str]] = {}
        for agreement_id, comment, first_name, last_name in result.all():
            full_name = " ".join(p for p in (first_name, last_name) if p).strip()
            latest[agreement_id] = (comment, full_name)
        return latest

    @repo_handler
    async def get_lifecycle_statuses(self) -> List[InitiativeAgreementLifecycleStatus]:
        """Lifecycle statuses for the agreement grid's status filter."""
        result = await self.db.execute(
            select(InitiativeAgreementLifecycleStatus).order_by(
                asc(InitiativeAgreementLifecycleStatus.display_order)
            )
        )
        return result.scalars().all()

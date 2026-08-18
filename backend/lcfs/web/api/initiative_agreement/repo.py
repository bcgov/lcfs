from fastapi import Depends
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import String, and_, asc, cast, desc, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.initiative_agreement.DesignatedAction import DesignatedAction
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.initiative_agreement.schema import (
    CreateInitiativeAgreementHistorySchema,
)

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

# Grid field names (snake_cased by PaginationRequestSchema) -> filter/sort columns
LIST_FIELD_COLUMNS = {
    "status": InitiativeAgreementStatus.status,
    "current_status.status": InitiativeAgreementStatus.status,
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
# Enum-backed columns are compared as text
_TEXT_CAST_FIELDS = {"status", "current_status.status", "agreement_type"}
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
    if filter_model.field in _TEXT_CAST_FIELDS:
        column = cast(column, String)

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
            .join(InitiativeAgreement.current_status)
            .join(InitiativeAgreement.to_organization)
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
                selectinload(InitiativeAgreement.current_status),
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
                selectinload(InitiativeAgreement.to_organization),
                selectinload(InitiativeAgreement.current_status),
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

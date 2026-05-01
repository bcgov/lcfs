"""
Repository layer for the Carbon Intensity (CI) application module.

Encapsulates all SQLAlchemy access for ci_application and its related
lookup / history tables. Service-layer code never touches the session
directly so that future steps (Pathways, Documents, Sign & submit,
Government decision) plug into the same data-access surface.
"""

import math
from typing import List, Optional, Sequence, Tuple

import structlog
from fastapi import Depends
from sqlalchemy import and_, asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.ci_application import (
    CIApplication,
    CIApplicationHistory,
    CIApplicationStatus,
)
from lcfs.db.models.fuel.UnitOfMeasure import UnitOfMeasure
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class CIApplicationRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    # ------------------------------------------------------------------
    # Lookup data
    # ------------------------------------------------------------------

    @repo_handler
    async def get_statuses(self) -> Sequence[CIApplicationStatus]:
        result = await self.db.execute(
            select(CIApplicationStatus).order_by(CIApplicationStatus.display_order)
        )
        return result.scalars().all()

    @repo_handler
    async def get_status_by_name(self, status: str) -> Optional[CIApplicationStatus]:
        result = await self.db.execute(
            select(CIApplicationStatus).where(CIApplicationStatus.status == status)
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def get_units_of_measure(self) -> Sequence[UnitOfMeasure]:
        result = await self.db.execute(
            select(UnitOfMeasure).order_by(UnitOfMeasure.uom_id)
        )
        return result.scalars().all()

    # ------------------------------------------------------------------
    # CI application CRUD
    # ------------------------------------------------------------------

    @repo_handler
    async def get_by_id(self, ci_application_id: int) -> Optional[CIApplication]:
        result = await self.db.execute(
            select(CIApplication)
            .options(
                selectinload(CIApplication.organization),
                selectinload(CIApplication.ci_application_status),
                selectinload(CIApplication.facility_nameplate_capacity_unit),
                selectinload(CIApplication.pathways),
            )
            .where(CIApplication.ci_application_id == ci_application_id)
        )
        return result.scalar_one_or_none()

    @repo_handler
    async def create(self, ci_application: CIApplication) -> CIApplication:
        self.db.add(ci_application)
        await self.db.flush()
        await self.db.refresh(
            ci_application,
            [
                "ci_application_status",
                "organization",
                "facility_nameplate_capacity_unit",
            ],
        )
        return ci_application

    @repo_handler
    async def update(self, ci_application: CIApplication) -> CIApplication:
        await self.db.flush()
        await self.db.refresh(
            ci_application,
            [
                "ci_application_status",
                "organization",
                "facility_nameplate_capacity_unit",
            ],
        )
        return ci_application

    @repo_handler
    async def delete(self, ci_application: CIApplication) -> None:
        await self.db.delete(ci_application)
        await self.db.flush()

    @repo_handler
    async def add_history(
        self,
        ci_application: CIApplication,
        snapshot: Optional[dict] = None,
    ) -> CIApplicationHistory:
        history = CIApplicationHistory(
            ci_application_id=ci_application.ci_application_id,
            status_id=ci_application.status_id,
            ci_application_snapshot=snapshot,
            group_uuid=ci_application.group_uuid,
            version=ci_application.version,
        )
        self.db.add(history)
        await self.db.flush()
        return history

    # ------------------------------------------------------------------
    # Paginated listing
    # ------------------------------------------------------------------

    def _apply_filters(self, pagination: PaginationRequestSchema) -> list:
        conditions = []
        for f in pagination.filters:
            field = get_field_for_filter(CIApplication, f.field)
            if field is None:
                continue
            value = f.filter
            if f.filter_type == "set":
                value = f.values or []
            conditions.append(
                apply_filter_conditions(field, value, f.type, f.filter_type)
            )
        return conditions

    def _apply_sorting(self, pagination: PaginationRequestSchema):
        if not pagination.sort_orders:
            return [desc(CIApplication.update_date)]

        order_clauses = []
        for s in pagination.sort_orders:
            field = get_field_for_filter(CIApplication, s.field)
            if field is None:
                continue
            order_clauses.append(
                asc(field) if s.direction.lower() == "asc" else desc(field)
            )
        return order_clauses or [desc(CIApplication.update_date)]

    @repo_handler
    async def list_paginated(
        self,
        pagination: PaginationRequestSchema,
        organization_id: Optional[int] = None,
    ) -> Tuple[List[CIApplication], int]:
        """
        Returns ``(items, total_count)``. When ``organization_id`` is
        provided the result is restricted to that org (supplier scope);
        government users pass ``None`` to see everything.
        """
        conditions = self._apply_filters(pagination)
        if organization_id is not None:
            conditions.append(CIApplication.organization_id == organization_id)

        order_clauses = self._apply_sorting(pagination)
        offset = (pagination.page - 1) * pagination.size

        count_stmt = select(func.count(CIApplication.ci_application_id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            select(CIApplication)
            .options(
                selectinload(CIApplication.ci_application_status),
                selectinload(CIApplication.organization),
            )
            .order_by(*order_clauses)
            .offset(offset)
            .limit(pagination.size)
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    def total_pages(total: int, size: int) -> int:
        return math.ceil(total / size) if size else 0

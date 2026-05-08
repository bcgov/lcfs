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
    Pathway,
    PathwayApplicationType,
    PathwayFuelCodeType,
)
from lcfs.db.models.ci_application.CIApplication import (
    ci_application_document_association,
)
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.TransportMode import TransportMode
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

    @repo_handler
    async def get_pathway_application_types(
        self,
    ) -> Sequence[PathwayApplicationType]:
        result = await self.db.execute(
            select(PathwayApplicationType).order_by(
                PathwayApplicationType.display_order
            )
        )
        return result.scalars().all()

    @repo_handler
    async def get_pathway_fuel_code_types(self) -> Sequence[PathwayFuelCodeType]:
        result = await self.db.execute(
            select(PathwayFuelCodeType).order_by(PathwayFuelCodeType.display_order)
        )
        return result.scalars().all()

    @repo_handler
    async def get_fuel_types(self) -> Sequence[FuelType]:
        result = await self.db.execute(select(FuelType).order_by(FuelType.fuel_type))
        return result.scalars().all()

    @repo_handler
    async def get_transport_modes(self) -> Sequence[TransportMode]:
        result = await self.db.execute(
            select(TransportMode).order_by(TransportMode.transport_mode)
        )
        return result.scalars().all()

    @repo_handler
    async def get_approved_fuel_codes(self) -> Sequence[FuelCode]:
        """
        Approved fuel codes the applicant can renew. Eagerly loads the
        prefix (for display string assembly) and the fuel type (used to
        auto-populate locked grid cells when a renewal row is selected).
        """
        result = await self.db.execute(
            select(FuelCode)
            .options(
                selectinload(FuelCode.fuel_code_prefix),
                selectinload(FuelCode.fuel_code_status),
                selectinload(FuelCode.fuel_type),
            )
            .join(FuelCode.fuel_code_status)
            .where(FuelCodeStatus.status == FuelCodeStatusEnum.Approved)
            .order_by(FuelCode.fuel_code_id)
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
                selectinload(CIApplication.pathways).selectinload(
                    Pathway.application_type
                ),
                selectinload(CIApplication.pathways).selectinload(
                    Pathway.fuel_code_type
                ),
                selectinload(CIApplication.pathways).selectinload(Pathway.fuel_type),
                selectinload(CIApplication.pathways)
                .selectinload(Pathway.fuel_code)
                .selectinload(FuelCode.fuel_code_prefix),
                selectinload(CIApplication.pathways)
                .selectinload(Pathway.fuel_code)
                .selectinload(FuelCode.fuel_type),
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
    async def replace_pathways(
        self,
        ci_application_id: int,
        pathways: List[Pathway],
    ) -> List[Pathway]:
        """
        Replace the full set of pathways for a CI application.

        Step 2 always submits the entire grid, so we delete existing rows
        and insert the new ones in one unit of work. The application
        owns its pathways via a delete-orphan cascade, so the simple
        ``DELETE FROM pathway WHERE ci_application_id = :id`` mirrors
        what an ORM-level removal would do without forcing the service
        layer to load every existing row first.
        """
        from sqlalchemy import delete

        await self.db.execute(
            delete(Pathway).where(Pathway.ci_application_id == ci_application_id)
        )
        for pathway in pathways:
            pathway.ci_application_id = ci_application_id
            self.db.add(pathway)
        await self.db.flush()
        return pathways

    @repo_handler
    async def get_pathways(self, ci_application_id: int) -> List[Pathway]:
        result = await self.db.execute(
            select(Pathway)
            .options(
                selectinload(Pathway.application_type),
                selectinload(Pathway.fuel_code_type),
                selectinload(Pathway.fuel_type),
                selectinload(Pathway.fuel_code).selectinload(
                    FuelCode.fuel_code_prefix
                ),
                selectinload(Pathway.fuel_code).selectinload(FuelCode.fuel_type),
            )
            .where(Pathway.ci_application_id == ci_application_id)
            .order_by(Pathway.pathway_id)
        )
        return list(result.scalars().all())

    @repo_handler
    async def get_document_categories(
        self, ci_application_id: int
    ) -> List[str]:
        """
        Return just the ``document_category`` values currently linked to
        this CI application. Used by Step 3's required-uploads check; we
        deliberately don't pull Document rows so the validation stays cheap.
        """
        stmt = (
            select(ci_application_document_association.c.document_category)
            .where(
                ci_application_document_association.c.ci_application_id
                == ci_application_id
            )
        )
        result = await self.db.execute(stmt)
        return [row[0] for row in result.all()]

    @repo_handler
    async def get_fuel_codes_by_ids(
        self, fuel_code_ids: Sequence[int]
    ) -> List[FuelCode]:
        if not fuel_code_ids:
            return []
        result = await self.db.execute(
            select(FuelCode).where(FuelCode.fuel_code_id.in_(list(fuel_code_ids)))
        )
        return list(result.scalars().all())

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
    # Step 5 — comment thread (stored as JSONB rows on history table)
    #
    # The migration introduces ``ci_application_history`` with a JSONB
    # ``ci_application_snapshot`` column. We piggy-back the comments on
    # the same table so Step 5 can ship without a new migration. Comment
    # rows are distinguished by ``ci_application_snapshot.type ==
    # 'comment'`` and carry the author identity and free-text body.
    # Status-change history rows leave the snapshot as ``None`` (or do
    # not set a ``type`` key) so the two views never collide.
    # ------------------------------------------------------------------

    COMMENT_SNAPSHOT_TYPE = "comment"

    @repo_handler
    async def add_comment(
        self,
        ci_application: CIApplication,
        text: str,
        author_username: str,
        author_display_name: Optional[str],
        is_government: bool,
    ) -> CIApplicationHistory:
        history = CIApplicationHistory(
            ci_application_id=ci_application.ci_application_id,
            status_id=ci_application.status_id,
            ci_application_snapshot={
                "type": self.COMMENT_SNAPSHOT_TYPE,
                "text": text,
                "author_username": author_username,
                "author_display_name": author_display_name,
                "is_government": is_government,
            },
            group_uuid=ci_application.group_uuid,
            version=ci_application.version,
        )
        self.db.add(history)
        await self.db.flush()
        await self.db.refresh(history)
        return history

    @repo_handler
    async def list_comments(
        self, ci_application_id: int
    ) -> List[CIApplicationHistory]:
        result = await self.db.execute(
            select(CIApplicationHistory)
            .where(CIApplicationHistory.ci_application_id == ci_application_id)
            .order_by(asc(CIApplicationHistory.create_date))
        )
        rows = list(result.scalars().all())
        return [
            r
            for r in rows
            if isinstance(r.ci_application_snapshot, dict)
            and r.ci_application_snapshot.get("type")
            == self.COMMENT_SNAPSHOT_TYPE
        ]

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

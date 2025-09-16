import structlog
from typing import List, Sequence
from fastapi import Depends
from sqlalchemy import asc, delete, select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.compliance import ChargingSiteStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler


logger = structlog.get_logger(__name__)


class ChargingSiteRepo:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_intended_user_types(self) -> Sequence[EndUserType]:
        """
        Retrieve a list of intended user types from the database
        """
        return (
            (
                await self.db.execute(
                    select(EndUserType).where(EndUserType.intended_use == True)
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_charging_site_status_by_name(
        self, status_name: str
    ) -> ChargingSiteStatus:
        """
        Retrieve a charging site status by its name from the database
        """
        return (
            (
                await self.db.execute(
                    select(ChargingSiteStatus).where(
                        ChargingSiteStatus.status == status_name
                    )
                )
            )
            .scalars()
            .first()
        )

    @repo_handler
    async def get_end_user_types_by_ids(self, ids: List[int]) -> List[EndUserType]:
        """Get EndUserType objects by their IDs"""
        result = await self.db.execute(
            select(EndUserType).where(EndUserType.end_user_type_id.in_(ids))
        )
        return result.scalars().all()

    @repo_handler
    async def create_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Create a new charging site in the database
        """
        self.db.add(charging_site)
        await self.db.flush()
        return charging_site

    @repo_handler
    async def get_all_charging_sites_by_organization_id(
        self, organization_id: int
    ) -> Sequence[ChargingSite]:
        """
        Retrieve all charging sites from the database
        """
        query = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                selectinload(ChargingSite.intended_users),
            )
            .where(ChargingSite.organization_id == organization_id)
            .order_by(asc(ChargingSite.create_date))
        )
        results = await self.db.execute(query)

        return results.scalars().all()

    @repo_handler
    async def get_all_charging_sites_paginated(
        self, offset: int, limit: int, conditions: list, sort_orders: list
    ) -> tuple[list[ChargingSite], int]:
        """
        Retrieve all charging sites with pagination, filtering, and sorting.
        """
        stmt = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                selectinload(ChargingSite.intended_users),
            )
            .where(and_(*conditions) if conditions else True)
        )

        # Apply sort orders
        for order in sort_orders or []:
            direction = asc if getattr(order, 'direction', 'asc') == 'asc' else desc
            field = getattr(ChargingSite, getattr(order, 'field', 'create_date'), None)
            if field is not None:
                stmt = stmt.order_by(direction(field))

        if not sort_orders:
            stmt = stmt.order_by(ChargingSite.create_date.asc())

        # Count total
        total = await self.db.scalar(select(func.count()).select_from(stmt.subquery()))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)
        results = await self.db.execute(stmt)
        rows = results.scalars().all()
        return rows, total or 0

    @repo_handler
    async def get_charging_sites_paginated(
        self,
        offset: int,
        limit: int,
        conditions: list,
        sort_orders: list,
        organization_id: int,
    ) -> tuple[list[ChargingSite], int]:
        """
        Retrieve charging sites for a specific organization with pagination.
        """
        org_condition = ChargingSite.organization_id == organization_id
        all_conditions = [org_condition] + (conditions or [])
        return await self.get_all_charging_sites_paginated(
            offset, limit, all_conditions, sort_orders
        )

    @repo_handler
    async def update_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Update an existing charging site in the database using merge
        """
        merged_site = await self.db.merge(charging_site)
        await self.db.flush()
        await self.db.refresh(merged_site)
        return merged_site

    @repo_handler
    async def get_charging_site_by_id(self, charging_site_id: int) -> ChargingSite:
        """
        Retrieve a charging site by its ID from the database
        """
        return (
            (
                await self.db.execute(
                    select(ChargingSite)
                    .options(
                        joinedload(ChargingSite.status),
                        selectinload(ChargingSite.intended_users),
                    )
                    .where(ChargingSite.charging_site_id == charging_site_id)
                )
            )
            .scalars()
            .first()
        )

    @repo_handler
    async def delete_charging_site(self, charging_site_id: int) -> None:
        """
        Delete charging site using SQLAlchemy relationship management
        """
        # Get the charging site object
        result = await self.db.execute(
            select(ChargingSite)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .options(
                selectinload(ChargingSite.intended_users),
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment)
            )
        )
        charging_site = result.scalar_one_or_none()
        
        if not charging_site:
            raise ValueError(f"Charging site with ID {charging_site_id} not found")
        
        # Clear many-to-many relationships
        charging_site.intended_users.clear()
        charging_site.documents.clear()
        
        # Delete related charging equipment
        for equipment in charging_site.charging_equipment:
            await self.db.delete(equipment)
        
        # Delete the charging site
        await self.db.delete(charging_site)
        await self.db.flush()
        await self.db.commit()

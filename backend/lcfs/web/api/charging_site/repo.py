import structlog
from typing import List, Optional, Sequence
from fastapi import Depends
from sqlalchemy import asc, delete, select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ChargingSiteStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.document.Document import Document
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class ChargingSiteRepo:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_intended_user_types(self) -> Sequence[EndUserType]:
        """
        Retrieve all end user types that are marked as intended use
        """
        return (
            (await self.db.execute(select(EndUserType).where(EndUserType.intended_use)))
            .scalars()
            .all()
        )

    @repo_handler
    async def get_charging_site_status_by_name(
        self, status_name: str
    ) -> ChargingSiteStatus:
        """
        Retrieve a charging site status by its name
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
        """
        Retrieve end user types by their IDs
        """
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
        Retrieve all charging sites for a specific organization, ordered by creation date
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
        Update an existing charging site in the database
        """
        merged_site = await self.db.merge(charging_site)
        await self.db.flush()
        await self.db.refresh(merged_site)
        return merged_site

    @repo_handler
    async def get_charging_site_by_id(
        self, charging_site_id: int
    ) -> Optional[ChargingSite]:
        """
        Retrieve a charging site by its ID with related data preloaded
        """
        # enrich loads a bit to support downstream access without extra roundtrips
        result = await self.db.execute(
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.organization),
                selectinload(ChargingSite.intended_users),
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment),
            )
            .where(ChargingSite.charging_site_id == charging_site_id)
        )
        return result.scalars().first()

    @repo_handler
    async def delete_charging_site(self, charging_site_id: int) -> None:
        """
        Delete a charging site and all its related data (equipment, documents, user associations)
        """
        result = await self.db.execute(
            select(ChargingSite)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .options(
                selectinload(ChargingSite.intended_users),
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment),
            )
        )
        charging_site = result.scalar_one_or_none()

        if not charging_site:
            raise ValueError(f"Charging site with ID {charging_site_id} not found")

        charging_site.intended_users.clear()
        charging_site.documents.clear()

        for equipment in charging_site.charging_equipment:
            await self.db.delete(equipment)

        await self.db.delete(charging_site)
        await self.db.flush()
        await self.db.commit()

    @repo_handler
    async def get_charging_sites(
        self, organization_id: Optional[int] = None
    ) -> Sequence[ChargingSite]:
        """
        Retrieve all charging sites, optional filter by organization_id
        """
        query = select(ChargingSite).options(
            joinedload(ChargingSite.status),
            selectinload(ChargingSite.intended_users),
            selectinload(ChargingSite.documents),
            selectinload(ChargingSite.charging_equipment),
        )
        if organization_id:
            query = query.where(ChargingSite.organization_id == organization_id)

        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_charging_site_statuses(self) -> Sequence[ChargingSiteStatus]:
        """
        List all charging site statuses, ordered by display order if available
        """
        query = select(ChargingSiteStatus)
        try:
            query = query.order_by(ChargingSiteStatus.display_order)
        except Exception:
            query = query.order_by(ChargingSiteStatus.status)
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def update_charging_site_status(
        self, site_id: int, status_id: int
    ) -> Optional[ChargingSite]:
        """
        Update the status of a charging site
        """
        result = await self.db.execute(
            select(ChargingSite).where(ChargingSite.charging_site_id == site_id)
        )
        charging_site = result.scalar_one_or_none()
        if charging_site:
            charging_site.status_id = status_id
            await self.db.merge(charging_site)
            await self.db.flush()
            return charging_site
        return None

    @repo_handler
    async def bulk_update_equipment_status(
        self, equipment_ids: List[int], new_status: str
    ) -> List[ChargingEquipment]:
        """
        Bulk update status for multiple charging equipment records
        """
        # Resolve new status id
        status_result = await self.db.execute(
            select(ChargingEquipmentStatus).where(
                ChargingEquipmentStatus.status == new_status
            )
        )
        status_obj = status_result.scalar_one_or_none()
        if not status_obj:
            raise ValueError(f"Invalid status, {new_status}")

        # Load equipment rows
        equip_result = await self.db.execute(
            select(ChargingEquipment)
            .options(
                joinedload(ChargingEquipment.charging_site),
                joinedload(ChargingEquipment.status),
                joinedload(ChargingEquipment.level_of_equipment),
                joinedload(ChargingEquipment.allocating_organization),
            )
            .where(ChargingEquipment.charging_equipment_id.in_(equipment_ids))
        )
        equipment_list = equip_result.unique().scalars().all()

        for equipment in equipment_list:
            equipment.status_id = status_obj.charging_equipment_status_id

        await self.db.flush()
        return equipment_list

    @repo_handler
    async def get_documents_for_charging_site(self, site_id: int) -> Sequence[Document]:
        """
        Retrieve all documents associated with a charging site
        """
        site = await self.get_charging_site_by_id(site_id)
        return site.documents if site else []

    @repo_handler
    async def get_equipment_for_charging_site_paginated(
        self, site_id: int, pagination: PaginationRequestSchema
    ):
        """
        Get charging equipment for a specific site with pagination, filtering, and sorting
        """
        conditions = [ChargingEquipment.charging_site_id == site_id]

        # Base query for equipment
        query = select(ChargingEquipment).options(
            joinedload(ChargingEquipment.charging_site),
            joinedload(ChargingEquipment.status),
            joinedload(ChargingEquipment.level_of_equipment),
            joinedload(ChargingEquipment.intended_uses),
            joinedload(ChargingEquipment.allocating_organization),
        )

        # Field mapping for relationship fields to filterable database fields
        field_mappings = {
            "allocating_organization": "organization_name",  # Map to direct column
            # Remove status filtering for now due to relationship complexity
        }

        # Apply filters if provided
        if pagination.filters:
            for filter_condition in pagination.filters:
                # Skip status filtering as it's a relationship field
                if filter_condition.field == "status":
                    continue

                # Map frontend field names to database field names
                actual_field = field_mappings.get(
                    filter_condition.field, filter_condition.field
                )

                field = get_field_for_filter(ChargingEquipment, actual_field)
                if field is not None:
                    condition = apply_filter_conditions(
                        field,
                        filter_condition.filter,
                        filter_condition.type,
                        filter_condition.filter_type,
                    )
                    if condition is not None:
                        conditions.append(condition)

        # Add all conditions to the query
        if conditions:
            query = query.where(*conditions)

        # Apply sorting
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                # Skip status sorting as it's a relationship field
                if sort_order.field == "status":
                    continue

                # Map frontend field names to database field names
                actual_field = field_mappings.get(sort_order.field, sort_order.field)

                field = get_field_for_filter(ChargingEquipment, actual_field)
                if field is not None:
                    if sort_order.direction.lower() == "desc":
                        query = query.order_by(field.desc())
                    else:
                        query = query.order_by(field.asc())
        else:
            # Default sort by equipment number
            query = query.order_by(ChargingEquipment.equipment_number)

        # Get total count
        count_query = (
            select(func.count()).select_from(ChargingEquipment).where(*conditions)
        )
        total_count = await self.db.scalar(count_query)

        # Apply pagination
        offset = (pagination.page - 1) * pagination.size
        query = query.offset(offset).limit(pagination.size)

        # Execute query
        result = await self.db.execute(query)
        equipment = result.unique().scalars().all()

        return equipment, total_count

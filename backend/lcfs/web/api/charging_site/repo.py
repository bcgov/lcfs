import structlog
from typing import List, Optional, Sequence
from fastapi import Depends
from sqlalchemy import asc, func, select, func, and_, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload, aliased


from lcfs.db.models.compliance import (
    EndUserType,
    ChargingSite,
    ChargingEquipment,
    ChargingSiteStatus,
    ChargingEquipmentStatus,
)
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)


logger = structlog.get_logger(__name__)


class ChargingSiteRepository:
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
    async def get_charging_equipment_statuses(
        self,
    ) -> Sequence[ChargingEquipmentStatus]:
        """
        Retrieve a list of charging equipment statuses from the database
        """
        return (await self.db.execute(select(ChargingEquipmentStatus))).scalars().all()

    @repo_handler
    async def get_charging_site_statuses(self) -> Sequence[ChargingSiteStatus]:
        """
        Retrieve a list of charging site statuses from the database
        """
        return (await self.db.execute(select(ChargingSiteStatus))).scalars().all()

    @repo_handler
    async def get_charging_site_by_id(
        self, charging_site_id: int
    ) -> Optional[ChargingSite]:
        """
        Retrieve a charging site by its ID with related data preloaded
        """
        result = await self.db.execute(
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.intended_users),
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.documents),
            )
            .where(ChargingSite.charging_site_id == charging_site_id)
            .order_by(ChargingSite.version.desc())
            .limit(1)
        )
        return result.scalars().first()

    @repo_handler
    async def get_equipment_for_charging_site_paginated(
        self, site_id: int, pagination: PaginationRequestSchema
    ):
        """
        Get charging equipment for a specific site with pagination, filtering, and sorting
        """
        # Conditions for the base subquery (before ranking)
        base_conditions = [ChargingEquipment.charging_site_id == site_id]

        # Exclude Decommissioned FSE's in the base query
        base_conditions.append(
            ~ChargingEquipment.status.has(
                ChargingEquipmentStatus.status == "Decommissioned"
            )
        )

        # Apply status filters to base conditions (before ranking)
        status_conditions = []
        non_status_conditions = []

        if pagination.filters:
            STATUS_FILTER_MAP = {
                "equals": lambda status_value: ChargingEquipment.status.has(
                    ChargingEquipmentStatus.status == status_value
                ),
                "not_equals": lambda status_value: ~ChargingEquipment.status.has(
                    ChargingEquipmentStatus.status == status_value
                ),
            }

            for filter_condition in pagination.filters:
                if filter_condition.field == "status":
                    filter_func = STATUS_FILTER_MAP.get(filter_condition.type)
                    if filter_func:
                        status_conditions.append(filter_func(filter_condition.filter))
                else:
                    non_status_conditions.append(filter_condition)

        # Add status conditions to base conditions
        base_conditions.extend(status_conditions)

        # Base query for equipment with all base conditions
        ranked_subquery = (
            select(
                ChargingEquipment,
                func.row_number()
                .over(
                    partition_by=ChargingEquipment.charging_equipment_id,
                    order_by=ChargingEquipment.version.desc(),
                )
                .label("rn"),
            )
            .where(*base_conditions)  # Apply base conditions here
            .subquery()
        )

        # Create an alias for the subquery
        ranked_equipment = aliased(ChargingEquipment, ranked_subquery)

        query = (
            select(ranked_equipment)
            .options(
                joinedload(ranked_equipment.charging_site).selectinload(
                    ChargingSite.intended_users
                ),
                joinedload(ranked_equipment.status),
                joinedload(ranked_equipment.level_of_equipment),
                selectinload(ranked_equipment.intended_uses),
                joinedload(ranked_equipment.allocating_organization),
            )
            .where(ranked_subquery.c.rn == 1)
        )

        # Field mapping for relationship fields to filterable database fields
        field_mappings = {
            "allocating_organization": "organization_name",
        }

        # Apply non-status filters to the main query
        if non_status_conditions:
            for filter_condition in non_status_conditions:
                # Map frontend field names to database field names
                actual_field = field_mappings.get(
                    filter_condition.field, filter_condition.field
                )

                field = get_field_for_filter(ranked_equipment, actual_field)
                if field is not None:
                    condition = apply_filter_conditions(
                        field,
                        filter_condition.filter,
                        filter_condition.type,
                        filter_condition.filter_type,
                    )
                    if condition is not None:
                        query = query.where(condition)

        # Apply sorting
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                # Skip status sorting as it's a relationship field
                if sort_order.field == "status":
                    continue

                # Map frontend field names to database field names
                actual_field = field_mappings.get(sort_order.field, sort_order.field)

                field = get_field_for_filter(ranked_equipment, actual_field)
                if field is not None:
                    if sort_order.direction.lower() == "desc":
                        query = query.order_by(field.desc())
                    else:
                        query = query.order_by(field.asc())
        else:
            # Default sort by create date
            query = query.order_by(ranked_equipment.update_date.asc())

        # Get total count using the same base conditions
        count_query = (
            select(func.count(func.distinct(ChargingEquipment.charging_equipment_id)))
            .select_from(ChargingEquipment)
            .where(*base_conditions)
        )
        total_count = await self.db.scalar(count_query)

        # Apply pagination
        offset = (pagination.page - 1) * pagination.size
        query = query.offset(offset).limit(pagination.size)

        # Execute query
        result = await self.db.execute(query)
        equipment = result.unique().scalars().all()

        return equipment, total_count

    @repo_handler
    async def bulk_update_equipment_status(
        self,
        equipment_ids: List[int],
        new_status_id: int,
        allowed_source_status_ids: List[int],
    ) -> List[int]:
        """
        Bulk update equipment status, only updating equipment that's in one of the allowed source statuses
        """
        # Update only equipment that's currently in one of the allowed source statuses
        stmt = (
            update(ChargingEquipment)
            .where(
                ChargingEquipment.charging_equipment_id.in_(equipment_ids),
                ChargingEquipment.status_id.in_(allowed_source_status_ids),
            )
            .values(status_id=new_status_id)
            .returning(ChargingEquipment.charging_equipment_id)
        )

        result = await self.db.execute(stmt)
        updated_ids = [row[0] for row in result.fetchall()]
        return updated_ids

    @repo_handler
    async def get_charging_sites(
        self, organization_id: Optional[int] = None
    ) -> Sequence[ChargingSite]:
        """
        Retrieve all charging sites, optionally filtered by organization
        """
        query = select(ChargingSite).options(
            joinedload(ChargingSite.organization),
            joinedload(ChargingSite.status),
            selectinload(ChargingSite.documents),
            selectinload(ChargingSite.charging_equipment),
        )

        if organization_id:
            query = query.where(ChargingSite.organization_id == organization_id)

        result = await self.db.execute(query)
        return result.unique().scalars().all()

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
    async def get_charging_sites_by_ids(
        self, charging_site_ids: List[int]
    ) -> Sequence[ChargingSite]:
        """
        Retrieve charging sites by their IDs, ordered by creation date
        """
        query = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.status),
                selectinload(ChargingSite.intended_users),
            )
            .where(ChargingSite.charging_site_id.in_(charging_site_ids))
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
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.status),
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.intended_users),
            )
            .where(and_(*conditions) if conditions else True)
        )

        # Apply sort orders
        for order in sort_orders or []:
            direction = asc if getattr(order, "direction", "asc") == "asc" else desc
            field = getattr(ChargingSite, getattr(order, "field", "create_date"), None)
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
    async def get_charging_site_by_site_name(self, site_name: str) -> ChargingSite:
        """
        Retrieve a charging site by its name from the database
        """
        return (
            (
                await self.db.execute(
                    select(ChargingSite).where(ChargingSite.site_name == site_name)
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
    async def update_charging_site(self, charging_site: ChargingSite) -> ChargingSite:
        """
        Update an existing charging site in the database
        """
        merged_site = await self.db.merge(charging_site)
        await self.db.flush()
        await self.db.refresh(merged_site)
        return merged_site

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

    @repo_handler
    async def update_charging_site_status(
        self,
        charging_site_id: int,
        status_id: int,
    ) -> None:
        """
        Update the status of a charging site
        """
        stmt = (
            update(ChargingSite)
            .where(ChargingSite.charging_site_id == charging_site_id)
            .values(status_id=status_id)
        )

        await self.db.execute(stmt)

    @repo_handler
    async def get_charging_site_options(self, organization):
        """
        Get options for charging site dropdowns (statuses and intended users)
        """
        statuses = await self.get_charging_site_statuses()
        intended_users = await self.get_intended_user_types()
        return [statuses, intended_users]

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
    async def delete_all_charging_sites_by_organization(self, organization_id: int):
        """
        Delete all charging sites for an organization (used for overwrite import)
        """
        # Get all charging sites for the organization
        result = await self.db.execute(
            select(ChargingSite)
            .where(ChargingSite.organization_id == organization_id)
            .options(
                selectinload(ChargingSite.intended_users),
                selectinload(ChargingSite.documents),
                selectinload(ChargingSite.charging_equipment),
                joinedload(ChargingEquipment.allocating_organization),
            )
        )
        charging_sites = result.scalars().all()

        # Delete each charging site and its relationships
        for charging_site in charging_sites:
            # Clear many-to-many relationships
            charging_site.intended_users.clear()
            charging_site.documents.clear()

            # Delete related charging equipment
            for equipment in charging_site.charging_equipment:
                await self.db.delete(equipment)

            # Delete the charging site
            await self.db.delete(charging_site)

        await self.db.flush()

from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
import structlog
from typing import List, Optional, Sequence
from fastapi import Depends
from sqlalchemy import asc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload, aliased

from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.compliance import ChargingEquipment, ChargingSiteStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from sqlalchemy import update


logger = structlog.get_logger(__name__)


class ChargingSiteRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

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
            joinedload(ChargingSite.documents),
            joinedload(ChargingSite.charging_equipment),
        )

        if organization_id:
            query = query.where(ChargingSite.organization_id == organization_id)

        result = await self.db.execute(query)
        return result.unique().scalars().all()

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
                        joinedload(ChargingSite.intended_users),
                        joinedload(ChargingSite.organization),
                        joinedload(ChargingSite.documents),
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
        self, site_id: int, status_id: int
    ) -> Optional[ChargingSite]:
        """
        Update the status of a charging site
        """
        query = select(ChargingSite).where(ChargingSite.charging_site_id == site_id)
        result = await self.db.execute(query)
        charging_site = result.scalar_one_or_none()

        if charging_site:
            charging_site.status_id = status_id
            await self.db.merge(charging_site)
            await self.db.flush()
            return charging_site
        return None

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
            query = query.order_by(ranked_equipment.create_date.asc())

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

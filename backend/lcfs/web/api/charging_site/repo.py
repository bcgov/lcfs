from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from fastapi import Depends
from typing import List, Optional, Sequence

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.document.Document import Document
from lcfs.web.core.decorators import repo_handler


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
    async def get_charging_site_by_id(self, site_id: int) -> Optional[ChargingSite]:
        """
        Retrieve a specific charging site by ID
        """
        query = (
            select(ChargingSite)
            .options(
                joinedload(ChargingSite.organization),
                joinedload(ChargingSite.status),
                joinedload(ChargingSite.documents),
                joinedload(ChargingSite.charging_equipment),
                joinedload(ChargingSite.intended_users),
            )
            .where(ChargingSite.charging_site_id == site_id)
        )

        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()

    @repo_handler
    async def get_charging_site_statuses(self) -> Sequence[ChargingSiteStatus]:
        """
        Get all available charging site statuses
        """
        query = select(ChargingSiteStatus).order_by(ChargingSiteStatus.display_order)
        result = await self.db.execute(query)
        return result.scalars().all()

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
        self, equipment_ids: List[int], new_status: str
    ) -> List[ChargingEquipment]:
        """
        Bulk update status for multiple charging equipment records.
        """
        # Get the status ID for the new status
        status_query = select(ChargingEquipmentStatus).where(
            ChargingEquipmentStatus.status == new_status
        )
        status_result = await self.db.execute(status_query)
        status_obj = status_result.scalar_one_or_none()

        if not status_obj:
            raise ValueError(f"Invalid status: {new_status}")

        # Get the equipment records to update
        query = (
            select(ChargingEquipment)
            .options(
                joinedload(ChargingEquipment.charging_site),
                joinedload(ChargingEquipment.status),
                joinedload(ChargingEquipment.level_of_equipment),
                joinedload(ChargingEquipment.allocating_organization),
            )
            .where(ChargingEquipment.charging_equipment_id.in_(equipment_ids))
        )
        result = await self.db.execute(query)
        equipment_list = result.unique().scalars().all()

        # Update the status for each equipment
        for equipment in equipment_list:
            equipment.status_id = status_obj.charging_equipment_status_id

        await self.db.flush()
        return equipment_list

    @repo_handler
    async def get_documents_for_charging_site(self, site_id: int) -> Sequence[Document]:
        """
        Get all documents associated with a charging site
        """
        charging_site = await self.get_charging_site_by_id(site_id)
        if charging_site:
            return charging_site.documents
        return []

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

"""Repository for Charging Equipment database operations."""

import structlog
from typing import List, Optional, Dict, Any
from fastapi import Depends
from sqlalchemy import select, func, and_, or_, update, delete, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import DatabaseError

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_equipment.schema import (
    ChargingEquipmentFilterSchema,
    ChargingEquipmentStatusEnum,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class ChargingEquipmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_charging_equipment_by_id(
        self, charging_equipment_id: int
    ) -> Optional[ChargingEquipment]:
        """Get charging equipment by ID with related data."""
        query = (
            select(ChargingEquipment)
            .options(
                selectinload(ChargingEquipment.charging_site),
                selectinload(ChargingEquipment.status),
                selectinload(ChargingEquipment.level_of_equipment),
                selectinload(ChargingEquipment.allocating_organization),
                selectinload(ChargingEquipment.intended_uses),
            )
            .where(ChargingEquipment.charging_equipment_id == charging_equipment_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    @repo_handler
    async def get_charging_equipment_list(
        self,
        organization_id: int,
        pagination: PaginationRequestSchema,
        filters: Optional[ChargingEquipmentFilterSchema] = None,
    ) -> tuple[List[ChargingEquipment], int]:
        """Get paginated list of charging equipment for an organization."""

        # Base query with joins
        query = (
            select(ChargingEquipment)
            .join(
                ChargingSite,
                ChargingEquipment.charging_site_id == ChargingSite.charging_site_id,
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .join(
                LevelOfEquipment,
                ChargingEquipment.level_of_equipment_id
                == LevelOfEquipment.level_of_equipment_id,
            )
            .outerjoin(
                Organization,
                ChargingEquipment.allocating_organization_id
                == Organization.organization_id,
            )
            .options(
                joinedload(ChargingEquipment.charging_site),
                joinedload(ChargingEquipment.status),
                joinedload(ChargingEquipment.level_of_equipment),
                joinedload(ChargingEquipment.allocating_organization),
                selectinload(ChargingEquipment.intended_uses),
            )
            .where(ChargingSite.organization_id == organization_id)
        )

        # Apply filters
        if filters:
            if filters.status:
                status_names = [s.value for s in filters.status]
                query = query.where(ChargingEquipmentStatus.status.in_(status_names))

            if filters.charging_site_id:
                query = query.where(
                    ChargingEquipment.charging_site_id == filters.charging_site_id
                )

            if filters.manufacturer:
                query = query.where(
                    ChargingEquipment.manufacturer.ilike(f"%{filters.manufacturer}%")
                )

            if filters.search_term:
                search_pattern = f"%{filters.search_term}%"
                query = query.where(
                    or_(
                        ChargingEquipment.equipment_number.ilike(search_pattern),
                        ChargingEquipment.serial_number.ilike(search_pattern),
                        ChargingEquipment.manufacturer.ilike(search_pattern),
                        ChargingEquipment.model.ilike(search_pattern),
                        ChargingSite.site_name.ilike(search_pattern),
                    )
                )

        # Apply sorting
        if pagination.sort_orders:
            for sort in pagination.sort_orders:
                column = getattr(ChargingEquipment, sort.field, None)
                if column:
                    if sort.direction == "desc":
                        query = query.order_by(column.desc())
                    else:
                        query = query.order_by(column.asc())
        else:
            # Default sorting by updated_at desc
            query = query.order_by(ChargingEquipment.update_date.desc())

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar()

        # Apply pagination
        offset = (pagination.page - 1) * pagination.size
        query = query.offset(offset).limit(pagination.size)

        # Execute query
        result = await self.db.execute(query)
        items = result.scalars().all()

        return items, total_count

    @repo_handler
    async def get_all_equipment_by_organization_id(
        self, organization_id: int
    ) -> List[ChargingEquipment]:
        """Return all charging equipment for a supplier organization with relationships loaded."""
        query = (
            select(ChargingEquipment)
            .join(ChargingSite)
            .options(
                joinedload(ChargingEquipment.charging_site),
                joinedload(ChargingEquipment.status),
                joinedload(ChargingEquipment.level_of_equipment),
                joinedload(ChargingEquipment.allocating_organization),
                selectinload(ChargingEquipment.intended_uses),
            )
            .where(ChargingSite.organization_id == organization_id)
            .order_by(ChargingEquipment.update_date.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def delete_all_equipment_for_organization(self, organization_id: int) -> int:
        """Delete all charging equipment records for a supplier organization."""
        subq = (
            select(ChargingEquipment.charging_equipment_id)
            .join(ChargingSite)
            .where(ChargingSite.organization_id == organization_id)
        )
        del_stmt = delete(ChargingEquipment).where(
            ChargingEquipment.charging_equipment_id.in_(subq)
        )
        result = await self.db.execute(del_stmt)
        await self.db.flush()
        return result.rowcount or 0

    @repo_handler
    async def create_charging_equipment(
        self, equipment_data: Dict[str, Any]
    ) -> ChargingEquipment:
        """Create new charging equipment."""

        # Get Draft status ID
        status_query = select(ChargingEquipmentStatus).where(
            ChargingEquipmentStatus.status == "Draft"
        )
        status_result = await self.db.execute(status_query)
        draft_status = status_result.scalar_one()

        # Create charging equipment
        charging_equipment = ChargingEquipment(
            charging_site_id=equipment_data["charging_site_id"],
            status_id=draft_status.charging_equipment_status_id,
            allocating_organization_id=equipment_data.get("allocating_organization_id"),
            serial_number=equipment_data["serial_number"],
            manufacturer=equipment_data["manufacturer"],
            model=equipment_data.get("model"),
            level_of_equipment_id=equipment_data["level_of_equipment_id"],
            ports=equipment_data.get("ports"),
            notes=equipment_data.get("notes"),
            version=1,
        )

        # Add intended uses if provided
        if equipment_data.get("intended_use_ids"):
            intended_uses_query = select(EndUseType).where(
                EndUseType.end_use_type_id.in_(equipment_data["intended_use_ids"])
            )
            intended_uses_result = await self.db.execute(intended_uses_query)
            intended_uses = intended_uses_result.scalars().all()
            charging_equipment.intended_uses = intended_uses

        self.db.add(charging_equipment)
        await self.db.flush()
        await self.db.refresh(charging_equipment)
        # ensure related charging site (for registration number) is loaded for downstream use
        await self.db.refresh(charging_equipment, attribute_names=["charging_site"])

        return charging_equipment

    @repo_handler
    async def update_charging_equipment(
        self, charging_equipment_id: int, equipment_data: Dict[str, Any]
    ) -> Optional[ChargingEquipment]:
        """Update existing charging equipment."""

        # Get existing equipment
        equipment = await self.get_charging_equipment_by_id(charging_equipment_id)
        if not equipment:
            return None

        # Check if status allows editing
        if equipment.status.status not in ["Draft", "Updated"]:
            # If Validated, create a new version
            if equipment.status.status == "Validated":
                equipment.version += 1

                # Get Updated status ID
                status_query = select(ChargingEquipmentStatus).where(
                    ChargingEquipmentStatus.status == "Updated"
                )
                status_result = await self.db.execute(status_query)
                updated_status = status_result.scalar_one()
                equipment.status_id = updated_status.charging_equipment_status_id

        # Update fields
        for field, value in equipment_data.items():
            if field != "intended_use_ids" and value is not None:
                setattr(equipment, field, value)

        # Update intended uses if provided
        if "intended_use_ids" in equipment_data:
            if equipment_data["intended_use_ids"] is not None:
                intended_uses_query = select(EndUseType).where(
                    EndUseType.end_use_type_id.in_(equipment_data["intended_use_ids"])
                )
                intended_uses_result = await self.db.execute(intended_uses_query)
                intended_uses = intended_uses_result.scalars().all()
                equipment.intended_uses = intended_uses

        await self.db.flush()
        await self.db.refresh(equipment)
        await self.db.refresh(equipment, attribute_names=["charging_site"])

        return equipment

    @repo_handler
    async def bulk_update_status(
        self, equipment_ids: List[int], new_status: str, organization_id: int
    ) -> int:
        """Bulk update status for multiple charging equipment."""

        # Get the status ID
        status_query = select(ChargingEquipmentStatus).where(
            ChargingEquipmentStatus.status == new_status
        )
        status_result = await self.db.execute(status_query)
        status = status_result.scalar_one_or_none()

        if not status:
            raise ValueError(f"Invalid status: {new_status}")

        # Update equipment status
        update_query = (
            update(ChargingEquipment)
            .where(
                and_(
                    ChargingEquipment.charging_equipment_id.in_(equipment_ids),
                    ChargingEquipment.charging_site.has(
                        ChargingSite.organization_id == organization_id
                    ),
                )
            )
            .values(status_id=status.charging_equipment_status_id)
        )

        result = await self.db.execute(update_query)
        await self.db.flush()

        return result.rowcount

    @repo_handler
    async def delete_charging_equipment(
        self, charging_equipment_id: int, organization_id: int
    ) -> bool:
        """Delete charging equipment if in Draft status."""

        # Check if equipment exists and is in Draft status
        equipment = await self.get_charging_equipment_by_id(charging_equipment_id)

        if not equipment:
            return False

        if equipment.status.status != "Draft":
            raise ValueError("Only Draft equipment can be deleted")

        if equipment.charging_site.organization_id != organization_id:
            raise ValueError("Unauthorized to delete this equipment")

        # Delete the equipment
        await self.db.delete(equipment)
        await self.db.flush()

        return True

    @repo_handler
    async def get_statuses(self) -> List[ChargingEquipmentStatus]:
        """Get all charging equipment statuses."""
        query = select(ChargingEquipmentStatus).order_by(
            ChargingEquipmentStatus.display_order
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_equipment_status_map(
        self, equipment_ids: List[int], organization_id: int
    ) -> Dict[int, str]:
        """Return a mapping of equipment_id -> current status string for the given org."""
        if not equipment_ids:
            return {}
        query = (
            select(
                ChargingEquipment.charging_equipment_id,
                ChargingEquipmentStatus.status,
            )
            .join(
                ChargingEquipmentStatus,
                ChargingEquipment.status_id
                == ChargingEquipmentStatus.charging_equipment_status_id,
            )
            .join(
                ChargingSite,
                ChargingEquipment.charging_site_id == ChargingSite.charging_site_id,
            )
            .where(
                and_(
                    ChargingEquipment.charging_equipment_id.in_(equipment_ids),
                    ChargingSite.organization_id == organization_id,
                )
            )
        )
        result = await self.db.execute(query)
        rows = result.all()
        return {row[0]: row[1] for row in rows}

    @repo_handler
    async def get_levels_of_equipment(self) -> List[LevelOfEquipment]:
        """Get all levels of equipment."""
        query = select(LevelOfEquipment).order_by(LevelOfEquipment.display_order)
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_end_use_types(self) -> List[EndUseType]:
        """Get all end use types."""
        query = select(EndUseType).order_by(EndUseType.display_order)
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_charging_sites_by_organization(
        self, organization_id: int
    ) -> List[ChargingSite]:
        """Get all charging sites for an organization."""
        query = (
            select(ChargingSite)
            .where(ChargingSite.organization_id == organization_id)
            .order_by(ChargingSite.site_name)
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_organizations(self) -> List[Organization]:
        """Get all organizations for allocating organization dropdown."""
        query = select(Organization).order_by(Organization.name)
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def has_allocation_agreements_for_organization(
        self, organization_id: int
    ) -> bool:
        """Return True if the supplier org has any allocation agreements in any of its reports."""
        if not organization_id:
            return False
        query = (
            select(func.count())
            .select_from(AllocationAgreement)
            .join(
                ComplianceReport,
                AllocationAgreement.compliance_report_id
                == ComplianceReport.compliance_report_id,
            )
            .where(ComplianceReport.organization_id == organization_id)
        )
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return count > 0

    @repo_handler
    async def get_charging_site_ids_from_equipment(
        self, equipment_ids: List[int], organization_id: int
    ) -> List[int]:
        """Get unique charging site IDs from equipment list."""
        query = (
            select(ChargingEquipment.charging_site_id)
            .distinct()
            .join(ChargingSite)
            .where(
                and_(
                    ChargingEquipment.charging_equipment_id.in_(equipment_ids),
                    ChargingSite.organization_id == organization_id,
                )
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def update_charging_sites_status(
        self, site_ids: List[int], current_statuses: List[str], new_status: str
    ) -> int:
        """Update charging sites status if they are in specified current statuses."""
        from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus

        # Get the new status ID
        status_query = select(ChargingSiteStatus).where(
            ChargingSiteStatus.status == new_status
        )
        status_result = await self.db.execute(status_query)
        new_status_obj = status_result.scalar_one_or_none()

        if not new_status_obj:
            return 0

        # Get current status IDs
        current_status_query = select(ChargingSiteStatus).where(
            ChargingSiteStatus.status.in_(current_statuses)
        )
        current_status_result = await self.db.execute(current_status_query)
        current_status_objs = current_status_result.scalars().all()
        current_status_ids = [s.charging_site_status_id for s in current_status_objs]

        if not current_status_ids:
            return 0

        # Update sites
        update_query = (
            update(ChargingSite)
            .where(
                and_(
                    ChargingSite.charging_site_id.in_(site_ids),
                    ChargingSite.status_id.in_(current_status_ids),
                )
            )
            .values(status_id=new_status_obj.charging_site_status_id)
        )

        result = await self.db.execute(update_query)
        await self.db.flush()

        return result.rowcount

"""Services for Charging Equipment business logic."""

import structlog
from typing import List, Optional
from fastapi import Depends, HTTPException, status

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.charging_equipment.repo import ChargingEquipmentRepository
from lcfs.web.api.charging_equipment.schema import (
    ChargingEquipmentBaseSchema,
    ChargingEquipmentCreateSchema,
    ChargingEquipmentUpdateSchema,
    ChargingEquipmentListSchema,
    ChargingEquipmentListItemSchema,
    ChargingEquipmentFilterSchema,
    ChargingEquipmentStatusEnum,
    BulkActionResponseSchema,
)
from lcfs.web.core.decorators import service_handler
# TODO: add_notification_msg function needs to be implemented
# from lcfs.services.rabbitmq.consumers import add_notification_msg

logger = structlog.get_logger(__name__)


class ChargingEquipmentServices:
    def __init__(
        self,
        repo: ChargingEquipmentRepository = Depends(),
        db_session=Depends(get_async_db_session),
    ):
        self.repo = repo
        self.db = db_session

    @service_handler
    async def get_charging_equipment_list(
        self,
        user: UserProfile,
        pagination: PaginationRequestSchema,
        filters: Optional[ChargingEquipmentFilterSchema] = None,
    ) -> ChargingEquipmentListSchema:
        """Get paginated list of charging equipment for the user's organization."""
        
        # Get organization ID based on user type
        if not user.is_government:
            organization_id = user.organization_id
        else:
            # For government users, they can view all organizations or filter by specific org
            if filters and filters.organization_id:
                organization_id = filters.organization_id
            else:
                # Government users can view all organizations
                organization_id = None
        
        # Get equipment list from repository
        equipment_list, total_count = await self.repo.get_charging_equipment_list(
            organization_id, pagination, filters
        )
        
        # Transform to schema
        items = []
        for equipment in equipment_list:
            item = ChargingEquipmentListItemSchema(
                charging_equipment_id=equipment.charging_equipment_id,
                status=equipment.status.status,
                site_name=equipment.charging_site.site_name,
                registration_number=equipment.registration_number or f"{equipment.charging_site.site_code}-{equipment.equipment_number}",
                version=equipment.version,
                allocating_organization_name=(
                    equipment.allocating_organization.name
                    if equipment.allocating_organization
                    else None
                ),
                serial_number=equipment.serial_number,
                manufacturer=equipment.manufacturer,
                model=equipment.model,
                level_of_equipment_name=equipment.level_of_equipment.name,
                created_date=equipment.create_date,
                updated_date=equipment.update_date,
            )
            items.append(item)
        
        # Calculate pagination info
        total_pages = (total_count + pagination.size - 1) // pagination.size
        
        return ChargingEquipmentListSchema(
            items=items,
            total_count=total_count,
            current_page=pagination.page,
            total_pages=total_pages,
            page_size=pagination.size,
        )

    @service_handler
    async def get_charging_equipment_by_id(
        self, user: UserProfile, charging_equipment_id: int
    ) -> ChargingEquipmentBaseSchema:
        """Get charging equipment details by ID."""
        
        equipment = await self.repo.get_charging_equipment_by_id(charging_equipment_id)
        
        if not equipment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Charging equipment not found",
            )
        
        # Check authorization
        if not user.is_government:
            if equipment.charging_site.organization_id != user.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this equipment",
                )
        
        # Transform to schema
        return ChargingEquipmentBaseSchema(
            charging_equipment_id=equipment.charging_equipment_id,
            charging_site_id=equipment.charging_site_id,
            status=equipment.status.status,
            equipment_number=equipment.equipment_number,
            registration_number=equipment.registration_number,
            allocating_organization_id=equipment.allocating_organization_id,
            allocating_organization_name=(
                equipment.allocating_organization.name
                if equipment.allocating_organization
                else None
            ),
            serial_number=equipment.serial_number,
            manufacturer=equipment.manufacturer,
            model=equipment.model,
            level_of_equipment_id=equipment.level_of_equipment_id,
            level_of_equipment_name=equipment.level_of_equipment.name,
            ports=equipment.ports.value if equipment.ports else None,
            notes=equipment.notes,
            intended_uses=[
                {
                    "end_use_type_id": use.end_use_type_id,
                    "type": use.type,
                    "description": use.sub_type,
                }
                for use in equipment.intended_uses
            ],
            version=equipment.version,
        )

    @service_handler
    async def create_charging_equipment(
        self, user: UserProfile, equipment_data: ChargingEquipmentCreateSchema
    ) -> ChargingEquipmentBaseSchema:
        """Create new charging equipment."""
        
        # Check authorization for the charging site
        # This would need a charging_site repo method to verify ownership
        # For now, we'll trust the site_id is valid for the user
        
        equipment_dict = equipment_data.model_dump()
        
        # Create equipment
        equipment = await self.repo.create_charging_equipment(equipment_dict)
        
        # Log action
        # TODO: Implement notification
        # await add_notification_msg(
        #     action_type=ActionTypeEnum.CREATE,
        #     action="Created charging equipment",
        #     message=f"Created charging equipment {equipment.registration_number}",
        #     related_entity_type="ChargingEquipment",
        #     related_entity_id=equipment.charging_equipment_id,
        #     user=user,
        # )
        
        # Return created equipment
        return await self.get_charging_equipment_by_id(
            user, equipment.charging_equipment_id
        )

    @service_handler
    async def update_charging_equipment(
        self,
        user: UserProfile,
        charging_equipment_id: int,
        equipment_data: ChargingEquipmentUpdateSchema,
    ) -> ChargingEquipmentBaseSchema:
        """Update existing charging equipment."""
        
        # Get existing equipment to check authorization
        existing = await self.repo.get_charging_equipment_by_id(charging_equipment_id)
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Charging equipment not found",
            )
        
        # Check authorization
        if not user.is_government:
            if existing.charging_site.organization_id != user.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this equipment",
                )
        
        # Check if status allows editing
        if existing.status.status not in ["Draft", "Updated", "Validated"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot edit equipment in {existing.status.status} status",
            )
        
        # Update equipment
        equipment_dict = equipment_data.model_dump(exclude_unset=True)
        equipment = await self.repo.update_charging_equipment(
            charging_equipment_id, equipment_dict
        )
        
        # Log action
        # TODO: Implement notification
        # await add_notification_msg(
        #     action_type=ActionTypeEnum.UPDATE,
        #     action="Updated charging equipment",
        #     message=f"Updated charging equipment {equipment.registration_number}",
        #     related_entity_type="ChargingEquipment",
        #     related_entity_id=equipment.charging_equipment_id,
        #     user=user,
        # )
        
        # Return updated equipment
        return await self.get_charging_equipment_by_id(
            user, equipment.charging_equipment_id
        )

    @service_handler
    async def bulk_submit_equipment(
        self, user: UserProfile, equipment_ids: List[int]
    ) -> BulkActionResponseSchema:
        """Bulk submit charging equipment."""
        
        # Check authorization - user must be supplier
        if user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only suppliers can submit equipment",
            )
        
        # Update status to Submitted
        affected_count = await self.repo.bulk_update_status(
            equipment_ids, "Submitted", user.organization_id
        )
        
        if affected_count == 0:
            return BulkActionResponseSchema(
                success=False,
                message="No equipment could be submitted",
                affected_count=0,
                errors=["No valid equipment found or already submitted"],
            )
        
        # Update associated charging sites to Submitted if they are in Draft/Updated
        await self._update_charging_sites_status(equipment_ids, user.organization_id)
        
        # Log action
        # TODO: Implement notification
        # await add_notification_msg(
        #     action_type=ActionTypeEnum.UPDATE,
        #     action="Bulk submitted charging equipment",
        #     message=f"Submitted {affected_count} charging equipment",
        #     related_entity_type="ChargingEquipment",
        #     user=user,
        # )
        
        return BulkActionResponseSchema(
            success=True,
            message=f"Successfully submitted {affected_count} equipment",
            affected_count=affected_count,
        )

    @service_handler
    async def bulk_decommission_equipment(
        self, user: UserProfile, equipment_ids: List[int]
    ) -> BulkActionResponseSchema:
        """Bulk decommission charging equipment."""
        
        # Check authorization - user must be supplier
        if user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only suppliers can decommission equipment",
            )
        
        # Update status to Decommissioned
        affected_count = await self.repo.bulk_update_status(
            equipment_ids, "Decommissioned", user.organization_id
        )
        
        if affected_count == 0:
            return BulkActionResponseSchema(
                success=False,
                message="No equipment could be decommissioned",
                affected_count=0,
                errors=["No valid equipment found or already decommissioned"],
            )
        
        # Log action
        # TODO: Implement notification
        # await add_notification_msg(
        #     action_type=ActionTypeEnum.UPDATE,
        #     action="Bulk decommissioned charging equipment",
        #     message=f"Decommissioned {affected_count} charging equipment",
        #     related_entity_type="ChargingEquipment",
        #     user=user,
        # )
        
        return BulkActionResponseSchema(
            success=True,
            message=f"Successfully decommissioned {affected_count} equipment",
            affected_count=affected_count,
        )

    @service_handler
    async def delete_charging_equipment(
        self, user: UserProfile, charging_equipment_id: int
    ) -> bool:
        """Delete charging equipment if in Draft status."""
        
        # Check authorization - user must be supplier
        if user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only suppliers can delete equipment",
            )
        
        success = await self.repo.delete_charging_equipment(
            charging_equipment_id, user.organization_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found or cannot be deleted",
            )
        
        # Log action
        # TODO: Implement notification
        # await add_notification_msg(
        #     action_type=ActionTypeEnum.DELETE,
        #     action="Deleted charging equipment",
        #     message=f"Deleted charging equipment {charging_equipment_id}",
        #     related_entity_type="ChargingEquipment",
        #     related_entity_id=charging_equipment_id,
        #     user=user,
        # )
        
        return True

    @service_handler
    async def get_equipment_statuses(self):
        """Get all available equipment statuses."""
        statuses = await self.repo.get_statuses()
        return [
            {"status_id": s.charging_equipment_status_id, "status": s.status}
            for s in statuses
        ]

    @service_handler
    async def get_levels_of_equipment(self):
        """Get all levels of equipment."""
        levels = await self.repo.get_levels_of_equipment()
        return [
            {
                "level_of_equipment_id": l.level_of_equipment_id,
                "name": l.name,
                "description": l.description,
            }
            for l in levels
        ]

    @service_handler
    async def get_end_use_types(self):
        """Get all end use types."""
        types = await self.repo.get_end_use_types()
        return [
            {
                "end_use_type_id": t.end_use_type_id,
                "type": t.type,
                "sub_type": t.sub_type,
            }
            for t in types
        ]

    @service_handler
    async def get_charging_sites(self, user: UserProfile):
        """Get charging sites for the user's organization."""
        if user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only suppliers can access charging sites",
            )
        
        sites = await self.repo.get_charging_sites_by_organization(user.organization_id)
        return [
            {
                "charging_site_id": s.charging_site_id,
                "site_name": s.site_name,
                "site_code": s.site_code,
                "street_address": s.street_address,
                "city": s.city,
                "postal_code": s.postal_code,
            }
            for s in sites
        ]

    @service_handler
    async def get_organizations(self):
        """Get all organizations for allocating organization dropdown."""
        organizations = await self.repo.get_organizations()
        return [
            {
                "organization_id": org.organization_id,
                "name": org.name,
            }
            for org in organizations
        ]

    async def _update_charging_sites_status(
        self, equipment_ids: List[int], organization_id: int
    ):
        """Update charging sites to Submitted status when their equipment is submitted."""
        # Get all unique charging site IDs from the submitted equipment
        site_ids = await self.repo.get_charging_site_ids_from_equipment(
            equipment_ids, organization_id
        )
        
        if site_ids:
            # Update sites that are in Draft or Updated status to Submitted
            await self.repo.update_charging_sites_status(
                site_ids, ["Draft", "Updated"], "Submitted"
            )
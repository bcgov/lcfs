"""Services for Charging Equipment business logic."""

import structlog
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

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


# Placeholder for notification integration so tests can patch this symbol
async def add_notification_msg(*args, **kwargs):
    return None


# TODO: add_notification_msg function needs to be implemented
# from lcfs.services.rabbitmq.consumers import add_notification_msg

logger = structlog.get_logger(__name__)


class ChargingEquipmentServices:
    def __init__(
        self,
        repo: ChargingEquipmentRepository = Depends(),
        session: AsyncSession = Depends(get_async_db_session),
    ):
        self.repo = repo
        self.db = session

    @service_handler
    async def get_charging_equipment_list(
        self,
        user: UserProfile,
        pagination: PaginationRequestSchema,
        filters: Optional[ChargingEquipmentFilterSchema] = None,
    ) -> ChargingEquipmentListSchema:
        """Get paginated list of charging equipment for the user's organization."""

        # Get organization scope based on user type
        # Exclude Draft status for government users (IDIR) - they should only see Submitted, Validated, Updated, Decommissioned
        exclude_draft = user.is_government

        if user.is_government:
            organization_id = (
                filters.organization_id if filters and filters.organization_id else None
            )
        else:
            organization_id = user.organization_id

        # Get equipment list from repository
        equipment_list, total_count = await self.repo.get_charging_equipment_list(
            organization_id, pagination, filters, exclude_draft
        )

        # Transform to schema
        items = []
        for equipment in equipment_list:
            item = ChargingEquipmentListItemSchema(
                charging_equipment_id=equipment.charging_equipment_id,
                charging_site_id=equipment.charging_site_id,
                status=equipment.status.status,
                site_name=equipment.charging_site.site_name,
                organization_name=equipment.charging_site.organization.name if equipment.charging_site.organization else None,
                registration_number=equipment.registration_number
                or f"{equipment.charging_site.site_code}-{equipment.equipment_number}",
                version=equipment.version,
                serial_number=equipment.serial_number,
                manufacturer=equipment.manufacturer,
                model=equipment.model,
                level_of_equipment_name=equipment.level_of_equipment.name,
                intended_uses=[
                    {
                        "end_use_type_id": use.end_use_type_id,
                        "type": use.type,
                        "description": use.sub_type,
                    }
                    for use in equipment.intended_uses
                ],
                intended_users=[
                    {
                        "end_user_type_id": user.end_user_type_id,
                        "type_name": user.type_name,
                    }
                    for user in equipment.intended_users
                ],
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
            intended_users=[
                {
                    "end_user_type_id": user.end_user_type_id,
                    "type_name": user.type_name,
                }
                for user in equipment.intended_users
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

        # Log action (tests patch this function)
        await add_notification_msg(
            action_type=ActionTypeEnum.CREATE,
            action="Created charging equipment",
            message=f"Created charging equipment {equipment.registration_number}",
            related_entity_type="ChargingEquipment",
            related_entity_id=equipment.charging_equipment_id,
            user=user,
        )

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

        await add_notification_msg(
            action_type=ActionTypeEnum.UPDATE,
            action="Updated charging equipment",
            message=f"Updated charging equipment {equipment.registration_number}",
            related_entity_type="ChargingEquipment",
            related_entity_id=equipment.charging_equipment_id,
            user=user,
        )

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
        # Validate current statuses: only Draft/Updated are eligible
        status_map = await self.repo.get_equipment_status_map(
            equipment_ids, user.organization_id
        )
        eligible_ids = [
            eid for eid, status in status_map.items() if status in ("Draft", "Updated")
        ]
        ineligible_ids = [
            eid
            for eid, status in status_map.items()
            if status not in ("Draft", "Updated")
        ]

        # Update status to Submitted for eligible ones
        affected_count = 0
        if eligible_ids:
            affected_count = await self.repo.bulk_update_status(
                eligible_ids, "Submitted", user.organization_id
            )

        if affected_count == 0:
            return BulkActionResponseSchema(
                success=False,
                message="No equipment could be submitted",
                affected_count=0,
                errors=[
                    "No valid equipment found or already submitted",
                    *[
                        f"Equipment {eid} not in Draft/Updated"
                        for eid in ineligible_ids
                    ],
                ],
            )

        # Update associated charging sites to Submitted if they are in Draft/Updated
        await self._update_charging_sites_status(eligible_ids, user.organization_id)

        await add_notification_msg(
            action_type=ActionTypeEnum.UPDATE,
            action="Bulk submitted charging equipment",
            message=f"Submitted {affected_count} charging equipment",
            related_entity_type="ChargingEquipment",
            user=user,
        )

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
        # Validate current statuses: only Validated are eligible
        status_map = await self.repo.get_equipment_status_map(
            equipment_ids, user.organization_id
        )
        eligible_ids = [
            eid for eid, status in status_map.items() if status == "Validated"
        ]
        ineligible_ids = [
            eid for eid, status in status_map.items() if status != "Validated"
        ]

        # Update status to Decommissioned
        affected_count = 0
        if eligible_ids:
            affected_count = await self.repo.bulk_update_status(
                eligible_ids, "Decommissioned", user.organization_id
            )

        if affected_count == 0:
            return BulkActionResponseSchema(
                success=False,
                message="No equipment could be decommissioned",
                affected_count=0,
                errors=[
                    "No valid equipment found or already decommissioned",
                    *[f"Equipment {eid} not in Validated" for eid in ineligible_ids],
                ],
            )

        await add_notification_msg(
            action_type=ActionTypeEnum.UPDATE,
            action="Bulk decommissioned charging equipment",
            message=f"Decommissioned {affected_count} charging equipment",
            related_entity_type="ChargingEquipment",
            user=user,
        )

        return BulkActionResponseSchema(
            success=True,
            message=f"Successfully decommissioned {affected_count} equipment",
            affected_count=affected_count,
        )

    @service_handler
    async def has_allocation_agreements(self, user: UserProfile) -> bool:
        """Returns True if the supplier has any allocation agreements."""
        if user.is_government:
            # Only meaningful for suppliers; gov/analyst callers get False
            return False
        return await self.repo.has_allocation_agreements_for_organization(
            user.organization_id
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

        await add_notification_msg(
            action_type=ActionTypeEnum.DELETE,
            action="Deleted charging equipment",
            message=f"Deleted charging equipment {charging_equipment_id}",
            related_entity_type="ChargingEquipment",
            related_entity_id=charging_equipment_id,
            user=user,
        )

        return True

    @service_handler
    async def delete_all_for_organization(self, organization_id: int) -> int:
        """Delete all charging equipment for an organization (admin utility)."""
        return await self.repo.delete_all_equipment_for_organization(organization_id)

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
    async def get_end_user_types(self):
        """Get all end user types."""
        types = await self.repo.get_end_user_types()
        return [
            {
                "end_user_type_id": t.end_user_type_id,
                "type_name": t.type_name,
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

    @service_handler
    async def bulk_validate_equipment(
        self, user: UserProfile, equipment_ids: List[int]
    ) -> BulkActionResponseSchema:
        """Bulk validate charging equipment (Government users only)."""

        # Check authorization - user must be government
        if not user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only government users can validate equipment",
            )

        # Validate current statuses: only Submitted are eligible
        status_map = await self.repo.get_equipment_status_map(equipment_ids, None)
        eligible_ids = [
            eid for eid, status in status_map.items() if status == "Submitted"
        ]
        ineligible_ids = [
            eid for eid, status in status_map.items() if status != "Submitted"
        ]

        # Update status to Validated for eligible ones
        affected_count = 0
        if eligible_ids:
            affected_count = await self.repo.bulk_update_status(
                eligible_ids, "Validated", None
            )

        if affected_count == 0:
            return BulkActionResponseSchema(
                success=False,
                message="No equipment could be validated",
                affected_count=0,
                errors=[
                    "No valid equipment found or not in Submitted status",
                    *[f"Equipment {eid} not in Submitted status" for eid in ineligible_ids],
                ],
            )

        await add_notification_msg(
            action_type=ActionTypeEnum.UPDATE,
            action="Bulk validated charging equipment",
            message=f"Validated {affected_count} charging equipment",
            related_entity_type="ChargingEquipment",
            user=user,
        )

        return BulkActionResponseSchema(
            success=True,
            message=f"Successfully validated {affected_count} equipment",
            affected_count=affected_count,
        )

    @service_handler
    async def bulk_return_to_draft(
        self, user: UserProfile, equipment_ids: List[int]
    ) -> BulkActionResponseSchema:
        """Bulk return charging equipment to draft (Government users only)."""

        # Check authorization - user must be government
        if not user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only government users can return equipment to draft",
            )

        # Validate current statuses: Submitted and Validated are eligible
        status_map = await self.repo.get_equipment_status_map(equipment_ids, None)
        eligible_ids = [
            eid for eid, status in status_map.items() if status in ("Submitted", "Validated")
        ]
        ineligible_ids = [
            eid
            for eid, status in status_map.items()
            if status not in ("Submitted", "Validated")
        ]

        # Update status to Draft for eligible ones
        affected_count = 0
        if eligible_ids:
            affected_count = await self.repo.bulk_update_status(
                eligible_ids, "Draft", None
            )

        if affected_count == 0:
            return BulkActionResponseSchema(
                success=False,
                message="No equipment could be returned to draft",
                affected_count=0,
                errors=[
                    "No valid equipment found or not in Submitted/Validated status",
                    *[
                        f"Equipment {eid} not in Submitted/Validated"
                        for eid in ineligible_ids
                    ],
                ],
            )

        await add_notification_msg(
            action_type=ActionTypeEnum.UPDATE,
            action="Bulk returned charging equipment to draft",
            message=f"Returned {affected_count} charging equipment to draft",
            related_entity_type="ChargingEquipment",
            user=user,
        )

        return BulkActionResponseSchema(
            success=True,
            message=f"Successfully returned {affected_count} equipment to draft",
            affected_count=affected_count,
        )

    @service_handler
    async def get_site_equipment_processing(
        self, user: UserProfile, site_id: int
    ) -> dict:
        """Get charging site details and equipment for government processing view."""

        # Check authorization - user must be government
        if not user.is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only government users can access equipment processing",
            )

        # Get charging site details
        site = await self.repo.get_charging_site_by_id(site_id)
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Charging site not found",
            )

        # Get equipment for this site
        equipment_list, total_count = await self.repo.get_charging_equipment_by_site(
            site_id
        )

        # Transform equipment to schema format
        equipment_items = []
        for equipment in equipment_list:
            item = {
                "charging_equipment_id": equipment.charging_equipment_id,
                "status": equipment.status.status,
                "registration_number": equipment.registration_number
                or f"{equipment.charging_site.site_code}-{equipment.equipment_number}",
                "version": equipment.version,
                "serial_number": equipment.serial_number,
                "manufacturer": equipment.manufacturer,
                "model": equipment.model,
                "level_of_equipment_name": equipment.level_of_equipment.name,
                "created_date": equipment.create_date,
                "updated_date": equipment.update_date,
            }
            equipment_items.append(item)

        return {
            "site": {
                "charging_site_id": site.charging_site_id,
                "site_name": site.site_name,
                "site_code": site.site_code,
                "site_address": site.street_address,
                "city": site.city,
                "postal_code": site.postal_code,
                "status": site.status.status,
                "version": site.version,
                "organization": site.organization.name,
                "site_notes": site.site_notes,
                "intended_uses": [
                    {
                        "type": use.type,
                        "description": use.sub_type,
                    }
                    for use in site.intended_uses
                ],
            },
            "equipment": {
                "items": equipment_items,
                "total_count": total_count,
            },
        }

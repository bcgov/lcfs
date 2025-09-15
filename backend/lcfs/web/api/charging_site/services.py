from fastapi import Depends
from typing import List, Optional
import structlog
import math

from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.charging_site.schema import (
    ChargingSiteWithAttachmentsSchema,
    ChargingSiteStatusSchema,
    ChargingEquipmentForSiteSchema,
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
    EndUserTypeSchema,
)
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
)

logger = structlog.get_logger(__name__)


class ChargingSiteServices:
    def __init__(self, repo: ChargingSiteRepository = Depends(ChargingSiteRepository)):
        self.repo = repo

    @service_handler
    async def get_charging_site_with_attachments(
        self, site_id: int
    ) -> Optional[ChargingSiteWithAttachmentsSchema]:
        """
        Get a specific charging site with its attachments
        """
        site = await self.repo.get_charging_site_by_id(site_id)
        if not site:
            return None

        documents = await self.repo.get_documents_for_charging_site(site_id)

        return ChargingSiteWithAttachmentsSchema(
            charging_site_id=site.charging_site_id,
            site_code=site.site_code,
            site_name=site.site_name,
            street_address=site.street_address,
            city=site.city,
            postal_code=site.postal_code,
            notes=site.notes,
            status=site.status.status if site.status else "Unknown",
            organization_name=site.organization.name if site.organization else "",
            version=site.version,
            intended_users=[
                EndUserTypeSchema(
                    end_user_type_id=user.end_user_type_id,
                    type_name=user.type_name,
                    intended_use=user.intended_use,
                )
                for user in site.intended_users
            ],
            attachments=[FileResponseSchema.model_validate(doc) for doc in documents],
        )

    @service_handler
    async def get_charging_site_statuses(self) -> List[ChargingSiteStatusSchema]:
        """
        Get all available charging site statuses
        """
        statuses = await self.repo.get_charging_site_statuses()
        return [
            ChargingSiteStatusSchema(
                charging_site_status_id=status.charging_site_status_id,
                status=status.status,
                description=status.description,
            )
            for status in statuses
        ]

    @service_handler
    async def bulk_update_equipment_status(
        self,
        bulk_update: BulkEquipmentStatusUpdateSchema,
        charging_site_id: int,
        user: UserProfile,
    ) -> List[ChargingEquipmentForSiteSchema]:
        """
        Bulk update status for charging equipment records and handle charging site status changes
        """
        # Validate status transition rules
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload
        from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment

        if bulk_update.new_status == "Draft":
            # Equipment can only be returned to Draft from Submitted status
            query = (
                select(ChargingEquipment)
                .options(joinedload(ChargingEquipment.status))
                .where(
                    ChargingEquipment.charging_equipment_id.in_(
                        bulk_update.equipment_ids
                    )
                )
            )
            result = await self.repo.db.execute(query)
            equipment_to_update = result.unique().scalars().all()

            invalid_equipment = [
                eq for eq in equipment_to_update if eq.status.status != "Submitted"
            ]

            if invalid_equipment:
                invalid_serials = [eq.serial_number for eq in invalid_equipment]
                invalid_statuses = [
                    f"{eq.serial_number}({eq.status.status})"
                    for eq in invalid_equipment
                ]
                raise ValueError(
                    f"Equipment can only be returned to Draft from Submitted status. "
                    f"Invalid equipment: {', '.join(invalid_serials)} (current statuses: {', '.join(invalid_statuses)})"
                )

        elif bulk_update.new_status == "Validated":
            # Equipment can only be validated from Submitted status
            query = (
                select(ChargingEquipment)
                .options(joinedload(ChargingEquipment.status))
                .where(
                    ChargingEquipment.charging_equipment_id.in_(
                        bulk_update.equipment_ids
                    )
                )
            )
            result = await self.repo.db.execute(query)
            equipment_to_update = result.unique().scalars().all()

            invalid_equipment = [
                eq for eq in equipment_to_update if eq.status.status != "Submitted"
            ]

            if invalid_equipment:
                invalid_serials = [eq.serial_number for eq in invalid_equipment]
                invalid_statuses = [
                    f"{eq.serial_number}({eq.status.status})"
                    for eq in invalid_equipment
                ]
                raise ValueError(
                    f"Equipment can only be validated from Submitted status. "
                    f"Invalid equipment: {', '.join(invalid_serials)} (current statuses: {', '.join(invalid_statuses)})"
                )

        # Update equipment status
        updated_equipment = await self.repo.bulk_update_equipment_status(
            bulk_update.equipment_ids, bulk_update.new_status
        )

        if bulk_update.new_status == "Validated":
            # Get current site status
            site = await self.repo.get_charging_site_by_id(charging_site_id)
            if site:
                # Find "Validated" status ID (would need to be implemented properly)
                validated_status_id = 2  # Assuming this is the validated status ID
                await self.repo.update_charging_site_status(
                    charging_site_id, validated_status_id
                )

        # Convert updated equipment to schema format
        result = []
        for equipment in updated_equipment:
            equipment_schema = ChargingEquipmentForSiteSchema(
                charging_equipment_id=equipment.charging_equipment_id,
                equipment_number=equipment.equipment_number,
                registration_number=equipment.registration_number or "",
                version=equipment.version,
                allocating_organization=(
                    equipment.allocating_organization.name
                    if equipment.allocating_organization
                    else equipment.organization_name or ""
                ),
                serial_number=equipment.serial_number,
                manufacturer=equipment.manufacturer,
                model=equipment.model,
                level_of_equipment=(
                    equipment.level_of_equipment.name
                    if equipment.level_of_equipment
                    else ""
                ),
                ports=equipment.ports.value if equipment.ports else None,
                status=bulk_update.new_status,  # Use the new status
                notes=equipment.notes,
            )
            result.append(equipment_schema)

        return result

    @service_handler
    async def get_charging_site_equipment_paginated(
        self, site_id: int, pagination: PaginationRequestSchema
    ) -> ChargingEquipmentPaginatedSchema:
        """
        Get paginated charging equipment for a specific site
        """
        pagination = validate_pagination(pagination)

        equipment_records, total_count = (
            await self.repo.get_equipment_for_charging_site_paginated(
                site_id, pagination
            )
        )

        # Convert equipment records to schema
        equipment_list = []
        for equipment in equipment_records:
            equipment_schema = ChargingEquipmentForSiteSchema(
                charging_equipment_id=equipment.charging_equipment_id,
                equipment_number=equipment.equipment_number,
                registration_number=equipment.registration_number or "",
                version=equipment.version,
                allocating_organization=(
                    equipment.allocating_organization.name
                    if equipment.allocating_organization
                    else equipment.organization_name or ""
                ),
                serial_number=equipment.serial_number,
                manufacturer=equipment.manufacturer,
                model=equipment.model,
                level_of_equipment=(
                    equipment.level_of_equipment.name
                    if equipment.level_of_equipment
                    else ""
                ),
                ports=equipment.ports.value if equipment.ports else None,
                intended_use_types=(
                    [use_type.type for use_type in equipment.intended_uses]
                    if equipment.intended_uses
                    else []
                ),
                latitude=(
                    equipment.charging_site.latitude
                    if equipment.charging_site
                    else None
                ),
                longitude=(
                    equipment.charging_site.longitude
                    if equipment.charging_site
                    else None
                ),
                status=equipment.status.status if equipment.status else "Unknown",
                equipment_notes=equipment.notes,
            )
            equipment_list.append(equipment_schema)

        return ChargingEquipmentPaginatedSchema(
            equipment=equipment_list,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

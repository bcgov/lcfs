import math
from typing import List, Optional
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
    get_field_for_filter,
    apply_filter_conditions,
)
from lcfs.web.api.charging_site.schema import (
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSitesSchema,
    ChargingSiteWithAttachmentsSchema,
    ChargingSiteStatusSchema,
    ChargingEquipmentForSiteSchema,
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
    EndUserTypeSchema,
)
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.core.decorators import service_handler
import structlog
from fastapi import Depends, HTTPException
from lcfs.web.api.charging_site.repo import ChargingSiteRepo
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.db.models.user.UserProfile import UserProfile

logger = structlog.get_logger(__name__)


class ChargingSiteService:
    def __init__(self, repo: ChargingSiteRepo = Depends(ChargingSiteRepo)):
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
            organization_id=site.organization_id,
            status_id=site.status_id,
            status=(
                ChargingSiteStatusSchema(
                    charging_site_status_id=site.status.charging_site_status_id,
                    status=site.status.status,
                )
                if site.status
                else None
            ),
            site_code=site.site_code,
            site_name=site.site_name,
            street_address=site.street_address,
            city=site.city,
            postal_code=site.postal_code,
            latitude=site.latitude or 0.0,
            longitude=site.longitude or 0.0,
            notes=site.notes,
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

    @service_handler
    async def get_intended_user_types(self) -> List[EndUserTypeSchema]:
        """
        Service method to get intended user types
        """
        logger.info("Getting intended user types")
        try:
            intended_users = await self.repo.get_intended_user_types()
            return [EndUserTypeSchema.model_validate(u) for u in intended_users]
        except Exception as e:
            logger.error("Error fetching intended user types", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

    @service_handler
    async def get_charging_sites_paginated(
        self, pagination: PaginationRequestSchema, organization_id: int
    ):
        """
        Paginated list of charging sites for a specific organization.
        """
        conditions = []
        pagination = validate_pagination(pagination)

        # Apply filters
        for f in pagination.sort_orders:
            # normalize fields to snake_case handled by schema
            pass

        if pagination.filters:
            for f in pagination.filters:
                field = get_field_for_filter(ChargingSite, f.field)
                if field is not None:
                    condition = apply_filter_conditions(
                        field,
                        f.filter,
                        f.type,
                        f.filter_type,
                    )
                    if condition is not None:
                        conditions.append(condition)

        offset = (pagination.page - 1) * pagination.size
        limit = pagination.size
        rows, total = await self.repo.get_charging_sites_paginated(
            offset, limit, conditions, pagination.sort_orders, organization_id
        )
        return ChargingSitesSchema(
            charging_sites=[ChargingSiteSchema.model_validate(r) for r in rows],
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total,
                total_pages=(
                    math.ceil(total / pagination.size) if pagination.size else 1
                ),
            ),
        )

    @service_handler
    async def get_all_charging_sites_paginated(
        self, pagination: PaginationRequestSchema
    ) -> ChargingSitesSchema:
        """
        Paginated list of all charging sites.
        """
        conditions = []
        pagination = validate_pagination(pagination)

        if pagination.filters:
            for f in pagination.filters:
                field = get_field_for_filter(ChargingSite, f.field)
                if field is not None:
                    condition = apply_filter_conditions(
                        field,
                        f.filter,
                        f.type,
                        f.filter_type,
                    )
                    if condition is not None:
                        conditions.append(condition)

        offset = (pagination.page - 1) * pagination.size
        limit = pagination.size
        rows, total = await self.repo.get_all_charging_sites_paginated(
            offset, limit, conditions, pagination.sort_orders
        )
        return ChargingSitesSchema(
            charging_sites=[ChargingSiteSchema.model_validate(r) for r in rows],
            pagination=PaginationResponseSchema(
                page=pagination.page,
                size=pagination.size,
                total=total,
                total_pages=(
                    math.ceil(total / pagination.size) if pagination.size else 1
                ),
            ),
        )

    @service_handler
    async def get_cs_list(self, organization_id: int):
        """
        Service method to get list of charging sites
        """
        logger.info("Getting charging sites")
        try:
            charging_sites = await self.repo.get_all_charging_sites_by_organization_id(
                organization_id
            )
            return ChargingSitesSchema(
                charging_sites=[
                    ChargingSiteSchema.model_validate(cs) for cs in charging_sites
                ],
                pagination=PaginationResponseSchema(
                    page=1,
                    total_pages=1,
                    size=len(charging_sites),
                    total=len(charging_sites),
                ),
            )
        except Exception as e:
            logger.error("Error fetching charging sites", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

    @service_handler
    async def create_charging_site(
        self, charging_site_data: ChargingSiteCreateSchema, organization_id: int
    ):
        """
        Service method to create a new charging site
        """
        logger.info("Creating charging site")
        status = await self.repo.get_charging_site_status_by_name(
            charging_site_data.status
        )
        try:
            intended_users = []
            if (
                charging_site_data.intended_users
                and len(charging_site_data.intended_users) > 0
            ):
                intended_user_ids = [
                    i.end_user_type_id for i in charging_site_data.intended_users
                ]
                intended_users = await self.repo.get_end_user_types_by_ids(
                    intended_user_ids
                )
            charging_site = await self.repo.create_charging_site(
                ChargingSite(
                    **charging_site_data.model_dump(
                        exclude=["status_id", "status", "deleted", "intended_users"]
                    ),
                    status=status,
                    intended_users=intended_users,
                )
            )
            return ChargingSiteSchema.model_validate(charging_site)
        except Exception as e:
            logger.error("Error creating charging site", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

    @service_handler
    async def update_charging_site(self, charging_site_data: ChargingSiteSchema):
        """
        Service method to update an existing charging site
        """
        logger.info("Updating charging site")
        existing_charging_site = await self.repo.get_charging_site_by_id(
            charging_site_data.charging_site_id
        )
        if not existing_charging_site:
            raise HTTPException(status_code=404, detail="Charging site not found")
        status = await self.repo.get_charging_site_status_by_name(
            charging_site_data.status
        )

        try:
            # Update basic fields on the existing object
            update_data = charging_site_data.model_dump(
                exclude=[
                    "charging_site_id",
                    "status_id",
                    "status",
                    "deleted",
                    "intended_users",
                ],
                exclude_unset=True,
            )

            # Update each field on the existing object
            for field, value in update_data.items():
                if hasattr(existing_charging_site, field):
                    setattr(existing_charging_site, field, value)

            # Update status if provided
            if status:
                existing_charging_site.status = status
                existing_charging_site.status_id = status.charging_site_status_id

            # Handle intended_users if provided
            if charging_site_data.intended_users is not None:
                if len(charging_site_data.intended_users) > 0:
                    intended_user_ids = [
                        i.end_user_type_id for i in charging_site_data.intended_users
                    ]
                    intended_users = await self.repo.get_end_user_types_by_ids(
                        intended_user_ids
                    )
                    setattr(existing_charging_site, "intended_users", intended_users)
                else:
                    # Clear intended users if empty list is provided
                    existing_charging_site.intended_users = []

            # Save the updated object
            updated_charging_site = await self.repo.update_charging_site(
                existing_charging_site
            )

            return ChargingSiteSchema.model_validate(updated_charging_site)

        except Exception as e:
            logger.error("Error updating charging site", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

    @service_handler
    async def delete_charging_site(self, charging_site_id: int):
        """
        Service method to delete a charging site
        """
        logger.info("Deleting charging site")
        try:
            await self.repo.delete_charging_site(charging_site_id)
        except Exception as e:
            logger.error("Error deleting charging site", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

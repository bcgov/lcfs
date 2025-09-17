import math
from typing import List, Optional
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
)
from lcfs.web.api.charging_site.schema import (
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentForSiteSchema,
    ChargingEquipmentPaginatedSchema,
    ChargingEquipmentStatusSchema,
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSiteStatusSchema,
    ChargingSiteWithAttachmentsSchema,
    ChargingSitesSchema,
)
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.core.decorators import service_handler
import structlog
from fastapi import Depends, HTTPException, Request

from lcfs.web.api.charging_site.repo import ChargingSiteRepository


logger = structlog.get_logger(__name__)


class ChargingSiteService:
    def __init__(
        self,
        repo: ChargingSiteRepository = Depends(),
        request: Request = None,
    ):
        self.repo = repo
        self.request = request

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
        # TODO: Implement pagination, filter and sorting logics
        logger.info("Getting charging sites")
        return ChargingSitesSchema(
            charging_sites=[],
            pagination=PaginationResponseSchema(
                page=1,
                total_pages=1,
                size=len([]),
                total=len([]),
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
    async def get_charging_site_by_id(self, charging_site_id: int):
        """
        Service method to get a charging site by ID
        """
        logger.info("Getting charging site by ID")
        charging_site = await self.repo.get_charging_site_by_id(charging_site_id)
        if not charging_site:
            raise HTTPException(status_code=404, detail="Charging site not found")
        if (
            charging_site.organization_id
            != self.request.user.organization.organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
        return ChargingSiteSchema.model_validate(charging_site)

    @service_handler
    async def create_charging_site(
        self, charging_site_data: ChargingSiteCreateSchema, organization_id: int
    ):
        """
        Service method to create a new charging site
        """
        logger.info("Creating charging site")
        status = await self.repo.get_charging_site_status_by_name(
            charging_site_data.status or ""
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
                        exclude={"status_id", "status", "deleted", "intended_users"}
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
    async def update_charging_site(self, charging_site_data: ChargingSiteCreateSchema):
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
            charging_site_data.status.status if charging_site_data.status else ""
        )

        try:
            # Update basic fields on the existing object
            update_data = charging_site_data.model_dump(
                exclude={
                    "charging_site_id",
                    "status_id",
                    "status",
                    "deleted",
                    "intended_users",
                },
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

        return ChargingSiteSchema.model_validate(site)

    @service_handler
    async def get_charging_equipment_statuses(
        self,
    ) -> List[ChargingEquipmentStatusSchema]:
        """
        Get all available charging equipment statuses
        """
        statuses = await self.repo.get_charging_equipment_statuses()
        return [
            ChargingEquipmentStatusSchema(
                charging_equipment_status_id=status.charging_equipment_status_id,
                status=status.status,
                description=status.description,
            )
            for status in statuses
        ]

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
        # Get all equipment statuses
        statuses = await self.repo.get_charging_equipment_statuses()
        status_ids = self._get_equipment_status_ids(statuses)
        # Define valid status transitions: new_status -> (from_status, error_message)
        valid_transitions = {
            "Draft": ["Submitted"],  # Return to Draft (from Submitted)
            "Submitted": [
                "Draft",
                "Validated",
            ],  # Submit (from Draft) or Undo Validation (from Validated)
            "Validated": ["Submitted"],  # Validate (from Submitted)
            "Decommissioned": ["Validated"],  # Decommission (from Validated)
        }
        # Validate the new status
        if bulk_update.new_status not in valid_transitions:
            raise ValueError(f"Invalid status: {bulk_update.new_status}")

        allowed_source_statuses = valid_transitions[bulk_update.new_status]
        source_status_ids = [status_ids[status] for status in allowed_source_statuses]

        # Perform the bulk update
        updated_ids = await self.repo.bulk_update_equipment_status(
            bulk_update.equipment_ids,
            status_ids[bulk_update.new_status],  # new status id
            source_status_ids,  # from status id
        )
        # Validate that all equipment was updated
        if set(updated_ids) != set(bulk_update.equipment_ids):
            # Create a more helpful error message
            allowed_statuses_str = " or ".join(allowed_source_statuses)
            raise ValueError(
                f"Equipment can only be changed to {bulk_update.new_status} "
                f"from {allowed_statuses_str} status. Some equipment may not "
                f"be in the required status."
            )

        # Update charging site status if equipment status is Submitted or Validated
        if bulk_update.new_status in ["Submitted", "Validated"]:
            # Get charging site statuses and find the corresponding status ID
            site_statuses = await self.repo.get_charging_site_statuses()
            site_status_ids = self._get_site_status_ids(site_statuses)

            await self.repo.update_charging_site_status(
                charging_site_id, site_status_ids[bulk_update.new_status]
            )
        return True

    def _get_equipment_status_ids(
        self, statuses: List[ChargingEquipmentStatus]
    ) -> dict:
        """
        Get equipment status IDs mapped by status name
        """
        return {
            status.status: status.charging_equipment_status_id for status in statuses
        }

    def _get_site_status_ids(self, statuses: List[ChargingSiteStatus]) -> dict:
        """
        Get site status IDs mapped by status name
        """
        return {status.status: status.charging_site_status_id for status in statuses}

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
        equipment_list = [
            ChargingEquipmentForSiteSchema.model_validate(equipment)
            for equipment in equipment_records
        ]

        return ChargingEquipmentPaginatedSchema(
            equipment=equipment_list,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

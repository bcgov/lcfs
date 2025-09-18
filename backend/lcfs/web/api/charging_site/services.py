from typing import List
import math
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
)
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.core.decorators import service_handler
import structlog
from fastapi import Depends, HTTPException

from lcfs.web.api.charging_site.repo import ChargingSiteRepo


logger = structlog.get_logger(__name__)


class ChargingSiteService:
    def __init__(self, repo: ChargingSiteRepo = Depends()):
        self.repo = repo

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
                total_pages=math.ceil(total / pagination.size) if pagination.size else 1,
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
                total_pages=math.ceil(total / pagination.size) if pagination.size else 1,
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

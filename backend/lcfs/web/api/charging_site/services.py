import math
from typing import List, Optional
import structlog
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select

from lcfs.db.models.compliance import (
    ChargingEquipmentStatus,
    ChargingSite,
    ChargingSiteStatus,
)
from lcfs.db.models.organization import Organization
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
    get_field_for_filter,
    apply_filter_conditions,
)
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.charging_site.schema import (
    ChargingEquipmentStatusSchema,
    ChargingSiteCreateSchema,
    ChargingSiteSchema,
    ChargingSiteStatusEnum,
    ChargingSitesSchema,
    ChargingSiteStatusSchema,
    ChargingEquipmentForSiteSchema,
    BulkEquipmentStatusUpdateSchema,
    ChargingEquipmentPaginatedSchema,
)
from lcfs.db.models.user import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import service_handler


logger = structlog.get_logger(__name__)


def _get_organization_name_expression():
    """
    Build a correlated subquery expression that resolves the organization name for a charging site.
    """
    return (
        select(Organization.name)
        .where(Organization.organization_id == ChargingSite.organization_id)
        .correlate(ChargingSite)
        .scalar_subquery()
    )


def _get_allocating_organization_display_name_expression():
    """
    Build an expression that resolves the allocating organization display name for a charging site.
    Prefers the linked organization name when available, otherwise falls back to the free-text name.
    """
    allocating_org_name_subquery = (
        select(Organization.name)
        .where(Organization.organization_id == ChargingSite.allocating_organization_id)
        .correlate(ChargingSite)
        .scalar_subquery()
    )
    return func.coalesce(
        allocating_org_name_subquery, ChargingSite.allocating_organization_name
    )


def _build_charging_site_filter_condition(filter_model) -> Optional:
    """
    Convert a filter model into a SQLAlchemy filter condition for charging site queries.
    Handles relationship-backed fields like organization and allocating organization.
    """
    if filter_model.field == "status":
        field = get_field_for_filter(ChargingSiteStatus, "status")
    elif filter_model.field == "organization":
        field = _get_organization_name_expression()
    elif filter_model.field == "allocating_organization":
        field = _get_allocating_organization_display_name_expression()
    else:
        field = get_field_for_filter(ChargingSite, filter_model.field)

    return apply_filter_conditions(
        field,
        filter_model.filter,
        filter_model.type,
        filter_model.filter_type,
    )


class ChargingSiteService:
    def __init__(
        self,
        repo: ChargingSiteRepository = Depends(ChargingSiteRepository),
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
    async def search_allocation_organizations(
        self, organization_id: int, query: str
    ) -> List[dict]:
        """
        Search for allocating organization suggestions.
        """
        try:
            query_lower = query.lower().strip()

            # Use existing method to get matched organizations
            matched_orgs = await self.repo.get_allocation_agreement_organizations(
                organization_id
            )

            # Get unmatched names from allocation agreements and charging sites
            transaction_partners = (
                await self.repo.get_transaction_partners_from_allocation_agreements(
                    organization_id
                )
            )
            historical_names = (
                await self.repo.get_distinct_allocating_organization_names(
                    organization_id
                )
            )

            # Build suggestions dict - matched orgs take precedence
            suggestions = {}
            for org in matched_orgs:
                if query_lower in org.name.lower():
                    suggestions[org.name.lower()] = {
                        "organizationId": org.organization_id,
                        "name": org.name,
                    }

            # Add unmatched names (transaction partners + historical)
            for name in transaction_partners + historical_names:
                name_lower = name.lower()
                if name_lower not in suggestions and query_lower in name_lower:
                    suggestions[name_lower] = {"organizationId": None, "name": name}

            return sorted(suggestions.values(), key=lambda x: x["name"].lower())[:50]
        except Exception as e:
            logger.error("Error searching allocation organizations", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

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
    async def get_charging_site_by_id(self, site_id: int):
        """
        Service method to get a charging site by ID
        """
        logger.info("Getting charging site by ID")
        charging_site = await self.repo.get_charging_site_by_id(site_id)

        if not charging_site:
            raise HTTPException(
                status_code=404,
                detail=f"Charging site with ID {site_id} not found",
            )
        organization_id = charging_site.organization_id
        user_organization_id = (
            self.request.user.organization.organization_id
            if self.request.user.organization
            else None
        )
        if (
            not user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
            and organization_id != user_organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this site.",
            )
        if (
            user_has_roles(self.request.user, [RoleEnum.GOVERNMENT])
            and charging_site.status.status == ChargingSiteStatusEnum.DRAFT
        ):
            raise HTTPException(
                status_code=404,
                detail=f"Charging site with ID {site_id} not found",
            )

        return ChargingSiteSchema.model_validate(charging_site)

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
                site_id, pagination, self.request.user.is_government
            )
        )

        # Convert equipment records to schema
        equipment_list = [
            ChargingEquipmentForSiteSchema.model_validate(equipment)
            for equipment in equipment_records
        ]

        return ChargingEquipmentPaginatedSchema(
            equipments=equipment_list,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

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

        # Update charging site status based on equipment status changes
        # Get charging site statuses and find the corresponding status ID
        site_statuses = await self.repo.get_charging_site_statuses()
        site_status_ids = self._get_site_status_ids(site_statuses)

        if bulk_update.new_status in ["Submitted", "Validated"]:
            current_site = await self.repo.get_charging_site_by_id(charging_site_id)

            if not (
                current_site
                and current_site.status
                and current_site.status.status == bulk_update.new_status
            ):
                # When equipment is Submitted or Validated, update site status to match
                await self.repo.update_charging_site_status(
                    charging_site_id, site_status_ids[bulk_update.new_status]
                )
        elif bulk_update.new_status == "Draft":
            # When returning equipment to Draft, recalculate site status
            # based on the highest status of all remaining equipment
            new_site_status = await self.repo.calculate_site_status_from_equipment(
                charging_site_id
            )
            if new_site_status:
                await self.repo.update_charging_site_status(
                    charging_site_id, site_status_ids[new_site_status]
                )
        return True

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
        if pagination.filters:
            for f in pagination.filters:
                condition = _build_charging_site_filter_condition(f)
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
        self, pagination: PaginationRequestSchema, exclude_draft: bool = False
    ) -> ChargingSitesSchema:
        """
        Paginated list of all charging sites.
        If exclude_draft is True, excludes charging sites with DRAFT status.
        """
        conditions = []
        pagination = validate_pagination(pagination)

        if pagination.filters:
            for f in pagination.filters:
                condition = _build_charging_site_filter_condition(f)
                if condition is not None:
                    conditions.append(condition)

        offset = (pagination.page - 1) * pagination.size
        limit = pagination.size
        rows, total = await self.repo.get_all_charging_sites_paginated(
            offset, limit, conditions, pagination.sort_orders, exclude_draft
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

        site_name = (charging_site_data.site_name or "").strip()
        if not site_name:
            raise HTTPException(
                status_code=400, detail="Charging site name cannot be blank."
            )

        name_exists = await self.repo.charging_site_name_exists(
            site_name, organization_id
        )
        if name_exists:
            raise HTTPException(
                status_code=400,
                detail="A charging site with this name already exists for the organization.",
            )

        status = await self.repo.get_charging_site_status_by_name(
            ChargingSiteStatusEnum.DRAFT
        )
        try:
            payload = charging_site_data.model_dump(
                exclude={
                    "site_code",
                    "status_id",
                    "current_status",
                    "deleted",
                    "intended_users",
                }
            )
            payload["site_name"] = site_name
            payload["organization_id"] = organization_id

            charging_site = await self.repo.create_charging_site(
                ChargingSite(
                    **payload,
                    status=status,
                )
            )
            charging_site = await self.repo.get_charging_site_by_id(
                charging_site.charging_site_id
            )
            return ChargingSiteSchema.model_validate(charging_site)
        except IntegrityError as exc:
            logger.warning(
                "Charging site name already exists for organization",
                error=str(exc),
            )
            raise HTTPException(
                status_code=400,
                detail="A charging site with this name already exists for the organization.",
            )
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

        existing_status_name = (
            existing_charging_site.status.status
            if existing_charging_site.status
            else None
        )
        allowed_statuses = {
            ChargingSiteStatusEnum.DRAFT,
            ChargingSiteStatusEnum.UPDATED,
            ChargingSiteStatusEnum.VALIDATED,
        }
        if existing_status_name not in allowed_statuses:
            raise HTTPException(
                status_code=400, detail="Charging site is not in draft state"
            )

        if existing_status_name == ChargingSiteStatusEnum.VALIDATED:
            existing_charging_site.version = (
                (existing_charging_site.version or 0) + 1
            )
            target_status_name = ChargingSiteStatusEnum.UPDATED
        else:
            target_status_name = (
                charging_site_data.current_status
                if charging_site_data.current_status
                else existing_status_name
            ) or ChargingSiteStatusEnum.DRAFT

        new_site_name = (
            charging_site_data.site_name or existing_charging_site.site_name
        ).strip()
        if not new_site_name:
            raise HTTPException(
                status_code=400, detail="Charging site name cannot be blank."
            )

        if new_site_name.lower() != existing_charging_site.site_name.lower():
            name_exists = await self.repo.charging_site_name_exists(
                new_site_name,
                existing_charging_site.organization_id,
                exclude_site_id=existing_charging_site.charging_site_id,
            )
            if name_exists:
                raise HTTPException(
                    status_code=400,
                    detail="A charging site with this name already exists for the organization.",
                )

        status = await self.repo.get_charging_site_status_by_name(target_status_name)

        try:
            # Update basic fields on the existing object
            update_data = charging_site_data.model_dump(
                exclude={
                    "charging_site_id",
                    "status_id",
                    "status",
                    "deleted",
                },
                exclude_unset=True,
            )
            update_data["site_name"] = new_site_name

            # Update each field on the existing object
            for field, value in update_data.items():
                if hasattr(existing_charging_site, field):
                    setattr(existing_charging_site, field, value)

            # Update status if provided
            if status:
                existing_charging_site.status = status
                existing_charging_site.status_id = status.charging_site_status_id

            # Save the updated object
            updated_charging_site = await self.repo.update_charging_site(
                existing_charging_site
            )

            return ChargingSiteSchema.model_validate(updated_charging_site)

        except IntegrityError as exc:
            logger.warning(
                "Charging site name already exists for organization during update",
                error=str(exc),
            )
            raise HTTPException(
                status_code=400,
                detail="A charging site with this name already exists for the organization.",
            )
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
    async def delete_all_charging_sites(self, organization_id: int):
        """
        Service method to delete all charging sites for an organization
        """
        logger.info("Deleting all charging sites for organization")
        try:
            await self.repo.delete_all_charging_sites_by_organization(organization_id)
        except Exception as e:
            logger.error("Error deleting all charging sites", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

    @service_handler
    async def delete_charging_sites_by_ids(self, site_ids: List[int]):
        """
        Service method to delete charging sites by their IDs
        """
        logger.info(f"Deleting charging sites by IDs: {site_ids}")
        try:
            for site_id in site_ids:
                await self.repo.delete_charging_site(site_id)
        except Exception as e:
            logger.error("Error deleting charging sites by IDs", error=str(e))
            raise HTTPException(status_code=500, detail="Internal Server Error")

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
    async def get_site_names_by_organization(self, organization_id: int) -> List[dict]:
        """
        Get site names and charging site IDs for the given organization
        """
        sites = await self.repo.get_site_names_by_organization(organization_id)
        return [
            {"siteName": site.site_name, "chargingSiteId": site.charging_site_id}
            for site in sites
        ]

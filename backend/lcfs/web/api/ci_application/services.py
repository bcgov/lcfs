"""
Service layer for the Carbon Intensity (CI) application module.

Currently exposes everything required to drive Step 1 of the wizard
("Application information") plus the listing screen. The remaining
steps will plug into ``update_step1`` -> ``update_step2`` etc. as they
are introduced.
"""

import uuid
from typing import Optional

import structlog
from fastapi import Depends

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import UserProfile
from lcfs.db.models.ci_application import CIApplication
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.ci_application.repo import CIApplicationRepository
from lcfs.web.api.ci_application.schema import (
    CIApplicationBaseSchema,
    CIApplicationSchema,
    CIApplicationStatusEnum,
    CIApplicationStatusSchema,
    CIApplicationsListSchema,
    CIApplicationStep1Schema,
    CITableOptionsSchema,
    OrganizationInfoSchema,
    UnitOfMeasureSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = structlog.get_logger(__name__)


def _to_org_info(organization) -> Optional[OrganizationInfoSchema]:
    if organization is None:
        return None
    return OrganizationInfoSchema(
        organization_id=organization.organization_id,
        name=organization.name,
        operating_name=organization.operating_name,
        email=organization.email,
        phone=organization.phone,
    )


def _to_full_schema(ci: CIApplication) -> CIApplicationSchema:
    return CIApplicationSchema(
        ci_application_id=ci.ci_application_id,
        organization_id=ci.organization_id,
        organization=_to_org_info(ci.organization),
        status=CIApplicationStatusSchema.model_validate(ci.ci_application_status),
        facility_city=ci.facility_city,
        facility_province_state=ci.facility_province_state,
        facility_country=ci.facility_country,
        facility_iso=ci.facility_iso,
        facility_nameplate_capacity=ci.facility_nameplate_capacity,
        facility_nameplate_capacity_unit_id=ci.facility_nameplate_capacity_unit_id,
        facility_nameplate_capacity_unit=(
            UnitOfMeasureSchema.model_validate(ci.facility_nameplate_capacity_unit)
            if ci.facility_nameplate_capacity_unit
            else None
        ),
        proposed_fuel_code_effective_date=ci.proposed_fuel_code_effective_date,
        pathway_description=ci.pathway_description,
        supporting_document_other=ci.supporting_document_other,
        consultant_name=ci.consultant_name,
        consultant_company=ci.consultant_company,
        consultant_email=ci.consultant_email,
        signature_user=ci.signature_user,
    )


def _to_list_item(ci: CIApplication) -> CIApplicationBaseSchema:
    return CIApplicationBaseSchema(
        ci_application_id=ci.ci_application_id,
        organization_id=ci.organization_id,
        status=CIApplicationStatusSchema.model_validate(ci.ci_application_status),
        facility_city=ci.facility_city,
        facility_province_state=ci.facility_province_state,
        facility_country=ci.facility_country,
        facility_nameplate_capacity=ci.facility_nameplate_capacity,
        facility_nameplate_capacity_unit_id=ci.facility_nameplate_capacity_unit_id,
        proposed_fuel_code_effective_date=ci.proposed_fuel_code_effective_date,
        update_date=ci.update_date.isoformat() if ci.update_date else None,
        create_date=ci.create_date.isoformat() if ci.create_date else None,
    )


class CIApplicationServices:
    def __init__(
        self,
        repo: CIApplicationRepository = Depends(CIApplicationRepository),
    ) -> None:
        self.repo = repo

    # ------------------------------------------------------------------
    # Reference data
    # ------------------------------------------------------------------

    @service_handler
    async def get_table_options(self) -> CITableOptionsSchema:
        statuses = await self.repo.get_statuses()
        units = await self.repo.get_units_of_measure()
        return CITableOptionsSchema(
            statuses=[CIApplicationStatusSchema.model_validate(s) for s in statuses],
            units_of_measure=[UnitOfMeasureSchema.model_validate(u) for u in units],
        )

    # ------------------------------------------------------------------
    # Listing & retrieval
    # ------------------------------------------------------------------

    @service_handler
    async def list_ci_applications(
        self,
        pagination: PaginationRequestSchema,
        organization_id: Optional[int],
    ) -> CIApplicationsListSchema:
        items, total = await self.repo.list_paginated(pagination, organization_id)
        return CIApplicationsListSchema(
            ci_applications=[_to_list_item(ci) for ci in items],
            pagination=PaginationResponseSchema(
                total=total,
                page=pagination.page,
                size=pagination.size,
                total_pages=self.repo.total_pages(total, pagination.size),
            ),
        )

    @service_handler
    async def get_ci_application(self, ci_application_id: int) -> CIApplicationSchema:
        ci = await self.repo.get_by_id(ci_application_id)
        if not ci:
            raise DataNotFoundException("CI application not found.")
        return _to_full_schema(ci)

    # ------------------------------------------------------------------
    # Step 1 — create / update / delete draft
    # ------------------------------------------------------------------

    @service_handler
    async def create_draft(
        self,
        organization_id: int,
        data: CIApplicationStep1Schema,
        user: UserProfile,
    ) -> CIApplicationSchema:
        draft_status = await self.repo.get_status_by_name(
            CIApplicationStatusEnum.Draft.value
        )
        if not draft_status:
            raise DataNotFoundException("Draft status is not configured.")

        ci = CIApplication(
            status_id=draft_status.ci_application_status_id,
            organization_id=organization_id,
            facility_city=data.facility_city,
            facility_province_state=data.facility_province_state,
            facility_country=data.facility_country,
            facility_iso=data.facility_iso,
            facility_nameplate_capacity=data.facility_nameplate_capacity,
            facility_nameplate_capacity_unit_id=data.facility_nameplate_capacity_unit_id,
            proposed_fuel_code_effective_date=data.proposed_fuel_code_effective_date,
            group_uuid=str(uuid.uuid4()),
            version=0,
            action_type=ActionTypeEnum.CREATE,
            create_user=user.keycloak_username,
            update_user=user.keycloak_username,
        )
        ci = await self.repo.create(ci)
        await self.repo.add_history(ci)
        # Reload with all relationships needed for the response.
        ci = await self.repo.get_by_id(ci.ci_application_id)
        return _to_full_schema(ci)

    @service_handler
    async def update_step1(
        self,
        ci_application: CIApplication,
        data: CIApplicationStep1Schema,
        user: UserProfile,
    ) -> CIApplicationSchema:
        ci_application.facility_city = data.facility_city
        ci_application.facility_province_state = data.facility_province_state
        ci_application.facility_country = data.facility_country
        ci_application.facility_iso = data.facility_iso
        ci_application.facility_nameplate_capacity = data.facility_nameplate_capacity
        ci_application.facility_nameplate_capacity_unit_id = (
            data.facility_nameplate_capacity_unit_id
        )
        ci_application.proposed_fuel_code_effective_date = (
            data.proposed_fuel_code_effective_date
        )
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE

        ci_application = await self.repo.update(ci_application)
        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return _to_full_schema(ci)

    @service_handler
    async def delete_draft(self, ci_application: CIApplication) -> None:
        await self.repo.delete(ci_application)

"""
Service layer for the Carbon Intensity (CI) application module.

Currently exposes everything required to drive Step 1 of the wizard
("Application information") plus the listing screen. The remaining
steps will plug into ``update_step1`` -> ``update_step2`` etc. as they
are introduced.
"""

import uuid
from typing import List, Optional

import structlog
from fastapi import Depends, HTTPException, status

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import UserProfile
from lcfs.db.models.ci_application import CIApplication, Pathway
from lcfs.db.models.ci_application.CIApplication import (
    CI_DOC_CATEGORY_GHGENIUS_MODEL,
    CI_DOC_CATEGORY_TECHNICAL_REPORT,
)
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.ci_application.repo import CIApplicationRepository
from lcfs.web.api.ci_application.schema import (
    CIApplicationBaseSchema,
    CIApplicationDocumentSchema,
    CIApplicationSchema,
    CIApplicationStatusEnum,
    CIApplicationStatusSchema,
    CIApplicationsListSchema,
    CIApplicationStep1Schema,
    CIApplicationStep2Schema,
    CIApplicationStep3Schema,
    CITableOptionsSchema,
    FuelCodeOptionSchema,
    FuelTypeOptionSchema,
    OrganizationInfoSchema,
    PathwayApplicationTypeSchema,
    PathwayFuelCodeTypeSchema,
    PathwayInputSchema,
    PathwaySchema,
    UnitOfMeasureSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

# pathway_application_type.type values seeded by the migration
PATHWAY_APPLICATION_TYPE_NEW = "New"
PATHWAY_APPLICATION_TYPE_RENEWAL = "Renewal"

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


def _to_fuel_code_option(fc: FuelCode) -> FuelCodeOptionSchema:
    """Compose the display string and lift the renewal-relevant fields."""
    prefix = fc.fuel_code_prefix.prefix if fc.fuel_code_prefix else ""
    return FuelCodeOptionSchema(
        fuel_code_id=fc.fuel_code_id,
        fuel_code=f"{prefix}{fc.fuel_suffix}" if prefix else fc.fuel_suffix,
        carbon_intensity=fc.carbon_intensity,
        fuel_type_id=fc.fuel_type_id,
        fuel_type=fc.fuel_type.fuel_type if fc.fuel_type else None,
        feedstock=fc.feedstock,
        feedstock_location=fc.feedstock_location,
    )


def _to_pathway_schema(pathway: Pathway) -> PathwaySchema:
    return PathwaySchema(
        pathway_id=pathway.pathway_id,
        ci_application_id=pathway.ci_application_id,
        application_type_id=pathway.application_type_id,
        application_type=(
            PathwayApplicationTypeSchema.model_validate(pathway.application_type)
            if pathway.application_type
            else None
        ),
        fuel_code_type_id=pathway.fuel_code_type_id,
        fuel_code_type=(
            PathwayFuelCodeTypeSchema.model_validate(pathway.fuel_code_type)
            if pathway.fuel_code_type
            else None
        ),
        operating_data_from=pathway.operating_data_from,
        operating_data_to=pathway.operating_data_to,
        fuel_code_id=pathway.fuel_code_id,
        fuel_code=_to_fuel_code_option(pathway.fuel_code) if pathway.fuel_code else None,
        proposed_ci=pathway.proposed_ci,
        fuel_type_id=pathway.fuel_type_id,
        fuel_type=(
            FuelTypeOptionSchema.model_validate(pathway.fuel_type)
            if pathway.fuel_type
            else None
        ),
        feedstock=pathway.feedstock,
        feedstock_region=pathway.feedstock_region,
        feedstock_transport_mode=pathway.feedstock_transport_mode,
        feedstock_transport_distance=pathway.feedstock_transport_distance,
        coproducts=pathway.coproducts,
        finished_fuel_transport_mode=pathway.finished_fuel_transport_mode,
        finished_fuel_transport_distance=pathway.finished_fuel_transport_distance,
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
        pathways=[_to_pathway_schema(p) for p in (getattr(ci, "pathways", None) or [])],
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
        application_types = await self.repo.get_pathway_application_types()
        fuel_code_types = await self.repo.get_pathway_fuel_code_types()
        fuel_types = await self.repo.get_fuel_types()
        transport_modes = await self.repo.get_transport_modes()
        fuel_codes = await self.repo.get_approved_fuel_codes()
        return CITableOptionsSchema(
            statuses=[CIApplicationStatusSchema.model_validate(s) for s in statuses],
            units_of_measure=[UnitOfMeasureSchema.model_validate(u) for u in units],
            pathway_application_types=[
                PathwayApplicationTypeSchema.model_validate(t)
                for t in application_types
            ],
            pathway_fuel_code_types=[
                PathwayFuelCodeTypeSchema.model_validate(t) for t in fuel_code_types
            ],
            fuel_types=[
                FuelTypeOptionSchema(
                    fuel_type_id=ft.fuel_type_id, fuel_type=ft.fuel_type
                )
                for ft in fuel_types
            ],
            transport_modes=[tm.transport_mode for tm in transport_modes],
            fuel_codes=[_to_fuel_code_option(fc) for fc in fuel_codes],
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

    # ------------------------------------------------------------------
    # Step 2 — Proposed fuel pathways
    # ------------------------------------------------------------------

    async def _validate_step2_payload(
        self,
        data: CIApplicationStep2Schema,
    ) -> dict:
        """
        Cross-row validation of Step 2:
          - referenced application_type / fuel_code_type ids must exist;
          - Renewal rows require an existing approved fuel_code_id;
          - New rows must NOT carry a fuel_code_id (the column is
            disabled in the UI; reject defensively in case someone bypasses);
          - Every fuel_type_id and fuel_code_id referenced must exist.

        Returns a dict of lookups keyed by id so the caller can avoid
        re-querying when materialising ORM rows.
        """
        application_types = {
            t.pathway_application_type_id: t
            for t in await self.repo.get_pathway_application_types()
        }
        fuel_code_types = {
            t.pathway_fuel_code_type_id: t
            for t in await self.repo.get_pathway_fuel_code_types()
        }
        fuel_types = {ft.fuel_type_id for ft in await self.repo.get_fuel_types()}

        referenced_fuel_code_ids = [
            row.fuel_code_id for row in data.pathways if row.fuel_code_id is not None
        ]
        fuel_codes = {
            fc.fuel_code_id: fc
            for fc in await self.repo.get_fuel_codes_by_ids(referenced_fuel_code_ids)
        }

        for index, row in enumerate(data.pathways, start=1):
            if row.application_type_id not in application_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Row {index}: invalid application type.",
                )
            if row.fuel_code_type_id not in fuel_code_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Row {index}: invalid fuel code type.",
                )
            if row.fuel_type_id not in fuel_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Row {index}: invalid fuel type.",
                )

            type_name = application_types[row.application_type_id].type
            if type_name == PATHWAY_APPLICATION_TYPE_RENEWAL:
                if row.fuel_code_id is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Row {index}: Renewal pathways require a "
                            "fuel code iteration."
                        ),
                    )
                if row.fuel_code_id not in fuel_codes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Row {index}: invalid fuel code iteration.",
                    )
            else:
                # New (or any other non-Renewal) row must not reference a fuel code.
                if row.fuel_code_id is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Row {index}: New pathways must not reference "
                            "an existing fuel code."
                        ),
                    )

        return {
            "application_types": application_types,
            "fuel_code_types": fuel_code_types,
            "fuel_codes": fuel_codes,
        }

    @service_handler
    async def update_step2(
        self,
        ci_application: CIApplication,
        data: CIApplicationStep2Schema,
        user: UserProfile,
    ) -> CIApplicationSchema:
        await self._validate_step2_payload(data)

        new_rows: List[Pathway] = [
            Pathway(
                application_type_id=row.application_type_id,
                fuel_code_type_id=row.fuel_code_type_id,
                operating_data_from=row.operating_data_from,
                operating_data_to=row.operating_data_to,
                fuel_code_id=row.fuel_code_id,
                proposed_ci=row.proposed_ci,
                fuel_type_id=row.fuel_type_id,
                feedstock=row.feedstock,
                feedstock_region=row.feedstock_region,
                feedstock_transport_mode=row.feedstock_transport_mode,
                feedstock_transport_distance=row.feedstock_transport_distance,
                coproducts=row.coproducts,
                finished_fuel_transport_mode=row.finished_fuel_transport_mode,
                finished_fuel_transport_distance=row.finished_fuel_transport_distance,
                group_uuid=str(uuid.uuid4()),
                version=0,
                action_type=ActionTypeEnum.CREATE,
                create_user=user.keycloak_username,
                update_user=user.keycloak_username,
            )
            for row in data.pathways
        ]

        await self.repo.replace_pathways(
            ci_application.ci_application_id, new_rows
        )

        ci_application.pathway_description = data.pathway_description
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return _to_full_schema(ci)

    # ------------------------------------------------------------------
    # Step 3 — Documents & GHGenius modelling
    # ------------------------------------------------------------------

    @service_handler
    async def list_documents(
        self, ci_application_id: int
    ) -> List[CIApplicationDocumentSchema]:
        """All Step 3 uploads for an application, with their categories."""
        rows = await self.repo.get_documents_with_categories(ci_application_id)
        return [
            CIApplicationDocumentSchema(
                document_id=document.document_id,
                file_name=document.file_name,
                file_size=document.file_size,
                document_category=category,
                create_date=(
                    document.create_date.isoformat() if document.create_date else None
                ),
                create_user=document.create_user,
            )
            for document, category in rows
        ]

    @service_handler
    async def update_step3(
        self,
        ci_application: CIApplication,
        data: CIApplicationStep3Schema,
        user: UserProfile,
    ) -> CIApplicationSchema:
        """
        Persists the optional "other supporting" description and verifies
        the mandatory uploads (Technical report + GHGenius model) are
        present. Files are uploaded out-of-band via the generic document
        endpoint with a category query param.
        """
        rows = await self.repo.get_documents_with_categories(
            ci_application.ci_application_id
        )
        present_categories = {category for _, category in rows}
        missing = []
        if CI_DOC_CATEGORY_TECHNICAL_REPORT not in present_categories:
            missing.append("Technical report")
        if CI_DOC_CATEGORY_GHGENIUS_MODEL not in present_categories:
            missing.append("GHGenius model")
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Missing required upload(s): " + ", ".join(missing) + "."
                ),
            )

        ci_application.supporting_document_other = data.supporting_document_other
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return _to_full_schema(ci)

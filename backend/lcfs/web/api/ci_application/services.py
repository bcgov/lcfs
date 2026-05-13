"""
Service layer for the Carbon Intensity (CI) application module.

Exposes the full Step 1-5 wizard: application information, proposed fuel
pathways, documents & GHGenius modelling, sign & submit, and government
decision (with the comments thread).
"""

import uuid
from datetime import datetime, timezone
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
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.ci_application.repo import CIApplicationRepository
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.api.ci_application.schema import (
    CIApplicationBaseSchema,
    CIApplicationDecisionSchema,
    CIApplicationSchema,
    CIApplicationStatusEnum,
    CIApplicationStatusSchema,
    CIApplicationsListSchema,
    CIApplicationStep1Schema,
    CIApplicationStep2Schema,
    CIApplicationStep3Schema,
    CIApplicationStep4Schema,
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


def _to_full_schema(
    ci: CIApplication,
    signature_user_display_name: Optional[str] = None,
) -> CIApplicationSchema:
    return CIApplicationSchema(
        signature_user_display_name=signature_user_display_name,
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
        documents=[
            FileResponseSchema.model_validate(d)
            for d in (getattr(ci, "documents", None) or [])
        ],
        supporting_document_other=ci.supporting_document_other,
        consultant_name=ci.consultant_name,
        consultant_company=ci.consultant_company,
        consultant_email=ci.consultant_email,
        signature_user=ci.signature_user,
        signature_date_time=ci.signature_date_time,
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
        user_repo: UserRepository = Depends(UserRepository),
    ) -> None:
        self.repo = repo
        self.user_repo = user_repo

    async def _to_full_schema_with_user(
        self, ci: CIApplication
    ) -> CIApplicationSchema:
        """Serialize a CI application, resolving the signing-authority's
        Keycloak username to a human display name via the user profile.
        """
        display_name = None
        if ci.signature_user:
            display_name = await self.user_repo.get_full_name(ci.signature_user)
            if display_name:
                display_name = display_name.strip() or None
        return _to_full_schema(ci, signature_user_display_name=display_name)

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
        return await self._to_full_schema_with_user(ci)

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
        return await self._to_full_schema_with_user(ci)

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
        return await self._to_full_schema_with_user(ci)

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

        # `replace_pathways` mutates the DB via a raw DELETE + db.add() pair
        # without touching `ci_application.pathways`. The collection on the
        # session-cached parent is therefore stale; re-querying via the
        # identity map won't refresh an already-loaded relationship. Force a
        # refresh so the response reflects what's actually in the database.
        await self.repo.refresh_pathways(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    # ------------------------------------------------------------------
    # Step 3 — Documents & GHGenius modelling
    # ------------------------------------------------------------------

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
        present_categories = set(
            await self.repo.get_document_categories(ci_application.ci_application_id)
        )
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
        return await self._to_full_schema_with_user(ci)

    # ------------------------------------------------------------------
    # Step 4 — Sign & submit
    # ------------------------------------------------------------------

    @service_handler
    async def submit_application(
        self,
        ci_application: CIApplication,
        data: CIApplicationStep4Schema,
        user: UserProfile,
    ) -> CIApplicationSchema:
        """
        Transition a Draft application to Submitted, persisting signature
        and consultant info and validating that prior steps left the
        record in a submittable state.
        """
        if ci_application.ci_application_status.status != CIApplicationStatusEnum.Draft.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Draft applications can be submitted.",
            )

        # Sanity-check the prior steps. Step 1 is enforced by NOT NULL
        # columns at the DB layer; we re-check Step 2 (at least one
        # pathway) and Step 3 (technical report + GHGenius model) so
        # signing authorities cannot bypass the wizard via the API.
        if not (ci_application.pathways or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one fuel pathway is required before submission.",
            )

        from lcfs.db.models.ci_application.CIApplication import (
            CI_DOC_CATEGORY_GHGENIUS_MODEL,
            CI_DOC_CATEGORY_TECHNICAL_REPORT,
        )

        present_categories = set(
            await self.repo.get_document_categories(ci_application.ci_application_id)
        )
        missing = []
        if CI_DOC_CATEGORY_TECHNICAL_REPORT not in present_categories:
            missing.append("Technical report")
        if CI_DOC_CATEGORY_GHGENIUS_MODEL not in present_categories:
            missing.append("GHGenius model")
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required upload(s): " + ", ".join(missing) + ".",
            )

        submitted_status = await self.repo.get_status_by_name(
            CIApplicationStatusEnum.Submitted.value
        )
        if not submitted_status:
            raise DataNotFoundException("Submitted status is not configured.")

        # Persist consultant info only when the signatory consented;
        # otherwise wipe any previously-saved values defensively.
        if data.consultant_consent:
            ci_application.consultant_name = data.consultant_name
            ci_application.consultant_company = data.consultant_company
            ci_application.consultant_email = data.consultant_email
        else:
            ci_application.consultant_name = None
            ci_application.consultant_company = None
            ci_application.consultant_email = None

        ci_application.signature_user = (
            f"{user.first_name or ''} {user.last_name or ''}".strip()
            or user.keycloak_username
        )
        ci_application.signature_date_time = datetime.now(timezone.utc)
        ci_application.status_id = submitted_status.ci_application_status_id
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE

        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    # ------------------------------------------------------------------
    # Step 5 — Government decision & comments
    # ------------------------------------------------------------------

    @service_handler
    async def record_decision(
        self,
        ci_application: CIApplication,
        data: CIApplicationDecisionSchema,
        user: UserProfile,
        is_government: bool,
    ) -> CIApplicationSchema:
        """
        Government users transition a Submitted application to Completed
        or Withdrawn. An optional comment is recorded as part of the
        decision. The terminal state lock is enforced here so we never
        re-decide an already-decided application.
        """
        if not is_government:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only government users can record a decision.",
            )

        if (
            ci_application.ci_application_status.status
            != CIApplicationStatusEnum.Submitted.value
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A decision can only be recorded on Submitted applications."
                ),
            )

        target_status = await self.repo.get_status_by_name(data.status.value)
        if not target_status:
            raise DataNotFoundException(
                f"Status '{data.status.value}' is not configured."
            )

        ci_application.status_id = target_status.ci_application_status_id
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)

        # NOTE: the optional `data.comment` field is intentionally ignored —
        # the Step 5 comment thread now lives in the shared internal_comments
        # framework (entityType="ciApplication"). Government reviewers who
        # want to attach a comment to a decision should post it through that
        # widget before/after recording the decision.

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

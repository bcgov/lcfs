"""
Service layer for the Carbon Intensity (CI) application module.

Exposes the full Step 1-5 wizard: application information, proposed fuel
pathways, documents & GHGenius modelling, sign & submit, and government
decision (with the comments thread).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import structlog
from fastapi import Depends, HTTPException, status

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import UserProfile
from lcfs.db.models.ci_application import (
    CIApplication,
    CIApplicationFuelCodeAssociation,
    Pathway,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.ci_application.CIApplication import (
    CI_DOC_CATEGORY_GHGENIUS_MODEL,
    CI_DOC_CATEGORY_TECHNICAL_REPORT,
)
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.ci_application.repo import CIApplicationRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.user.repo import UserRepository
from lcfs.web.api.ci_application.schema import (
    AssignedAnalystSchema,
    CIApplicationBaseSchema,
    CIApplicationDecisionSchema,
    CIGeneratedFuelCodeSchema,
    CIGeneratedFuelCodeUpdateSchema,
    CIApplicationSchema,
    CIApplicationUserSchema,
    CIRiskAssessmentEnum,
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
    LatestCommentSchema,
    OrganizationInfoSchema,
    PathwayApplicationTypeSchema,
    PathwayChangeLogSchema,
    PathwayFuelCodeTypeSchema,
    PathwayInputSchema,
    PathwaySchema,
)
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

# pathway_application_type.type values seeded by the migration
PATHWAY_APPLICATION_TYPE_NEW = "New"
PATHWAY_APPLICATION_TYPE_RENEWAL = "Renewal"

PATHWAY_LOG_FIELDS = [
    "application_type_id",
    "fuel_code_type_id",
    "operating_data_from",
    "operating_data_to",
    "fuel_code_id",
    "proposed_ci",
    "fuel_type_id",
    "feedstock",
    "feedstock_region",
    "feedstock_transport_mode",
    "feedstock_transport_distance",
    "coproducts",
    "finished_fuel_transport_mode",
    "finished_fuel_transport_distance",
]

logger = structlog.get_logger(__name__)


def _to_org_info(organization) -> Optional[OrganizationInfoSchema]:
    if organization is None:
        return None
    org_address = getattr(organization, "org_address", None)
    address_line = None
    if org_address is not None:
        address_line = ", ".join(
            filter(
                None,
                [
                    getattr(org_address, "street_address", None),
                    getattr(org_address, "address_other", None),
                    getattr(org_address, "city", None),
                    getattr(org_address, "province_state", None),
                    getattr(org_address, "country", None),
                    getattr(org_address, "postalCode_zipCode", None),
                ],
            )
        )
    return OrganizationInfoSchema(
        organization_id=organization.organization_id,
        name=organization.name,
        operating_name=organization.operating_name,
        email=organization.email,
        phone=organization.phone,
        address_line=address_line or None,
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
        effective_date=fc.effective_date,
        expiration_date=fc.expiration_date,
    )


def _to_pathway_schema(pathway: Pathway) -> PathwaySchema:
    action_type = getattr(pathway, "action_type", None)
    return PathwaySchema(
        pathway_id=pathway.pathway_id,
        ci_application_id=pathway.ci_application_id,
        group_uuid=getattr(pathway, "group_uuid", None),
        version=getattr(pathway, "version", None),
        action_type=action_type.value if hasattr(action_type, "value") else action_type,
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
        fuel_code=(
            _to_fuel_code_option(pathway.fuel_code) if pathway.fuel_code else None
        ),
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


def _json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value


def _pathway_snapshot(pathway: Pathway) -> Dict[str, Any]:
    snapshot = {
        "pathway_id": getattr(pathway, "pathway_id", None),
        "pathway_group_uuid": getattr(pathway, "group_uuid", None),
    }
    for field in PATHWAY_LOG_FIELDS:
        snapshot[field] = _json_value(getattr(pathway, field, None))
    return snapshot


def _pathway_input_snapshot(
    row: PathwayInputSchema,
    pathway: Optional[Pathway] = None,
    pathway_group_uuid: Optional[str] = None,
) -> Dict[str, Any]:
    snapshot = {
        "pathway_id": getattr(pathway, "pathway_id", None) or row.pathway_id,
        "pathway_group_uuid": pathway_group_uuid
        or getattr(pathway, "group_uuid", None),
    }
    for field in PATHWAY_LOG_FIELDS:
        snapshot[field] = _json_value(getattr(row, field, None))
    return snapshot


def _changed_fields(
    before: Optional[Dict[str, Any]],
    after: Optional[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    changes: Dict[str, Dict[str, Any]] = {}
    for field in PATHWAY_LOG_FIELDS:
        old_value = before.get(field) if before else None
        new_value = after.get(field) if after else None
        if old_value != new_value:
            changes[field] = {"old": old_value, "new": new_value}
    return changes


def _action_type_value(action_type: Any) -> str:
    return action_type.value if hasattr(action_type, "value") else str(action_type)


def _sorted_pathways(pathways: List[Pathway]) -> List[Pathway]:
    return sorted(
        pathways,
        key=lambda p: (
            getattr(p, "create_date", None) or datetime.min,
            getattr(p, "group_uuid", "") or "",
            getattr(p, "version", 0) or 0,
            getattr(p, "pathway_id", 0) or 0,
        ),
    )


def _latest_active_pathways(pathways: List[Pathway]) -> List[Pathway]:
    latest_by_group: Dict[str, Pathway] = {}
    for pathway in _sorted_pathways(pathways):
        group_uuid = getattr(pathway, "group_uuid", None)
        if not group_uuid:
            continue
        current = latest_by_group.get(group_uuid)
        if current is None or (pathway.version or 0) >= (current.version or 0):
            latest_by_group[group_uuid] = pathway

    if not latest_by_group:
        return sorted(
            [
                pathway
                for pathway in pathways
                if _action_type_value(getattr(pathway, "action_type", "CREATE"))
                != ActionTypeEnum.DELETE.value
            ],
            key=lambda p: getattr(p, "pathway_id", 0) or 0,
        )

    active = [
        pathway
        for pathway in latest_by_group.values()
        if _action_type_value(pathway.action_type) != ActionTypeEnum.DELETE.value
    ]
    return sorted(
        active,
        key=lambda p: (
            getattr(p, "create_date", None) or datetime.min,
            getattr(p, "pathway_id", 0) or 0,
        ),
    )


def _pathway_change_logs_from_versions(
    pathways: List[Pathway],
) -> List[PathwayChangeLogSchema]:
    by_group: Dict[str, List[Pathway]] = {}
    for pathway in _sorted_pathways(pathways):
        group_uuid = getattr(pathway, "group_uuid", None)
        if not group_uuid:
            continue
        by_group.setdefault(group_uuid, []).append(pathway)

    logs: List[PathwayChangeLogSchema] = []
    for group_uuid, group_pathways in by_group.items():
        previous_snapshot: Optional[Dict[str, Any]] = None
        for pathway in group_pathways:
            action_type = _action_type_value(pathway.action_type)
            current_snapshot = (
                None
                if action_type == ActionTypeEnum.DELETE.value
                else _pathway_snapshot(pathway)
            )
            comparison_snapshot = (
                None if action_type == ActionTypeEnum.DELETE.value else current_snapshot
            )
            changed_fields = _changed_fields(previous_snapshot, comparison_snapshot)
            if changed_fields:
                logs.append(
                    PathwayChangeLogSchema(
                        ci_application_id=pathway.ci_application_id,
                        pathway_id=pathway.pathway_id,
                        pathway_group_uuid=group_uuid,
                        action_type=action_type,
                        changed_at=getattr(pathway, "create_date", None),
                        changed_by=getattr(pathway, "create_user", None),
                        changed_fields=changed_fields,
                        before_snapshot=previous_snapshot,
                        after_snapshot=current_snapshot,
                    )
                )
            previous_snapshot = _pathway_snapshot(pathway)

    return sorted(
        logs,
        key=lambda log: (
            log.changed_at or datetime.min.replace(tzinfo=timezone.utc),
            log.pathway_id or 0,
        ),
    )


def _generated_validation_message(validation_errors: Dict[str, str]) -> Optional[str]:
    if not validation_errors:
        return None
    if len(validation_errors) == 1:
        field, message = next(iter(validation_errors.items()))
        return f"{field}: {message}"
    return "Fill in the missing required fields."


def _validate_generated_fuel_code_row_values(row: Dict[str, Any]) -> Dict[str, Any]:
    validation_errors: Dict[str, str] = {}
    required_fields = [
        ("prefix_id", "prefixId"),
        ("fuel_suffix", "fuelSuffix"),
        ("carbon_intensity", "carbonIntensity"),
        ("edrms", "edrms"),
        ("company", "company"),
        ("application_date", "applicationDate"),
        ("approval_date", "approvalDate"),
        ("effective_date", "effectiveDate"),
        ("expiration_date", "expirationDate"),
        ("fuel_type_id", "fuelTypeId"),
        ("feedstock", "feedstock"),
        ("feedstock_location", "feedstockLocation"),
        ("fuel_production_facility_city", "fuelProductionFacilityCity"),
        (
            "fuel_production_facility_province_state",
            "fuelProductionFacilityProvinceState",
        ),
        (
            "fuel_production_facility_country",
            "fuelProductionFacilityCountry",
        ),
    ]
    for internal_key, frontend_key in required_fields:
        value = row.get(internal_key)
        if value in (None, "", []):
            validation_errors[frontend_key] = "Required."

    if row.get("facility_nameplate_capacity") not in (None, "") and not row.get(
        "facility_nameplate_capacity_unit"
    ):
        validation_errors["facilityNameplateCapacityUnit"] = "Required."

    application_date = row.get("application_date")
    approval_date = row.get("approval_date")
    effective_date = row.get("effective_date")
    expiration_date = row.get("expiration_date")

    if application_date and approval_date and application_date >= approval_date:
        validation_errors["applicationDate"] = "Must be before approval date."
        validation_errors["approvalDate"] = "Must be after application date."
    if application_date and expiration_date and application_date >= expiration_date:
        validation_errors["applicationDate"] = "Must be before expiration date."
    if effective_date and application_date and effective_date < application_date:
        validation_errors["effectiveDate"] = "Must be on or after application date."
    if effective_date and expiration_date and effective_date >= expiration_date:
        validation_errors["effectiveDate"] = "Must be before expiration date."
        validation_errors["expirationDate"] = "Must be after effective date."

    row["is_valid"] = not validation_errors
    row["validation_errors"] = validation_errors or None
    row["validation_msg"] = _generated_validation_message(validation_errors)
    return row


def _to_generated_fuel_code_schema(row: Dict[str, Any]) -> CIGeneratedFuelCodeSchema:
    return CIGeneratedFuelCodeSchema.model_validate(row or {})


def _transport_mode_names(
    transport_modes: List[Any], relationship_name: str
) -> List[str]:
    names = []
    for item in transport_modes or []:
        transport_mode = getattr(item, relationship_name, None)
        if transport_mode and getattr(transport_mode, "transport_mode", None):
            names.append(transport_mode.transport_mode)
    return names


def _generated_fuel_code_row_from_association(
    association: CIApplicationFuelCodeAssociation,
) -> Optional[Dict[str, Any]]:
    fuel_code = getattr(association, "fuel_code", None)
    if not fuel_code:
        return None
    status_value = getattr(getattr(fuel_code, "fuel_code_status", None), "status", None)
    if getattr(status_value, "value", status_value) != FuelCodeStatusEnum.Draft.value:
        return None

    pathway = getattr(association, "pathway", None)
    display_order = association.display_order or 0
    row = CIGeneratedFuelCodeSchema(
        id=str(fuel_code.fuel_code_id),
        pathway_id=getattr(pathway, "pathway_id", None),
        pathway_label=f"Pathway {display_order}" if display_order else None,
        prefix_id=fuel_code.prefix_id,
        prefix=(
            fuel_code.fuel_code_prefix.prefix if fuel_code.fuel_code_prefix else None
        ),
        fuel_suffix=fuel_code.fuel_suffix,
        carbon_intensity=(
            float(fuel_code.carbon_intensity)
            if fuel_code.carbon_intensity is not None
            else None
        ),
        edrms=fuel_code.edrms,
        company=fuel_code.company,
        contact_name=fuel_code.contact_name,
        contact_email=fuel_code.contact_email,
        application_date=fuel_code.application_date,
        approval_date=fuel_code.approval_date,
        effective_date=fuel_code.effective_date,
        expiration_date=fuel_code.expiration_date,
        fuel_type_id=fuel_code.fuel_type_id,
        feedstock=fuel_code.feedstock,
        feedstock_location=fuel_code.feedstock_location,
        feedstock_misc=fuel_code.feedstock_misc,
        co_processed=fuel_code.co_processed,
        fuel_production_facility_city=fuel_code.fuel_production_facility_city,
        fuel_production_facility_province_state=(
            fuel_code.fuel_production_facility_province_state
        ),
        fuel_production_facility_country=fuel_code.fuel_production_facility_country,
        facility_nameplate_capacity=fuel_code.facility_nameplate_capacity,
        facility_nameplate_capacity_unit=(
            fuel_code.facility_nameplate_capacity_unit.value
            if fuel_code.facility_nameplate_capacity_unit
            else None
        ),
        former_company=fuel_code.former_company,
        notes=fuel_code.notes,
        feedstock_fuel_transport_mode=_transport_mode_names(
            fuel_code.feedstock_fuel_transport_modes,
            "feedstock_fuel_transport_mode",
        ),
        finished_fuel_transport_mode=_transport_mode_names(
            fuel_code.finished_fuel_transport_modes,
            "finished_fuel_transport_mode",
        ),
    ).model_dump(mode="json")
    return _validate_generated_fuel_code_row_values(row)


def _next_local_fuel_suffix(
    candidate: Optional[str], reserved: set[str]
) -> Optional[str]:
    if not candidate:
        return candidate
    next_value = candidate
    while next_value in reserved:
        if "." not in next_value:
            next_value = f"{int(next_value) + 1:03d}.0"
            continue
        main_version, sub_version = next_value.split(".")
        if sub_version == "0":
            next_value = f"{int(main_version) + 1:03d}.0"
        else:
            next_value = f"{int(main_version):03d}.{int(sub_version) + 1}"
    reserved.add(next_value)
    return next_value


def _user_has_any_role(user: UserProfile, role_names: List[RoleEnum]) -> bool:
    return any(user_has_roles(user, [role_name]) for role_name in role_names)


def _to_full_schema(
    ci: CIApplication,
    signature_user_display_name: Optional[str] = None,
) -> CIApplicationSchema:
    all_pathways = list(getattr(ci, "pathways", None) or [])
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
        facility_nameplate_capacity_unit=(
            ci.facility_nameplate_capacity_unit.value
            if ci.facility_nameplate_capacity_unit
            else None
        ),
        proposed_fuel_code_effective_date=ci.proposed_fuel_code_effective_date,
        pathway_description=ci.pathway_description,
        pathways=[_to_pathway_schema(p) for p in _latest_active_pathways(all_pathways)],
        pathway_supplemental_edit_enabled=bool(
            getattr(ci, "pathway_supplemental_edit_enabled", False)
        ),
        pathway_changes_requested_at=getattr(ci, "pathway_changes_requested_at", None),
        pathway_changes_requested_by=getattr(ci, "pathway_changes_requested_by", None),
        pathway_changelog=[
            history.ci_application_snapshot
            for history in (getattr(ci, "history_records", None) or [])
            if isinstance(history.ci_application_snapshot, dict)
            and history.ci_application_snapshot.get("event")
            in {"pathway_changes_requested", "supplemental_pathways_updated"}
        ],
        pathway_change_logs=_pathway_change_logs_from_versions(all_pathways),
        generated_fuel_codes=[
            _to_generated_fuel_code_schema(row)
            for row in (
                _generated_fuel_code_row_from_association(association)
                for association in (
                    getattr(ci, "generated_fuel_code_associations", None) or []
                )
            )
            if row
        ],
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
        preliminary_risk_assessment=getattr(ci, "preliminary_risk_assessment", None),
        priority_score=getattr(ci, "priority_score", None),
        assigned_analyst=CIApplicationUserSchema.model_validate(
            getattr(ci, "assigned_analyst", None)
        ),
        verification_1_user=CIApplicationUserSchema.model_validate(
            getattr(ci, "verification_1_user", None)
        ),
        verification_1_date=getattr(ci, "verification_1_date", None),
        verification_2_user=CIApplicationUserSchema.model_validate(
            getattr(ci, "verification_2_user", None)
        ),
        verification_2_date=getattr(ci, "verification_2_date", None),
        verification_2_risk_assessment=getattr(
            ci, "verification_2_risk_assessment", None
        ),
        verification_2_priority_score=getattr(
            ci, "verification_2_priority_score", None
        ),
        recommendation_user=CIApplicationUserSchema.model_validate(
            getattr(ci, "recommendation_user", None)
        ),
        recommendation_date=getattr(ci, "recommendation_date", None),
        approval_user=CIApplicationUserSchema.model_validate(
            getattr(ci, "approval_user", None)
        ),
        approval_date=getattr(ci, "approval_date", None),
    )


def _initials(first: Optional[str], last: Optional[str]) -> Optional[str]:
    first_part = (first or "").strip()
    last_part = (last or "").strip()
    if not first_part and not last_part:
        return None
    return f"{first_part[:1]}{last_part[:1]}".upper()


def _to_assigned_analyst(user) -> Optional[AssignedAnalystSchema]:
    if user is None:
        return None
    first = getattr(user, "first_name", None)
    last = getattr(user, "last_name", None)
    full = " ".join(p for p in (first, last) if p).strip() or None
    return AssignedAnalystSchema(
        user_profile_id=user.user_profile_id,
        first_name=first,
        last_name=last,
        initials=_initials(first, last),
        full_name=full,
    )


def _verification_level_from_progress(ci: CIApplication) -> Optional[str]:
    if getattr(ci, "verification_2_date", None):
        return "VX2"
    if getattr(ci, "verification_1_date", None):
        return "VX1"
    return None


def _effective_priority_score(ci: CIApplication) -> Optional[int]:
    verification_2_score = getattr(ci, "verification_2_priority_score", None)
    if verification_2_score is not None:
        return verification_2_score
    return getattr(ci, "priority_score", None)


def _to_list_item(
    ci: CIApplication,
    last_comment_entry: Optional[Tuple] = None,
) -> CIApplicationBaseSchema:
    last_comment: Optional[LatestCommentSchema] = None
    if last_comment_entry is not None:
        comment, full_name = last_comment_entry
        last_comment = LatestCommentSchema(
            comment=comment.comment,
            full_name=full_name or None,
            create_date=comment.create_date,
        )

    return CIApplicationBaseSchema(
        ci_application_id=ci.ci_application_id,
        organization_id=ci.organization_id,
        organization=_to_org_info(ci.organization),
        status=CIApplicationStatusSchema.model_validate(ci.ci_application_status),
        facility_city=ci.facility_city,
        facility_province_state=ci.facility_province_state,
        facility_country=ci.facility_country,
        facility_nameplate_capacity=ci.facility_nameplate_capacity,
        facility_nameplate_capacity_unit=(
            ci.facility_nameplate_capacity_unit.value
            if ci.facility_nameplate_capacity_unit
            else None
        ),
        proposed_fuel_code_effective_date=ci.proposed_fuel_code_effective_date,
        pathway_supplemental_edit_enabled=bool(
            getattr(ci, "pathway_supplemental_edit_enabled", False)
        ),
        preliminary_risk_assessment=getattr(ci, "preliminary_risk_assessment", None),
        update_date=ci.update_date.isoformat() if ci.update_date else None,
        create_date=ci.create_date.isoformat() if ci.create_date else None,
        assigned_analyst=_to_assigned_analyst(getattr(ci, "assigned_analyst", None)),
        last_comment=last_comment,
        priority_score=_effective_priority_score(ci),
        verification_level=_verification_level_from_progress(ci),
    )


class CIApplicationServices:
    def __init__(
        self,
        repo: CIApplicationRepository = Depends(CIApplicationRepository),
        user_repo: UserRepository = Depends(UserRepository),
        fuel_repo: FuelCodeRepository = Depends(FuelCodeRepository),
    ) -> None:
        self.repo = repo
        self.user_repo = user_repo
        self.fuel_repo = fuel_repo

    async def _to_full_schema_with_user(self, ci: CIApplication) -> CIApplicationSchema:
        """Serialize a CI application, resolving the signing-authority's
        Keycloak username to a human display name via the user profile.
        """
        display_name = None
        if ci.signature_user:
            display_name = await self.user_repo.get_full_name(ci.signature_user)
            if display_name:
                display_name = display_name.strip() or None
        return _to_full_schema(ci, signature_user_display_name=display_name)

    @service_handler
    async def generate_fuel_codes(
        self,
        ci_application: CIApplication,
        user: UserProfile,
    ) -> CIApplicationSchema:
        if not _user_has_any_role(
            user,
            [RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR],
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only internal users can generate fuel codes.",
            )
        self._require_submitted_workflow(ci_application)
        risk = ci_application.preliminary_risk_assessment
        verification_2_risk = ci_application.verification_2_risk_assessment or risk
        requires_verification_2 = risk in {
            CIRiskAssessmentEnum.Medium.value,
            CIRiskAssessmentEnum.High.value,
        }
        can_generate_after_verification_1 = (
            ci_application.verification_1_date and not requires_verification_2
        )
        can_generate_after_verification_2 = (
            ci_application.verification_2_date
            and verification_2_risk
            in {
                CIRiskAssessmentEnum.Low.value,
                CIRiskAssessmentEnum.Medium.value,
                CIRiskAssessmentEnum.High.value,
            }
        )
        if not (can_generate_after_verification_1 or can_generate_after_verification_2):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Required verification steps must be completed first.",
            )
        if self._get_generated_fuel_codes(ci_application):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fuel codes have already been generated for this application.",
            )

        prefix_map = await self._get_fuel_code_prefix_map()
        draft_status = await self.fuel_repo.get_fuel_status_by_status(
            FuelCodeStatusEnum.Draft
        )
        transport_modes = await self.fuel_repo.get_transport_modes()
        application_date = (
            ci_application.signature_date_time.date()
            if ci_application.signature_date_time
            else date.today()
        )
        reserved_suffixes_by_prefix: Dict[str, set[str]] = {}

        associations: List[CIApplicationFuelCodeAssociation] = []
        current_pathways = _latest_active_pathways(
            list(getattr(ci_application, "pathways", None) or [])
        )
        for index, pathway in enumerate(current_pathways, start=1):
            prefix_id, prefix_name, fuel_suffix = (
                await self._resolve_generated_prefix_and_suffix(
                    pathway,
                    prefix_map,
                    ci_application.facility_country,
                )
            )
            if prefix_name:
                reserved_suffixes = reserved_suffixes_by_prefix.setdefault(
                    prefix_name, set()
                )
                fuel_suffix = _next_local_fuel_suffix(fuel_suffix, reserved_suffixes)
            if not prefix_id or not fuel_suffix:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unable to reserve a fuel code prefix and suffix.",
                )

            draft_fuel_code = FuelCode(
                fuel_status_id=draft_status.fuel_code_status_id,
                prefix_id=prefix_id,
                fuel_suffix=fuel_suffix,
                carbon_intensity=(
                    Decimal(pathway.proposed_ci)
                    if pathway.proposed_ci is not None
                    else None
                ),
                edrms=getattr(ci_application.organization, "edrms_record", None) or "",
                company=getattr(ci_application.organization, "name", None),
                contact_name=ci_application.signature_user,
                contact_email=getattr(ci_application.organization, "email", None),
                application_date=application_date,
                approval_date=None,
                effective_date=ci_application.proposed_fuel_code_effective_date,
                expiration_date=pathway.operating_data_to,
                fuel_type_id=pathway.fuel_type_id,
                feedstock=pathway.feedstock,
                feedstock_location=pathway.feedstock_region,
                co_processed="No",
                fuel_production_facility_city=ci_application.facility_city,
                fuel_production_facility_province_state=ci_application.facility_province_state,
                fuel_production_facility_country=ci_application.facility_country,
                facility_nameplate_capacity=ci_application.facility_nameplate_capacity,
                facility_nameplate_capacity_unit=ci_application.facility_nameplate_capacity_unit,
                organization_id=ci_application.organization_id,
            )
            draft_fuel_code.feedstock_fuel_transport_modes = (
                self._fuel_code_transport_mode_links(
                    pathway.feedstock_transport_mode,
                    transport_modes,
                    FeedstockFuelTransportMode,
                )
            )
            draft_fuel_code.finished_fuel_transport_modes = (
                self._fuel_code_transport_mode_links(
                    pathway.finished_fuel_transport_mode,
                    transport_modes,
                    FinishedFuelTransportMode,
                )
            )

            created_fuel_code = await self.fuel_repo.create_fuel_code(draft_fuel_code)
            associations.append(
                CIApplicationFuelCodeAssociation(
                    ci_application_id=ci_application.ci_application_id,
                    fuel_code_id=created_fuel_code.fuel_code_id,
                    fuel_code=created_fuel_code,
                    pathway_id=pathway.pathway_id,
                    pathway=pathway,
                    display_order=index,
                )
            )

        ci_application.generated_fuel_code_associations = associations
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    @service_handler
    async def update_generated_fuel_code(
        self,
        ci_application: CIApplication,
        generated_fuel_code_id: str,
        data: CIGeneratedFuelCodeUpdateSchema,
        user: UserProfile,
    ) -> CIGeneratedFuelCodeSchema:
        if not _user_has_any_role(
            user,
            [RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR],
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only internal users can update generated fuel codes.",
            )
        self._require_submitted_workflow(ci_application)

        association = next(
            (
                item
                for item in (
                    getattr(ci_application, "generated_fuel_code_associations", None)
                    or []
                )
                if str(item.fuel_code_id) == str(generated_fuel_code_id)
            ),
            None,
        )
        if not association or not association.fuel_code:
            raise DataNotFoundException("Generated fuel code not found.")

        fuel_code = association.fuel_code
        updates = data.model_dump(exclude_unset=True)
        feedstock_transport_modes = updates.pop("feedstock_fuel_transport_mode", None)
        finished_transport_modes = updates.pop("finished_fuel_transport_mode", None)
        if "facility_nameplate_capacity_unit" in updates:
            unit = updates["facility_nameplate_capacity_unit"]
            updates["facility_nameplate_capacity_unit"] = (
                QuantityUnitsEnum(unit) if unit else None
            )

        for field, value in updates.items():
            if hasattr(fuel_code, field):
                setattr(fuel_code, field, value)

        transport_modes = await self.fuel_repo.get_transport_modes()
        if feedstock_transport_modes is not None:
            self._sync_fuel_code_transport_mode_links(
                fuel_code.feedstock_fuel_transport_modes,
                feedstock_transport_modes,
                transport_modes,
                FeedstockFuelTransportMode,
            )
        if finished_transport_modes is not None:
            self._sync_fuel_code_transport_mode_links(
                fuel_code.finished_fuel_transport_modes,
                finished_transport_modes,
                transport_modes,
                FinishedFuelTransportMode,
            )

        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)
        updated_ci = await self.repo.get_by_id(ci_application.ci_application_id)
        updated_association = next(
            (
                item
                for item in (
                    getattr(updated_ci, "generated_fuel_code_associations", None) or []
                )
                if str(item.fuel_code_id) == str(generated_fuel_code_id)
            ),
            association,
        )
        row = _generated_fuel_code_row_from_association(updated_association)
        return _to_generated_fuel_code_schema(row)

    def _get_generated_fuel_codes(self, ci_application: CIApplication) -> List[dict]:
        return [
            row
            for row in (
                _generated_fuel_code_row_from_association(association)
                for association in (
                    getattr(ci_application, "generated_fuel_code_associations", None)
                    or []
                )
            )
            if row
        ]

    def _fuel_code_transport_mode_links(
        self,
        selected_modes: Optional[Any],
        transport_modes: List[Any],
        link_model: Any,
    ) -> List[Any]:
        if selected_modes in (None, "", []):
            return []
        mode_names = self._unique_transport_mode_names(selected_modes)
        links = []
        for mode_name in mode_names:
            matching_transport_mode = next(
                (mode for mode in transport_modes if mode.transport_mode == mode_name),
                None,
            )
            if matching_transport_mode:
                links.append(
                    link_model(
                        transport_mode_id=matching_transport_mode.transport_mode_id
                    )
                )
        return links

    def _sync_fuel_code_transport_mode_links(
        self,
        existing_links: List[Any],
        selected_modes: Optional[Any],
        transport_modes: List[Any],
        link_model: Any,
    ) -> None:
        desired_ids = {
            mode.transport_mode_id
            for mode_name in self._unique_transport_mode_names(selected_modes)
            for mode in transport_modes
            if mode.transport_mode == mode_name
        }
        existing_by_id = {
            link.transport_mode_id: link
            for link in existing_links
            if link.transport_mode_id is not None
        }

        existing_links[:] = [
            link for link in existing_links if link.transport_mode_id in desired_ids
        ]

        for transport_mode_id in desired_ids - set(existing_by_id):
            existing_links.append(link_model(transport_mode_id=transport_mode_id))

    def _unique_transport_mode_names(self, selected_modes: Optional[Any]) -> List[str]:
        if selected_modes in (None, "", []):
            return []
        mode_names = (
            selected_modes if isinstance(selected_modes, list) else [selected_modes]
        )
        return list(dict.fromkeys(mode_name for mode_name in mode_names if mode_name))

    async def _get_fuel_code_prefix_map(self) -> Dict[str, Any]:
        prefixes = await self.fuel_repo.get_fuel_code_prefixes()
        return {prefix.prefix: prefix for prefix in prefixes}

    async def _resolve_generated_prefix_and_suffix(
        self,
        pathway: Pathway,
        prefix_map: Dict[str, Any],
        facility_country: Optional[str],
    ) -> tuple[Optional[int], Optional[str], Optional[str]]:
        if pathway.fuel_code_id and pathway.fuel_code and pathway.fuel_code.prefix_id:
            prefix_id = pathway.fuel_code.prefix_id
            prefix_name = (
                pathway.fuel_code.fuel_code_prefix.prefix
                if pathway.fuel_code.fuel_code_prefix
                else None
            )
            fuel_suffix = pathway.fuel_code.fuel_suffix if pathway.fuel_code else None
            if prefix_id and fuel_suffix:
                next_suffix = await self.fuel_repo.get_next_available_sub_version_fuel_code_by_prefix(
                    fuel_suffix.split(".")[0],
                    prefix_id,
                )
                return prefix_id, prefix_name, next_suffix

        prefix_name = (
            "C-BCLCF"
            if (facility_country or "").strip().lower() == "canada"
            else "BCLCF"
        )
        prefix = prefix_map.get(prefix_name)
        if not prefix:
            return None, prefix_name, None
        next_suffix = await self.fuel_repo.get_next_available_fuel_code_by_prefix(
            prefix_name
        )
        return prefix.fuel_code_prefix_id, prefix_name, next_suffix

    def _validate_generated_fuel_code_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return _validate_generated_fuel_code_row_values(row)

    def _assert_generated_fuel_codes_ready_for_recommendation(
        self, ci_application: CIApplication
    ) -> None:
        generated_rows = self._get_generated_fuel_codes(ci_application)
        invalid_rows = [row for row in generated_rows if not row.get("is_valid", False)]
        if invalid_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Generated fuel codes have missing required fields. "
                    "Complete them before recommendation."
                ),
            )

    # ------------------------------------------------------------------
    # Reference data
    # ------------------------------------------------------------------

    @service_handler
    async def get_table_options(self) -> CITableOptionsSchema:
        statuses = await self.repo.get_statuses()
        application_types = await self.repo.get_pathway_application_types()
        fuel_code_types = await self.repo.get_pathway_fuel_code_types()
        fuel_types = await self.repo.get_fuel_types()
        transport_modes = await self.repo.get_transport_modes()
        fuel_codes = await self.repo.get_approved_fuel_codes()
        return CITableOptionsSchema(
            statuses=[CIApplicationStatusSchema.model_validate(s) for s in statuses],
            # Facility nameplate capacity is a physical quantity — use the same
            # units as fuel codes (L, kg, kWh, Gj, m³), not energy densities.
            units_of_measure=[unit.value for unit in QuantityUnitsEnum],
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
        exclude_draft: bool = False,
    ) -> CIApplicationsListSchema:
        items, total = await self.repo.list_paginated(
            pagination,
            organization_id,
            exclude_draft=exclude_draft,
        )

        latest_comments = (
            await self.repo.get_latest_comments_by_ci_application_ids(
                [ci.ci_application_id for ci in items]
            )
            if items
            else {}
        )

        return CIApplicationsListSchema(
            ci_applications=[
                _to_list_item(
                    ci,
                    last_comment_entry=latest_comments.get(ci.ci_application_id),
                )
                for ci in items
            ],
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

    async def _validate_analyst_eligibility(self, assigned_analyst_id: int) -> None:
        assigned_analyst = await self.repo.get_user_by_id(assigned_analyst_id)
        if not assigned_analyst:
            raise DataNotFoundException("Assigned analyst not found.")

        role_names = [user_role.role.name for user_role in assigned_analyst.user_roles]
        is_idir_user = assigned_analyst.organization_id is None
        if RoleEnum.ANALYST not in role_names or not is_idir_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user must be an active IDIR analyst.",
            )

    @service_handler
    async def get_available_analysts(self) -> List[CIApplicationUserSchema]:
        analysts = await self.repo.get_active_idir_analysts()
        return [CIApplicationUserSchema.model_validate(analyst) for analyst in analysts]

    @service_handler
    async def assign_analyst_to_application(
        self,
        ci_application: CIApplication,
        assigned_analyst_id: Optional[int],
        user: UserProfile,
    ) -> CIApplicationSchema:
        if (
            ci_application.ci_application_status.status
            == CIApplicationStatusEnum.Withdrawn.value
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow actions cannot be recorded on Withdrawn applications.",
            )

        if assigned_analyst_id:
            await self._validate_analyst_eligibility(assigned_analyst_id)

        ci_application.assigned_analyst_id = assigned_analyst_id
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    @service_handler
    async def complete_verification_1(
        self,
        ci_application: CIApplication,
        risk_assessment: CIRiskAssessmentEnum,
        priority_score: Optional[int],
        user: UserProfile,
    ) -> CIApplicationSchema:
        self._require_submitted_workflow(ci_application)
        self._validate_priority_score(priority_score)
        ci_application.preliminary_risk_assessment = risk_assessment.value
        ci_application.priority_score = priority_score
        ci_application.verification_1_user_id = user.user_profile_id
        ci_application.verification_1_date = datetime.now(timezone.utc)
        ci_application.assigned_analyst_id = None
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    @service_handler
    async def complete_verification_2(
        self,
        ci_application: CIApplication,
        risk_assessment: Optional[CIRiskAssessmentEnum],
        priority_score: Optional[int],
        user: UserProfile,
    ) -> CIApplicationSchema:
        self._require_submitted_workflow(ci_application)
        self._validate_priority_score(priority_score)
        if ci_application.preliminary_risk_assessment not in {
            CIRiskAssessmentEnum.Medium.value,
            CIRiskAssessmentEnum.High.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification 2 is only required for Medium or High risk applications.",
            )
        if not ci_application.verification_1_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification 1 must be completed first.",
            )

        ci_application.verification_2_risk_assessment = (
            risk_assessment.value
            if risk_assessment is not None
            else ci_application.preliminary_risk_assessment
        )
        ci_application.verification_2_priority_score = (
            priority_score
            if priority_score is not None
            else ci_application.priority_score
        )
        ci_application.verification_2_user_id = user.user_profile_id
        ci_application.verification_2_date = datetime.now(timezone.utc)
        ci_application.assigned_analyst_id = None
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    @service_handler
    async def recommend_to_director(
        self,
        ci_application: CIApplication,
        user: UserProfile,
    ) -> CIApplicationSchema:
        if not _user_has_any_role(
            user,
            [RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR],
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only analysts, compliance managers, and directors can "
                    "recommend CI applications to directors."
                ),
            )
        self._require_submitted_workflow(ci_application)
        risk = ci_application.preliminary_risk_assessment
        requires_verification_2 = risk in {
            CIRiskAssessmentEnum.Medium.value,
            CIRiskAssessmentEnum.High.value,
        }
        if not ci_application.verification_1_date or (
            requires_verification_2 and not ci_application.verification_2_date
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Required verification steps must be completed first.",
            )
        self._assert_generated_fuel_codes_ready_for_recommendation(ci_application)

        ci_application.recommendation_user_id = user.user_profile_id
        ci_application.recommendation_date = datetime.now(timezone.utc)
        recommended_status = await self.repo.get_status_by_name(
            CIApplicationStatusEnum.Recommended.value
        )
        if not recommended_status:
            raise DataNotFoundException(
                f"Status '{CIApplicationStatusEnum.Recommended.value}' is not configured."
            )
        ci_application.status_id = recommended_status.ci_application_status_id
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(ci_application)

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    def _validate_priority_score(self, priority_score: Optional[int]) -> None:
        if (
            not isinstance(priority_score, int)
            or isinstance(priority_score, bool)
            or priority_score < 1
            or priority_score > 999
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Priority score is required and must be a whole number from 1 to 999.",
            )

    def _require_submitted_workflow(self, ci_application: CIApplication) -> None:
        if (
            ci_application.ci_application_status.status
            != CIApplicationStatusEnum.Submitted.value
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow actions can only be recorded on Submitted applications.",
            )

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
            facility_nameplate_capacity_unit=QuantityUnitsEnum(
                data.facility_nameplate_capacity_unit
            ),
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
        ci_application.facility_nameplate_capacity_unit = QuantityUnitsEnum(
            data.facility_nameplate_capacity_unit
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
        current_status = ci_application.ci_application_status.status
        is_supplemental_edit = (
            current_status == CIApplicationStatusEnum.Submitted.value
            and bool(
                getattr(ci_application, "pathway_supplemental_edit_enabled", False)
            )
        )
        if (
            current_status != CIApplicationStatusEnum.Draft.value
            and not is_supplemental_edit
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Pathways can only be edited on Draft applications or when "
                    "supplemental pathway editing has been requested."
                ),
            )

        await self._validate_step2_payload(data)
        previous_pathway_entities = (
            _latest_active_pathways(list(ci_application.pathways or []))
            if is_supplemental_edit
            else []
        )
        previous_by_id = {
            pathway.pathway_id: pathway
            for pathway in previous_pathway_entities
            if getattr(pathway, "pathway_id", None) is not None
        }
        previous_pathways = (
            [_pathway_snapshot(pathway) for pathway in previous_pathway_entities]
            if is_supplemental_edit
            else []
        )

        new_rows: List[Pathway] = []
        for row in data.pathways:
            previous = (
                previous_by_id.get(row.pathway_id) if is_supplemental_edit else None
            )
            pathway = Pathway(
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
                group_uuid=previous.group_uuid if previous else str(uuid.uuid4()),
                version=((previous.version or 0) + 1) if previous else 0,
                action_type=(
                    ActionTypeEnum.UPDATE if previous else ActionTypeEnum.CREATE
                ),
                create_user=(
                    previous.create_user
                    if previous and getattr(previous, "create_user", None)
                    else user.keycloak_username
                ),
                update_user=user.keycloak_username,
            )
            if previous and getattr(previous, "create_date", None):
                pathway.create_date = previous.create_date
            new_rows.append(pathway)

        submitted_pathway_ids = {
            row.pathway_id for row in data.pathways if row.pathway_id is not None
        }
        delete_rows: List[Pathway] = []
        if is_supplemental_edit:
            for previous in previous_pathway_entities:
                if previous.pathway_id in submitted_pathway_ids:
                    continue
                pathway = Pathway(
                    application_type_id=previous.application_type_id,
                    fuel_code_type_id=previous.fuel_code_type_id,
                    operating_data_from=previous.operating_data_from,
                    operating_data_to=previous.operating_data_to,
                    fuel_code_id=previous.fuel_code_id,
                    proposed_ci=previous.proposed_ci,
                    fuel_type_id=previous.fuel_type_id,
                    feedstock=previous.feedstock,
                    feedstock_region=previous.feedstock_region,
                    feedstock_transport_mode=previous.feedstock_transport_mode,
                    feedstock_transport_distance=previous.feedstock_transport_distance,
                    coproducts=previous.coproducts,
                    finished_fuel_transport_mode=previous.finished_fuel_transport_mode,
                    finished_fuel_transport_distance=previous.finished_fuel_transport_distance,
                    group_uuid=previous.group_uuid,
                    version=(previous.version or 0) + 1,
                    action_type=ActionTypeEnum.DELETE,
                    create_user=(
                        previous.create_user
                        if getattr(previous, "create_user", None)
                        else user.keycloak_username
                    ),
                    update_user=user.keycloak_username,
                )
                if getattr(previous, "create_date", None):
                    pathway.create_date = previous.create_date
                delete_rows.append(pathway)

        await self.repo.replace_pathways(
            ci_application.ci_application_id,
            [*new_rows, *delete_rows],
            preserve_history=is_supplemental_edit,
        )

        ci_application.pathway_description = data.pathway_description
        if is_supplemental_edit:
            ci_application.pathway_supplemental_edit_enabled = False
            ci_application.pathway_changes_requested_at = None
            ci_application.pathway_changes_requested_by = None
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)

        # `replace_pathways` mutates the DB via a raw DELETE + db.add() pair
        # without touching `ci_application.pathways`. The collection on the
        # session-cached parent is therefore stale; re-querying via the
        # identity map won't refresh an already-loaded relationship. Force a
        # refresh so the response reflects what's actually in the database.
        await self.repo.refresh_pathways(ci_application)
        if is_supplemental_edit:
            await self.repo.add_history(
                ci_application,
                snapshot={
                    "event": "supplemental_pathways_updated",
                    "changed_at": datetime.now(timezone.utc).isoformat(),
                    "changed_by": user.keycloak_username,
                    "before": previous_pathways,
                    "after": [
                        _pathway_input_snapshot(row, pathway, pathway.group_uuid)
                        for row, pathway in zip(data.pathways, new_rows)
                    ],
                },
            )

        ci = await self.repo.get_by_id(ci_application.ci_application_id)
        return await self._to_full_schema_with_user(ci)

    @service_handler
    async def request_pathway_changes(
        self,
        ci_application: CIApplication,
        user: UserProfile,
    ) -> CIApplicationSchema:
        if not _user_has_any_role(
            user,
            [RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR],
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only internal users can request pathway changes.",
            )
        self._require_submitted_workflow(ci_application)

        requested_at = datetime.now(timezone.utc)
        ci_application.pathway_supplemental_edit_enabled = True
        ci_application.pathway_changes_requested_at = requested_at
        ci_application.pathway_changes_requested_by = user.keycloak_username
        ci_application.update_user = user.keycloak_username
        ci_application.action_type = ActionTypeEnum.UPDATE
        await self.repo.update(ci_application)
        await self.repo.add_history(
            ci_application,
            snapshot={
                "event": "pathway_changes_requested",
                "changed_at": requested_at.isoformat(),
                "changed_by": user.keycloak_username,
            },
        )

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
                detail=("Missing required upload(s): " + ", ".join(missing) + "."),
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
        if (
            ci_application.ci_application_status.status
            != CIApplicationStatusEnum.Draft.value
        ):
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
        Government-side workflow actions transition a CI application
        between Submitted, Recommended, Completed, and Withdrawn according
        to role-specific rules. The optional inline comment
        remains ignored in favor of the shared internal_comments thread.
        """
        is_director = user_has_roles(user, [RoleEnum.DIRECTOR])
        is_analyst = user_has_roles(user, [RoleEnum.ANALYST])
        is_compliance_manager = user_has_roles(user, [RoleEnum.COMPLIANCE_MANAGER])

        if not (is_government or is_director or is_analyst or is_compliance_manager):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only government users can record a decision.",
            )

        current_status = ci_application.ci_application_status.status

        if data.status == CIApplicationStatusEnum.Completed:
            if not is_director:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only directors can approve CI applications.",
                )
            if current_status != CIApplicationStatusEnum.Recommended.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only Recommended applications can be approved.",
                )
        elif data.status == CIApplicationStatusEnum.Submitted:
            if current_status == CIApplicationStatusEnum.Withdrawn.value:
                pass
            elif current_status == CIApplicationStatusEnum.Recommended.value:
                if not is_director:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Only directors can return CI applications to analysts.",
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Only Recommended applications can be returned to analysts, "
                        "and only Withdrawn applications can be reactivated."
                    ),
                )
        elif data.status == CIApplicationStatusEnum.Withdrawn:
            if current_status not in {
                CIApplicationStatusEnum.Submitted.value,
                CIApplicationStatusEnum.Recommended.value,
            }:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "A decision can only be recorded on Submitted or Recommended applications."
                    ),
                )

        target_status = await self.repo.get_status_by_name(data.status.value)
        if not target_status:
            raise DataNotFoundException(
                f"Status '{data.status.value}' is not configured."
            )

        ci_application.status_id = target_status.ci_application_status_id
        if data.status == CIApplicationStatusEnum.Completed:
            ci_application.approval_user_id = user.user_profile_id
            ci_application.approval_date = datetime.now(timezone.utc)
        elif (
            data.status == CIApplicationStatusEnum.Submitted
            and current_status == CIApplicationStatusEnum.Recommended.value
        ):
            ci_application.recommendation_user_id = None
            ci_application.recommendation_date = None
            ci_application.approval_user_id = None
            ci_application.approval_date = None
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

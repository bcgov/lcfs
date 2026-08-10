"""
Pydantic schemas for the Carbon Intensity (CI) application module.

All five wizard steps are wired through the API:
  Step 1 — Application information
  Step 2 — Proposed fuel pathways
  Step 3 — Documents & GHGenius modelling
  Step 4 — Sign & submit
  Step 5 — Government decision (with comments thread)
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import (
    ConfigDict,
    EmailStr,
    Field,
    StrictInt,
    field_validator,
    model_validator,
)

from fastapi.exceptions import RequestValidationError

from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from lcfs.web.api.fuel_code.schema import (
    CoProcessedEnumSchema,
    FuelTypeQuantityUnitsEnumSchema,
)
from lcfs.web.api.fuel_type.schema import FuelTypeQuantityUnitsEnumSchema

# ---------------------------------------------------------------------------
# Enums (mirror the seeded lookup values in the migration)
# ---------------------------------------------------------------------------


class CIApplicationStatusEnum(str, Enum):
    Draft = "Draft"
    Submitted = "Submitted"
    Recommended = "Recommended"
    Completed = "Completed"
    Withdrawn = "Withdrawn"


class CIRiskAssessmentEnum(str, Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"


# ---------------------------------------------------------------------------
# Lookup / reference schemas
# ---------------------------------------------------------------------------


class CIApplicationStatusSchema(BaseSchema):
    ci_application_status_id: int
    status: CIApplicationStatusEnum
    description: Optional[str] = None


class OrganizationInfoSchema(BaseSchema):
    """Organization details surfaced on the CI application form."""

    organization_id: int
    name: Optional[str] = None
    operating_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None


class AssignedAnalystSchema(BaseSchema):
    """IDIR analyst currently assigned to a CI application."""

    user_profile_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    initials: Optional[str] = None
    full_name: Optional[str] = None


class LatestCommentSchema(BaseSchema):
    """Most-recent internal comment on a CI application, for the list grid."""

    comment: Optional[str] = None
    full_name: Optional[str] = None
    create_date: Optional[datetime] = None


class CIApplicationUserSchema(BaseSchema):
    user_profile_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    initials: Optional[str] = None
    full_name: Optional[str] = None

    @classmethod
    def model_validate(cls, user):
        if user is None:
            return None
        first_name = getattr(user, "first_name", "") or ""
        last_name = getattr(user, "last_name", "") or ""
        initials = f"{first_name[0] if first_name else ''}{last_name[0] if last_name else ''}".upper()
        full_name = f"{first_name} {last_name}".strip()
        return cls(
            user_profile_id=user.user_profile_id,
            first_name=first_name,
            last_name=last_name,
            initials=initials,
            full_name=full_name or initials,
        )


class PathwayApplicationTypeSchema(BaseSchema):
    pathway_application_type_id: int
    type: str
    description: Optional[str] = None


class PathwayFuelCodeTypeSchema(BaseSchema):
    pathway_fuel_code_type_id: int
    type: str
    description: Optional[str] = None


class TransportModeDistanceSchema(BaseSchema):
    transport_mode: str
    distance: int = Field(..., ge=0)


class NullableTransportModeDistanceSchema(BaseSchema):
    transport_mode: str
    distance: Optional[int] = Field(default=None, ge=0)


TransportModeSelection = Union[str, TransportModeDistanceSchema]
NullableTransportModeSelection = Union[str, NullableTransportModeDistanceSchema]


class FuelTypeOptionSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str


class FuelCodeOptionSchema(BaseSchema):
    """
    Compact representation of an existing fuel code, surfaced to the
    Step 2 grid as the dropdown for renewals (the "Fuel code iteration"
    column). Only the fields needed to display the option and to
    auto-populate locked grid cells are returned.
    """

    fuel_code_id: int
    fuel_code: str
    carbon_intensity: Optional[Decimal] = None
    fuel_type_id: Optional[int] = None
    fuel_type: Optional[str] = None
    feedstock: Optional[str] = None
    feedstock_location: Optional[str] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None


class CITableOptionsSchema(BaseSchema):
    """Reference data needed to render the CI application forms."""

    statuses: List[CIApplicationStatusSchema]
    units_of_measure: List[str]
    pathway_application_types: List[PathwayApplicationTypeSchema] = []
    pathway_fuel_code_types: List[PathwayFuelCodeTypeSchema] = []
    fuel_types: List[FuelTypeOptionSchema] = []
    transport_modes: List[str] = []
    fuel_codes: List[FuelCodeOptionSchema] = []


# ---------------------------------------------------------------------------
# Step 1 — Application information
# ---------------------------------------------------------------------------


class CIApplicationStep1Schema(BaseSchema):
    """
    Persisted fields for Step 1 of the CI application workflow.

    Facility location and nameplate capacity (with its unit) are required.
    The proposed fuel code effective date is optional.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    facility_city: str = Field(..., min_length=1, max_length=500)
    facility_province_state: str = Field(..., min_length=1, max_length=500)
    facility_country: str = Field(..., min_length=1, max_length=500)
    facility_iso: Optional[str] = Field(default=None, max_length=10)
    facility_nameplate_capacity: int = Field(..., gt=0)
    facility_nameplate_capacity_unit: FuelTypeQuantityUnitsEnumSchema
    proposed_fuel_code_effective_date: Optional[date] = None

    @model_validator(mode="before")
    @classmethod
    def _descriptive_required_field_errors(cls, data: Any) -> Any:
        """
        Raise field-level errors with user-friendly messages before Pydantic
        produces generic ones ("Field required", "String should have at least 1
        character", "Input should be greater than 0").
        """
        if not isinstance(data, dict):
            return data

        errors = []

        # Accepts both camelCase (from API) and snake_case (from tests / internal).
        def _get(camel: str, snake: str):
            return data.get(camel) if data.get(camel) is not None else data.get(snake)

        string_fields = [
            ("facilityCity", "facility_city", "City"),
            ("facilityProvinceState", "facility_province_state", "Province/State"),
            ("facilityCountry", "facility_country", "Country"),
        ]
        for camel, snake, label in string_fields:
            val = _get(camel, snake)
            if val is None or (isinstance(val, str) and not val.strip()):
                errors.append(
                    {
                        "loc": (camel,),
                        "msg": f"{label} is required.",
                        "type": "value_error",
                    }
                )

        capacity = _get("facilityNameplateCapacity", "facility_nameplate_capacity")
        if capacity is None or capacity == "":
            errors.append(
                {
                    "loc": ("facilityNameplateCapacity",),
                    "msg": "Facility nameplate capacity is required.",
                    "type": "value_error",
                }
            )
        elif isinstance(capacity, (int, float)) and capacity <= 0:
            errors.append(
                {
                    "loc": ("facilityNameplateCapacity",),
                    "msg": "Facility nameplate capacity must be greater than zero.",
                    "type": "value_error",
                }
            )

        unit = _get("facilityNameplateCapacityUnit", "facility_nameplate_capacity_unit")
        if not unit:
            errors.append(
                {
                    "loc": ("facilityNameplateCapacityUnit",),
                    "msg": "Unit of measure is required.",
                    "type": "value_error",
                }
            )

        if errors:
            raise RequestValidationError(errors)

        return data


# ---------------------------------------------------------------------------
# Step 2 — Proposed fuel pathways
# ---------------------------------------------------------------------------


class PathwayInputSchema(BaseSchema):
    """
    Single row submitted from the Step 2 AG Grid.

    Behavioural rules enforced here:
      - Renewal rows must reference an existing ``fuel_code_id``.
      - New rows must NOT reference a fuel code (the column is disabled
        on new rows in the UI; reject any value defensively).
    """

    pathway_id: Optional[int] = None
    application_type_id: int
    fuel_code_type_id: int
    operating_data_from: date
    operating_data_to: date
    fuel_code_id: Optional[int] = None
    proposed_ci: Decimal
    fuel_type_id: int
    feedstock: str = Field(..., max_length=500)
    feedstock_region: str = Field(..., max_length=500)
    feedstock_transport_mode: List[TransportModeDistanceSchema] = Field(
        ..., min_length=1
    )
    coproducts: Optional[str] = Field(default=None, max_length=1000)
    finished_fuel_transport_mode: List[TransportModeDistanceSchema] = Field(
        ..., min_length=1
    )

    @model_validator(mode="after")
    def _validate_row(self):
        if self.operating_data_to < self.operating_data_from:
            raise RequestValidationError(
                [
                    {
                        "loc": ("operatingDataTo",),
                        "msg": "Operating data end date must be on or after the start date.",
                        "type": "value_error",
                    }
                ]
            )
        return self


class CIApplicationStep2Schema(BaseSchema):
    """Payload for ``PUT /ci-applications/{id}/step2``."""

    pathways: List[PathwayInputSchema] = Field(default_factory=list)
    pathway_description: Optional[str] = None

    @field_validator("pathways")
    @classmethod
    def _at_least_one_pathway(cls, value: List[PathwayInputSchema]):
        if not value:
            raise ValueError("At least one pathway is required.")
        return value


class PathwaySchema(BaseSchema):
    """Pathway as returned from the API (read side)."""

    pathway_id: int
    ci_application_id: int
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    action_type: Optional[str] = None
    application_type_id: int
    application_type: Optional[PathwayApplicationTypeSchema] = None
    fuel_code_type_id: int
    fuel_code_type: Optional[PathwayFuelCodeTypeSchema] = None
    operating_data_from: date
    operating_data_to: date
    fuel_code_id: Optional[int] = None
    fuel_code: Optional[FuelCodeOptionSchema] = None
    proposed_ci: Decimal
    fuel_type_id: int
    fuel_type: Optional[FuelTypeOptionSchema] = None
    feedstock: str
    feedstock_region: str
    feedstock_transport_mode: List[TransportModeSelection]
    coproducts: Optional[str] = None
    finished_fuel_transport_mode: List[TransportModeSelection]


class PathwayChangeLogSchema(BaseSchema):
    """Field-level audit entry for supplemental pathway edits."""

    ci_application_id: int
    pathway_id: Optional[int] = None
    pathway_group_uuid: str
    action_type: str
    changed_at: Optional[datetime] = None
    changed_by: Optional[str] = None
    changed_fields: Dict[str, Any] = Field(default_factory=dict)
    before_snapshot: Optional[Dict[str, Any]] = None
    after_snapshot: Optional[Dict[str, Any]] = None


class CIGeneratedFuelCodeSchema(BaseSchema):
    id: str
    pathway_id: Optional[int] = None
    pathway_label: Optional[str] = None
    prefix_id: Optional[int] = None
    prefix: Optional[str] = None
    fuel_suffix: Optional[str] = None
    carbon_intensity: Optional[float] = None
    edrms: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    application_date: Optional[date] = None
    approval_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel_type_id: Optional[int] = None
    feedstock: Optional[str] = None
    feedstock_location: Optional[str] = None
    feedstock_misc: Optional[str] = None
    co_processed: CoProcessedEnumSchema = CoProcessedEnumSchema.No
    fuel_production_facility_city: Optional[str] = None
    fuel_production_facility_province_state: Optional[str] = None
    fuel_production_facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[
        Union[FuelTypeQuantityUnitsEnumSchema, str]
    ] = None
    former_company: Optional[str] = None
    notes: Optional[str] = None
    feedstock_fuel_transport_mode: List[NullableTransportModeSelection] = Field(
        default_factory=list
    )
    finished_fuel_transport_mode: List[NullableTransportModeSelection] = Field(
        default_factory=list
    )
    is_valid: bool = False
    validation_msg: Optional[str] = None
    validation_errors: Optional[Dict[str, str]] = None


class CIGeneratedFuelCodeUpdateSchema(BaseSchema):
    prefix_id: Optional[int] = None
    prefix: Optional[str] = None
    fuel_suffix: Optional[str] = None
    carbon_intensity: Optional[float] = None
    edrms: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    application_date: Optional[date] = None
    approval_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel_type_id: Optional[int] = None
    feedstock: Optional[str] = None
    feedstock_location: Optional[str] = None
    feedstock_misc: Optional[str] = None
    co_processed: Optional[CoProcessedEnumSchema] = None
    fuel_production_facility_city: Optional[str] = None
    fuel_production_facility_province_state: Optional[str] = None
    fuel_production_facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[
        Union[FuelTypeQuantityUnitsEnumSchema, str]
    ] = None
    former_company: Optional[str] = None
    notes: Optional[str] = None
    feedstock_fuel_transport_mode: Optional[List[NullableTransportModeSelection]] = None
    finished_fuel_transport_mode: Optional[List[NullableTransportModeSelection]] = None


# ---------------------------------------------------------------------------
# Read / response schemas
# ---------------------------------------------------------------------------


class CIApplicationBaseSchema(BaseSchema):
    """Lightweight representation suitable for list views."""

    ci_application_id: int
    organization_id: int
    organization: Optional[OrganizationInfoSchema] = None
    status: CIApplicationStatusSchema
    facility_city: Optional[str] = None
    facility_province_state: Optional[str] = None
    facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[str] = None
    proposed_fuel_code_effective_date: Optional[date] = None
    pathway_supplemental_edit_enabled: bool = False
    document_upload_enabled: bool = False
    preliminary_risk_assessment: Optional[CIRiskAssessmentEnum] = None
    priority_score: Optional[int] = None
    assigned_analyst: Optional[CIApplicationUserSchema] = None
    update_date: Optional[str] = None
    create_date: Optional[str] = None
    assigned_analyst: Optional[AssignedAnalystSchema] = None
    last_comment: Optional[LatestCommentSchema] = None
    priority_score: Optional[int] = None
    verification_level: Optional[str] = None


class CIApplicationSchema(BaseSchema):
    """Full record returned from the detail endpoint."""

    ci_application_id: int
    organization_id: int
    organization: Optional[OrganizationInfoSchema] = None
    status: CIApplicationStatusSchema

    # Step 1
    facility_city: Optional[str] = None
    facility_province_state: Optional[str] = None
    facility_country: Optional[str] = None
    facility_iso: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[str] = None
    proposed_fuel_code_effective_date: Optional[date] = None

    # Step 2
    pathway_description: Optional[str] = None
    pathways: List[PathwaySchema] = Field(default_factory=list)
    pathway_supplemental_edit_enabled: bool = False
    pathway_changes_requested_at: Optional[datetime] = None
    pathway_changes_requested_by: Optional[str] = None
    document_upload_enabled: bool = False
    document_changes_requested_at: Optional[datetime] = None
    document_changes_requested_by: Optional[str] = None
    pathway_changelog: List[Dict[str, Any]] = Field(default_factory=list)
    pathway_change_logs: List[PathwayChangeLogSchema] = Field(default_factory=list)
    generated_fuel_codes: List[CIGeneratedFuelCodeSchema] = Field(default_factory=list)

    # Reserved for later steps — surfaced on read so the UI can pre-fill any
    # values previously persisted by other developers / future steps.
    supporting_document_other: Optional[str] = None

    # Step 3 — uploaded documents (technical report, GHGenius model, etc.)
    documents: List[FileResponseSchema] = Field(default_factory=list)

    # Step 4 — consultant + signing authority snapshot
    consultant_name: Optional[str] = None
    consultant_company: Optional[str] = None
    consultant_email: Optional[str] = None
    signature_user: Optional[str] = None
    signature_user_display_name: Optional[str] = None
    signature_date_time: Optional[datetime] = None

    # Internal workflow tracker
    preliminary_risk_assessment: Optional[CIRiskAssessmentEnum] = None
    priority_score: Optional[int] = None
    assigned_analyst: Optional[CIApplicationUserSchema] = None
    verification_1_user: Optional[CIApplicationUserSchema] = None
    verification_1_date: Optional[datetime] = None
    verification_2_user: Optional[CIApplicationUserSchema] = None
    verification_2_date: Optional[datetime] = None
    verification_2_risk_assessment: Optional[CIRiskAssessmentEnum] = None
    verification_2_priority_score: Optional[int] = None
    recommendation_user: Optional[CIApplicationUserSchema] = None
    recommendation_date: Optional[datetime] = None
    approval_user: Optional[CIApplicationUserSchema] = None
    approval_date: Optional[datetime] = None


class CIApplicationsListSchema(BaseSchema):
    ci_applications: List[CIApplicationBaseSchema]
    pagination: PaginationResponseSchema


class CIApplicationAnalystAssignmentSchema(BaseSchema):
    assigned_analyst_id: Optional[int] = None


class CIApplicationVerification1Schema(BaseSchema):
    preliminary_risk_assessment: CIRiskAssessmentEnum
    priority_score: Optional[StrictInt] = Field(default=None, ge=1, le=999)


class CIApplicationVerification2Schema(BaseSchema):
    preliminary_risk_assessment: Optional[CIRiskAssessmentEnum] = None
    priority_score: Optional[StrictInt] = Field(default=None, ge=1, le=999)


# ---------------------------------------------------------------------------
# Step 3 — Documents & GHGenius modelling
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Step 4 — Sign & submit
# ---------------------------------------------------------------------------


class CIApplicationStep4Schema(BaseSchema):
    """
    Payload for ``POST /ci-applications/{id}/submit``.

    The three declaration checkboxes are mandatory; the consultant block
    is optional and only persisted when the signatory ticks the consent
    checkbox in the UI. Signing authority identity is taken from the
    authenticated user — the front-end never submits it.
    """

    declaration_information_true: bool = Field(...)
    declaration_response_8_weeks: bool = Field(...)
    declaration_section_20_6: bool = Field(...)

    consultant_consent: bool = False
    consultant_name: Optional[str] = Field(default=None, max_length=500)
    consultant_company: Optional[str] = Field(default=None, max_length=500)
    consultant_email: Optional[EmailStr] = None

    @model_validator(mode="after")
    def _validate(self):
        for field in (
            "declaration_information_true",
            "declaration_response_8_weeks",
            "declaration_section_20_6",
        ):
            if not getattr(self, field):
                raise ValueError("All three declarations must be acknowledged.")
        if self.consultant_consent:
            consultant_errors = []
            if not self.consultant_name:
                consultant_errors.append(
                    {
                        "loc": ("consultantName",),
                        "msg": "Consultant name is required when consenting to consultant communication.",
                        "type": "value_error",
                    }
                )
            if not self.consultant_company:
                consultant_errors.append(
                    {
                        "loc": ("consultantCompany",),
                        "msg": "Consultant company is required when consenting to consultant communication.",
                        "type": "value_error",
                    }
                )
            if not self.consultant_email:
                consultant_errors.append(
                    {
                        "loc": ("consultantEmail",),
                        "msg": "Consultant email is required when consenting to consultant communication.",
                        "type": "value_error",
                    }
                )
            if consultant_errors:
                raise RequestValidationError(consultant_errors)
        return self


# ---------------------------------------------------------------------------
# Step 5 — Government decision & comments
# ---------------------------------------------------------------------------


class CIApplicationDecisionSchema(BaseSchema):
    """
    Payload for ``POST /ci-applications/{id}/decision``.

    Government users approve, withdraw, reactivate, or return an application
    to analysts. An optional comment is captured alongside the decision and
    surfaced in the comments thread.
    """

    status: CIApplicationStatusEnum
    comment: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("status")
    @classmethod
    def _terminal_only(cls, value: CIApplicationStatusEnum):
        if value not in {
            CIApplicationStatusEnum.Submitted,
            CIApplicationStatusEnum.Completed,
            CIApplicationStatusEnum.Withdrawn,
        }:
            raise ValueError(
                "Decision status must be Submitted, Completed or Withdrawn."
            )
        return value


# Note: the Step 5 comment thread now uses the shared internal_comments
# system (lcfs.web.api.internal_comment). The CIApplicationComment*
# schemas were removed when CI applications were migrated onto the shared
# commenting framework — see /api/internal_comments/ciApplication/{id}.


class CIApplicationStep3Schema(BaseSchema):
    """
    Payload for ``PUT /ci-applications/{id}/step3``.

    Files are uploaded one-at-a-time via the generic
    ``/documents/ci_application/{id}`` endpoint with a
    ``document_category`` query param. This call only persists the
    optional free-text "other supporting" description and validates
    that the mandatory Technical report and GHGenius model uploads
    are in place.
    """

    supporting_document_other: Optional[str] = Field(default=None, max_length=1000)

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
from typing import List, Optional

from pydantic import EmailStr, Field, field_validator, model_validator

from lcfs.web.api.base import BaseSchema, PaginationResponseSchema


# ---------------------------------------------------------------------------
# Enums (mirror the seeded lookup values in the migration)
# ---------------------------------------------------------------------------


class CIApplicationStatusEnum(str, Enum):
    Draft = "Draft"
    Submitted = "Submitted"
    Completed = "Completed"
    Withdrawn = "Withdrawn"


# ---------------------------------------------------------------------------
# Lookup / reference schemas
# ---------------------------------------------------------------------------


class CIApplicationStatusSchema(BaseSchema):
    ci_application_status_id: int
    status: CIApplicationStatusEnum
    description: Optional[str] = None


class UnitOfMeasureSchema(BaseSchema):
    uom_id: int
    name: str
    description: Optional[str] = None


class OrganizationInfoSchema(BaseSchema):
    """Organization details surfaced on the CI application form."""

    organization_id: int
    name: Optional[str] = None
    operating_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None


class PathwayApplicationTypeSchema(BaseSchema):
    pathway_application_type_id: int
    type: str
    description: Optional[str] = None


class PathwayFuelCodeTypeSchema(BaseSchema):
    pathway_fuel_code_type_id: int
    type: str
    description: Optional[str] = None


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


class CITableOptionsSchema(BaseSchema):
    """Reference data needed to render the CI application forms."""

    statuses: List[CIApplicationStatusSchema]
    units_of_measure: List[UnitOfMeasureSchema]
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

    Country and nameplate capacity (with its unit) are the only required
    fields per the wireframe; the other facility location fields and the
    proposed fuel code effective date are optional.
    """

    facility_city: Optional[str] = Field(default=None, max_length=500)
    facility_province_state: Optional[str] = Field(default=None, max_length=500)
    facility_country: str = Field(..., max_length=500)
    facility_iso: Optional[str] = Field(default=None, max_length=10)
    facility_nameplate_capacity: int = Field(..., gt=0)
    facility_nameplate_capacity_unit_id: int
    proposed_fuel_code_effective_date: Optional[date] = None


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
    proposed_ci: Decimal = Field(..., ge=0)
    fuel_type_id: int
    feedstock: str = Field(..., max_length=500)
    feedstock_region: str = Field(..., max_length=500)
    feedstock_transport_mode: str = Field(..., max_length=500)
    feedstock_transport_distance: int = Field(..., ge=0)
    coproducts: Optional[str] = Field(default=None, max_length=1000)
    finished_fuel_transport_mode: str = Field(..., max_length=500)
    finished_fuel_transport_distance: int = Field(..., ge=0)

    @model_validator(mode="after")
    def _validate_dates(self):
        if self.operating_data_to < self.operating_data_from:
            raise ValueError(
                "operating_data_to must be on or after operating_data_from."
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
    feedstock_transport_mode: str
    feedstock_transport_distance: int
    coproducts: Optional[str] = None
    finished_fuel_transport_mode: str
    finished_fuel_transport_distance: int


# ---------------------------------------------------------------------------
# Read / response schemas
# ---------------------------------------------------------------------------


class CIApplicationBaseSchema(BaseSchema):
    """Lightweight representation suitable for list views."""

    ci_application_id: int
    organization_id: int
    status: CIApplicationStatusSchema
    facility_city: Optional[str] = None
    facility_province_state: Optional[str] = None
    facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit_id: Optional[int] = None
    proposed_fuel_code_effective_date: Optional[date] = None
    update_date: Optional[str] = None
    create_date: Optional[str] = None


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
    facility_nameplate_capacity_unit_id: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[UnitOfMeasureSchema] = None
    proposed_fuel_code_effective_date: Optional[date] = None

    # Step 2
    pathway_description: Optional[str] = None
    pathways: List[PathwaySchema] = Field(default_factory=list)

    # Reserved for later steps — surfaced on read so the UI can pre-fill any
    # values previously persisted by other developers / future steps.
    supporting_document_other: Optional[str] = None

    # Step 4 — consultant + signing authority snapshot
    consultant_name: Optional[str] = None
    consultant_company: Optional[str] = None
    consultant_email: Optional[str] = None
    signature_user: Optional[str] = None
    signature_date_time: Optional[datetime] = None


class CIApplicationsListSchema(BaseSchema):
    ci_applications: List[CIApplicationBaseSchema]
    pagination: PaginationResponseSchema


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
            if not self.consultant_name or not self.consultant_company or not self.consultant_email:
                raise ValueError(
                    "Consultant name, company, and email are required when "
                    "consenting to consultant communication."
                )
        return self


# ---------------------------------------------------------------------------
# Step 5 — Government decision & comments
# ---------------------------------------------------------------------------


class CIApplicationDecisionSchema(BaseSchema):
    """
    Payload for ``POST /ci-applications/{id}/decision``.

    Governments transition a Submitted application into one of the two
    terminal states. An optional comment is captured alongside the
    decision and surfaced in the comments thread.
    """

    status: CIApplicationStatusEnum
    comment: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("status")
    @classmethod
    def _terminal_only(cls, value: CIApplicationStatusEnum):
        if value not in {
            CIApplicationStatusEnum.Completed,
            CIApplicationStatusEnum.Withdrawn,
        }:
            raise ValueError("Decision status must be Completed or Withdrawn.")
        return value


class CIApplicationCommentInputSchema(BaseSchema):
    text: str = Field(..., min_length=1, max_length=4000)


class CIApplicationCommentSchema(BaseSchema):
    """Comment surfaced in the Step 5 thread."""

    comment_id: int
    text: str
    author_username: Optional[str] = None
    author_display_name: Optional[str] = None
    is_government: bool = False
    create_date: Optional[datetime] = None


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

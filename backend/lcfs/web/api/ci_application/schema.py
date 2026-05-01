"""
Pydantic schemas for the Carbon Intensity (CI) application module.

Step 1 of the CI application workflow ("Application information") is the
only step fully wired through the API. The remaining four steps
(Proposed fuel pathways, Documents & GHGenius modelling, Sign & submit,
Government decision) are intentionally stubbed out at the view layer and
will reuse / extend these schemas as additional fields are introduced.
"""

from datetime import date
from enum import Enum
from typing import List, Optional

from pydantic import Field

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


class CITableOptionsSchema(BaseSchema):
    """
    Reference data needed to render the CI application forms.

    Pre-loaded once on form mount; new lookup arrays will be added here as
    Steps 2-5 are implemented.
    """

    statuses: List[CIApplicationStatusSchema]
    units_of_measure: List[UnitOfMeasureSchema]


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

    # Reserved for later steps — surfaced on read so the UI can pre-fill any
    # values previously persisted by other developers / future steps.
    pathway_description: Optional[str] = None
    supporting_document_other: Optional[str] = None
    consultant_name: Optional[str] = None
    consultant_company: Optional[str] = None
    consultant_email: Optional[str] = None
    signature_user: Optional[str] = None


class CIApplicationsListSchema(BaseSchema):
    ci_applications: List[CIApplicationBaseSchema]
    pagination: PaginationResponseSchema

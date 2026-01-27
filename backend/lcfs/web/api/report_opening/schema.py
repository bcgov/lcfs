from typing import List

from pydantic import Field

from lcfs.db.models.compliance.ReportOpening import (
    ReportOpening,
    SupplementalReportAccessRole,
)
from lcfs.web.api.base import BaseSchema


class ReportOpeningSchema(BaseSchema):
    report_opening_id: int
    compliance_year: int
    compliance_reporting_enabled: bool
    early_issuance_enabled: bool
    supplemental_report_role: SupplementalReportAccessRole


class ReportOpeningUpdateSchema(BaseSchema):
    compliance_year: int
    compliance_reporting_enabled: bool


class ReportOpeningUpdateRequest(BaseSchema):
    report_openings: List[ReportOpeningUpdateSchema] = Field(
        default_factory=list, alias="reportOpenings"
    )


def model_to_schema(record: ReportOpening) -> ReportOpeningSchema:
    return ReportOpeningSchema.model_validate(record)

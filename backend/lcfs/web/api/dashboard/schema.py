from lcfs.web.api.base import BaseSchema
from pydantic import Field


class DirectorReviewCountsSchema(BaseSchema):
    transfers: int
    compliance_reports: int
    initiative_agreements: int
    admin_adjustments: int
    fuel_codes: int


class TransactionCountsSchema(BaseSchema):
    transfers: int
    initiative_agreements: int
    admin_adjustments: int


class OrganizarionTransactionCountsSchema(BaseSchema):
    transfers: int


class OrgComplianceReportCountsSchema(BaseSchema):
    in_progress: int
    awaiting_gov_review: int


class ComplianceReportCountsSchema(BaseSchema):
    pending_reviews: int = Field(default=0)


class FuelCodeCountsSchema(BaseSchema):
    draft_fuel_codes: int = Field(default=0)

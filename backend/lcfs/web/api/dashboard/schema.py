from lcfs.web.api.base import BaseSchema

class DirectorReviewCountsSchema(BaseSchema):
    transfers: int
    compliance_reports: int
    initiative_agreements: int
    admin_adjustments: int
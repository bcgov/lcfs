from lcfs.web.api.base import BaseSchema
from typing import Optional
from datetime import date

class InitiativeAgreementStatusSchema(BaseSchema):
    initiative_agreement_status_id: int
    status: str

    class Config:
        from_attributes = True

class InitiativeAgreementSchema(BaseSchema):
    initiative_agreement_id: int
    compliance_units: int
    current_status: InitiativeAgreementStatusSchema
    transaction_effective_date: date
    to_organization_id: int
    gov_comment: Optional[str] = None

    class Config:
        from_attributes = True

class InitiativeAgreementCreateSchema(BaseSchema):
    compliance_units: int
    current_status: str
    transaction_effective_date: date
    to_organization_id: int
    gov_comment: Optional[str] = None

    class Config:
        from_attributes = True

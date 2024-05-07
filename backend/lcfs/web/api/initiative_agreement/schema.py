# initiative_agreement/schema.py
from lcfs.web.api.base import BaseSchema
from typing import Optional
from datetime import date

class InitiativeAgreementSchema(BaseSchema):
    initiative_agreement_id: int
    compliance_units: int
    transaction_effective_date: date
    current_status: str
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

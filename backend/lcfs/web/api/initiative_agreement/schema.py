from lcfs.web.api.base import BaseSchema
from typing import Optional, List
from datetime import date, datetime
from pydantic import field_validator


class InitiativeAgreementStatusSchema(BaseSchema):
    initiative_agreement_status_id: int
    status: str

    class Config:
        from_attributes = True


class HistoryUserSchema(BaseSchema):
    first_name: str
    last_name: str

    class Config:
        from_attributes = True


class OrganizationSchema(BaseSchema):
    organization_id: int
    name: str

    class Config:
        from_attributes = True


class InitiativeAgreementHistorySchema(BaseSchema):
    create_date: datetime
    initiative_agreement_status: InitiativeAgreementStatusSchema
    user_profile: HistoryUserSchema

    class Config:
        from_attributes = True


class InitiativeAgreementBaseSchema(BaseSchema):
    compliance_units: int
    current_status: InitiativeAgreementStatusSchema
    transaction_effective_date: Optional[date] = None
    to_organization_id: int
    gov_comment: Optional[str] = None
    internal_comment: Optional[str] = None

    @field_validator("compliance_units")
    def validate_compliance_units(cls, v):
        if v <= 0:
            raise ValueError("compliance_units must be positive")
        return v

    class Config:
        from_attributes = True


class InitiativeAgreementSchema(InitiativeAgreementBaseSchema):
    initiative_agreement_id: int
    to_organization: OrganizationSchema
    history: Optional[List[InitiativeAgreementHistorySchema]]
    returned: Optional[bool] = False
    create_date: datetime


class InitiativeAgreementCreateSchema(InitiativeAgreementBaseSchema):
    current_status: str


class InitiativeAgreementUpdateSchema(InitiativeAgreementBaseSchema):
    initiative_agreement_id: int
    current_status: str

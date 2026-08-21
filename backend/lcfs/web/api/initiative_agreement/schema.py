from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
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
    display_name: Optional[str] = None

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


class CreateInitiativeAgreementHistorySchema(BaseSchema):
    initiative_agreement_id: int
    initiative_agreement_status_id: int
    user_profile_id: int
    display_name: str


# ---------------------------------------------------------------------------
# Agreement management (Initiative Agreements module)
# ---------------------------------------------------------------------------


class DesignatedActionStatusSchema(BaseSchema):
    designated_action_status_id: int
    status: str

    class Config:
        from_attributes = True


class AssignedAnalystSchema(BaseSchema):
    user_profile_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        from_attributes = True


class DesignatedActionSchema(BaseSchema):
    designated_action_id: int
    action_number: int
    name: str
    description: Optional[str] = None
    specified_date: Optional[date] = None
    completed_date: Optional[date] = None
    determination_date: Optional[date] = None
    credit_allocation: int
    determination: Optional[str] = None
    current_status: DesignatedActionStatusSchema
    assigned_analyst: Optional[AssignedAnalystSchema] = None
    transaction_id: Optional[int] = None

    class Config:
        from_attributes = True


class InitiativeAgreementLifecycleStatusSchema(BaseSchema):
    initiative_agreement_lifecycle_status_id: int
    status: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class LastCommentSchema(BaseSchema):
    """
    Newest comment visible to the caller, for the grid's avatar column.

    ``comment`` is plain text, not the stored rich text: it is rendered as a
    tooltip, and the grid has no need for markup.
    """

    full_name: str
    comment: str
    create_date: datetime

    class Config:
        from_attributes = True


class InitiativeAgreementListItemSchema(BaseSchema):
    initiative_agreement_id: int
    ia_code: Optional[str] = None
    agreement_type: str
    title: Optional[str] = None
    contact_name: Optional[str] = None
    entry_date: Optional[date] = None
    agreement_start_date: Optional[date] = None
    agreement_end_date: Optional[date] = None
    total_credits_allocated: int
    total_credits_issued: int
    update_date: datetime
    lifecycle_status: Optional[InitiativeAgreementLifecycleStatusSchema] = None
    organization: OrganizationSchema
    last_comment: Optional[LastCommentSchema] = None

    class Config:
        from_attributes = True


class InitiativeAgreementsListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    initiative_agreements: List[InitiativeAgreementListItemSchema]


class InitiativeAgreementProfileSchema(InitiativeAgreementListItemSchema):
    project_description: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    create_date: datetime
    designated_actions: List[DesignatedActionSchema] = []

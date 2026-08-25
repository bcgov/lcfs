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


class AgreementOrganizationAddressSchema(BaseSchema):
    """
    Every field is optional: organization address rows carry gaps, and the
    agreement detail card must render what exists rather than 500.
    """

    name: Optional[str] = None
    street_address: Optional[str] = None
    address_other: Optional[str] = None
    city: Optional[str] = None
    province_state: Optional[str] = None
    country: Optional[str] = None
    postalCode_zipCode: Optional[str] = None

    class Config:
        from_attributes = True


class AgreementOrganizationSchema(BaseSchema):
    """
    Organization detail for the agreement header card. Kept separate from the
    lean OrganizationSchema used by the grid and by the legacy award flow,
    whose queries do not eager-load the address.
    """

    organization_id: int
    name: str
    organization_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    org_address: Optional[AgreementOrganizationAddressSchema] = None

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
    # Drives the workflow progress stepper on the action detail page.
    display_order: Optional[int] = None

    class Config:
        from_attributes = True


class AssignedAnalystSchema(BaseSchema):
    user_profile_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None

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


class DesignatedActionSchema(BaseSchema):
    designated_action_id: int
    action_number: int
    name: str
    description: Optional[str] = None
    specified_date: Optional[date] = None
    completed_date: Optional[date] = None
    determination_date: Optional[date] = None
    credit_allocation: int
    recommended_credits: Optional[int] = None
    determination: Optional[str] = None
    current_status: DesignatedActionStatusSchema
    assigned_analyst: Optional[AssignedAnalystSchema] = None
    transaction_id: Optional[int] = None
    update_date: Optional[datetime] = None
    # Newest comment visible to the caller; populated by the grid endpoint
    # only. DA comments arrive with #4900 — the column exists first.
    last_comment: Optional[LastCommentSchema] = None

    class Config:
        from_attributes = True


class EvidenceRequirementSchema(BaseSchema):
    evidence_requirement_id: int
    designated_action_id: int
    requirement_number: int
    description: str
    evidence_type: Optional[str] = None
    is_active: bool = True
    analyst_review: Optional[str] = None
    review_outcome: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_by: Optional[AssignedAnalystSchema] = None
    reviewed_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class EvidenceRequirementCreateSchema(BaseSchema):
    description: str
    evidence_type: Optional[str] = None
    requirement_number: Optional[int] = None


class EvidenceRequirementUpdateSchema(BaseSchema):
    description: Optional[str] = None
    evidence_type: Optional[str] = None
    requirement_number: Optional[int] = None
    analyst_review: Optional[str] = None
    review_notes: Optional[str] = None
    # Absent leaves the outcome untouched; explicit null clears it back to
    # unreviewed, which is how the UI unchecks both boxes.
    review_outcome: Optional[str] = None
    clear_review_outcome: bool = False


class DesignatedActionWorkflowSchema(BaseSchema):
    action: str
    # The dedicated text area behind Request additional information, and the
    # reason a manager or director returns or rejects (#4898).
    comment: Optional[str] = None
    recommended_credits: Optional[int] = None


class RecommendedCreditsSchema(BaseSchema):
    recommended_credits: Optional[int] = None


class DesignatedActionHistorySchema(BaseSchema):
    designated_action_history_id: int
    event: str
    display_name: Optional[str] = None
    create_date: Optional[datetime] = None
    status: Optional[DesignatedActionStatusSchema] = None
    snapshot: Optional[dict] = None

    class Config:
        from_attributes = True


class DesignatedActionProfileSchema(DesignatedActionSchema):
    initiative_agreement_id: int
    ia_code: Optional[str] = None
    # Which workflow actions this caller may take right now. Derived from
    # the transition table so the page and the API cannot disagree.
    available_actions: List[str] = []
    # Current-version sibling ids in action_number order, for the detail
    # page's previous/next navigation.
    sibling_action_ids: List[int] = []


class DesignatedActionsListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    designated_actions: List[DesignatedActionSchema]


class AnalystAssignmentSchema(BaseSchema):
    assigned_analyst_id: Optional[int] = None


class IAAnalystSchema(BaseSchema):
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
        initials = f"{first_name[:1]}{last_name[:1]}".upper() or None
        full_name = " ".join(p for p in (first_name, last_name) if p) or None
        return cls(
            user_profile_id=user.user_profile_id,
            first_name=first_name or None,
            last_name=last_name or None,
            initials=initials,
            full_name=full_name,
        )


class InitiativeAgreementLifecycleStatusSchema(BaseSchema):
    initiative_agreement_lifecycle_status_id: int
    status: str
    description: Optional[str] = None

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
    # Overrides the grid's lean organization payload with the detail card's.
    organization: AgreementOrganizationSchema
    project_description: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    create_date: datetime
    designated_actions: List[DesignatedActionSchema] = []

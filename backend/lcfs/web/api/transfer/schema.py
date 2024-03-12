from lcfs.web.api.base import BaseSchema
from typing import Optional
from datetime import date
from enum import Enum


class TransactionTypeEnum(str, Enum):
    administrative_adjustment = "Administrative Adjustment"
    initiative_agreement = "Initiative Agreement"
    assessment = "Assessment"
    transfer = "Transfer"


class TransferStatusEnum(str, Enum):
    Draft = "Draft"
    Deleted = "Deleted"
    Sent = "Sent"
    Submitted = "Submitted"
    Recommended = "Recommended"
    Recorded = "Recorded"
    Refused = "Refused"
    Declined = "Declined"
    Rescinded = "Rescinded"
    
    @classmethod
    def get_index(cls, value):
        return list(cls).index(value) + 1


class TransferStatusSchema(BaseSchema):
    transfer_status_id: int
    status: str

    class Config:
        from_attributes = True


class TransferCategorySchema(BaseSchema):
    category: str

    class Config:
        from_attributes = True


class TransferOrganizationSchema(BaseSchema):
    organization_id: int
    name: str

    class Config:
        from_attributes = True


class TransferCommentSchema(BaseSchema):
    comment_id: int
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class TransferRecommendationStatusSchema(BaseSchema):
    transfer_recommendation_status_id: int
    status: str

    class Config:
        from_attributes = True


class TransferSchema(BaseSchema):
    transfer_id: int
    from_organization: TransferOrganizationSchema
    to_organization: TransferOrganizationSchema
    agreement_date: date
    quantity: int
    price_per_unit: int
    signing_authority_declaration: bool
    comments: Optional[TransferCommentSchema] = None
    current_status: TransferStatusSchema
    transfer_category: TransferCategorySchema
    recommendation_status: Optional[TransferRecommendationStatusSchema] = None

    class Config:
        extra = 'ignore'
        from_attributes = True


class TransferCreate(BaseSchema):
    from_organization_id: int
    to_organization_id: int
    agreement_date: str
    quantity: int
    price_per_unit: int
    signing_authority_declaration: bool
    comments: Optional[str] = None

    class Config:
        from_attributes = True


class TransferUpdate(BaseSchema):
    current_status_id: int
    comments: Optional[str] = None
    recommendation_status_id: Optional[int] = None


class TransferHistory(BaseSchema):
    transfer_history_id: int
    transfer_id: int

    class Config:
        from_attributes = True

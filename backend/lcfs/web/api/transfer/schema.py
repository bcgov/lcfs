from lcfs.web.api.base import BaseSchema
from typing import Optional, List
from datetime import date, datetime
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


class TransferRecommendationEnum(str, Enum):
    Record = 'Record'
    Refuse = 'Refuse'


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


class TransferHistoryUserSchema(BaseSchema):
    first_name: str
    last_name: str
    organization: Optional[TransferOrganizationSchema] = None

    class Config:
        from_attributes = True


class TransferHistorySchema(BaseSchema):
    create_date: datetime
    transfer_status: TransferStatusSchema
    user_profile: TransferHistoryUserSchema

    class Config:
        from_attributes = True


class TransferCommentSchema(BaseSchema):
    name: str
    comment: Optional[str] = None

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
    comments: Optional[List[TransferCommentSchema]] = None
    from_org_comment: Optional[str] = None
    to_org_comment: Optional[str] = None
    gov_comment: Optional[str] = None
    current_status: TransferStatusSchema
    transfer_category: TransferCategorySchema
    transfer_history: Optional[List[TransferHistorySchema]]
    recommendation: Optional[TransferRecommendationEnum] = None

    class Config:
        extra = 'ignore'
        from_attributes = True


class TransferCreateSchema(BaseSchema):
    transfer_id: Optional[int] = None
    from_organization_id: int
    to_organization_id: int
    from_transaction_id:  Optional[int] = None
    to_transaction_id: Optional[int] = None
    agreement_date: Optional[date] = None
    quantity: Optional[int] = None
    price_per_unit: Optional[int] = None
    signing_authority_declaration: Optional[bool] = None
    from_org_comment: Optional[str] = None
    to_org_comment: Optional[str] = None
    gov_comment: Optional[str] = None
    transfer_category_id: Optional[int] = None
    current_status_id: Optional[int] = None
    current_status: Optional[str] = None
    recommendation: Optional[TransferRecommendationEnum] = None

    class Config:
        from_attributes = True


class TransferUpdate(BaseSchema):
    current_status_id: int
    comments: Optional[str] = None
    recommendation: Optional[str] = None


class TransferHistory(BaseSchema):
    transfer_history_id: int
    transfer_id: int

    class Config:
        from_attributes = True

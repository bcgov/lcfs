from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.web.api.base import BaseSchema
from typing import Optional, List
from datetime import date, datetime
from enum import Enum
from pydantic import ConfigDict, Field


class TransferRecommendationEnumSchema(str, Enum):
    Record = "Record"
    Refuse = "Refuse"


class TransferStatusSchema(BaseSchema):
    transfer_status_id: int
    status: str


class TransferCategorySchema(BaseSchema):
    transfer_category_id: int
    category: str


class TransferOrganizationSchema(BaseSchema):
    organization_id: int
    name: str


class TransferHistoryUserSchema(BaseSchema):
    first_name: str
    last_name: str
    organization: Optional[TransferOrganizationSchema] = None


class TransferHistorySchema(BaseSchema):
    create_date: datetime
    transfer_status: TransferStatusSchema
    user_profile: TransferHistoryUserSchema


class TransferCommentSchema(BaseSchema):
    name: str
    comment: Optional[str] = None


class TransferSchema(BaseSchema):
    transfer_id: int
    from_organization: TransferOrganizationSchema
    to_organization: TransferOrganizationSchema
    agreement_date: Optional[date] = None
    quantity: int
    price_per_unit: float
    comments: Optional[List[TransferCommentSchema]] = None
    from_org_comment: Optional[str] = None
    to_org_comment: Optional[str] = None
    gov_comment: Optional[str] = None
    current_status: TransferStatusSchema
    transfer_category: Optional[TransferCategorySchema] = None
    transfer_history: Optional[List[TransferHistorySchema]] = None
    recommendation: Optional[TransferRecommendationEnumSchema] = None
    model_config = ConfigDict(extra="ignore", from_attributes=True)


class TransferCreateSchema(BaseSchema):
    transfer_id: Optional[int] = None
    from_organization_id: int
    to_organization_id: int
    from_transaction_id: Optional[int] = None
    to_transaction_id: Optional[int] = None
    agreement_date: Optional[date] = None
    quantity: Optional[int] = None
    price_per_unit: Optional[float] = None
    from_org_comment: Optional[str] = None
    to_org_comment: Optional[str] = None
    gov_comment: Optional[str] = None
    transfer_category_id: Optional[int] = None
    current_status_id: Optional[int] = None
    current_status: Optional[TransferStatusEnum] = None
    recommendation: Optional[TransferRecommendationEnumSchema] = None


class TransferUpdate(BaseSchema):
    current_status_id: int
    comments: Optional[str] = None
    recommendation: Optional[str] = None


# class TransferHistory(BaseSchema):
#     transfer_history_id: int
#     transfer_id: int

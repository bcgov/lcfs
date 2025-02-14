from typing import Optional, List
from datetime import date, datetime
from enum import Enum
from pydantic import ConfigDict

from lcfs.web.api.base import BaseSchema
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum


class TransferRecommendationEnumSchema(str, Enum):
    Record = "Record"
    Refuse = "Refuse"


class TransferCommentSourceEnumSchema(str, Enum):
    FROM_ORG = "FROM_ORG"
    TO_ORG = "TO_ORG"
    GOVERNMENT = "GOVERNMENT"


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
    display_name: Optional[str] = None


class TransferCommentSchema(BaseSchema):
    comment: Optional[str] = None
    comment_source: TransferCommentSourceEnumSchema
    created_by: Optional[str] = None
    created_by_org: Optional[str] = None
    create_date: Optional[datetime] = None


class TransferSchema(BaseSchema):
    transfer_id: int
    from_organization: TransferOrganizationSchema
    to_organization: TransferOrganizationSchema
    agreement_date: Optional[date] = None
    quantity: int
    price_per_unit: float
    comments: Optional[List[TransferCommentSchema]] = None
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


class CreateTransferHistorySchema(BaseSchema):
    transfer_history_id: Optional[int] = None
    transfer_id: int
    transfer_status_id: int
    user_profile_id: int
    display_name: str

from typing import Optional, List

from pydantic import ConfigDict, Field
from lcfs.web.api.base import BaseSchema
from datetime import datetime
from enum import Enum
from typing import List, Optional
from lcfs.web.api.organizations.schema import OrganizationSummaryResponseSchema
from lcfs.web.api.base import PaginationResponseSchema


# --------------------------------------
# Base Configuration
# --------------------------------------
class BaseConfig:
    from_attributes = True


# --------------------------------------
# Transaction Status
# --------------------------------------


class TransactionStatusEnum(str, Enum):
    DRAFT = "Draft"
    RECOMMENDED = "Recommended"
    SENT = "Sent"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    RECORDED = "Recorded"
    REFUSED = "Refused"
    DELETED = "Deleted"
    DECLINED = "Declined"
    RESCINDED = "Rescinded"


class TransactionStatusBase(BaseSchema):
    status: TransactionStatusEnum
    description: Optional[str] = None


class TransactionStatusSchema(TransactionStatusBase):
    pass


class TransactionActionEnum(str, Enum):
    Adjustment = "Adjustment"
    Reserved = "Reserved"
    Released = "Released"


class TransactionCreateSchema(BaseSchema):
    transaction_action: TransactionActionEnum
    compliance_units: int
    organization_id: int


class TransactionBaseSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    compliance_units: int
    organization_id: int
    transaction_action: TransactionActionEnum

    organization: Optional[OrganizationSummaryResponseSchema] = None


class TransactionViewSchema(BaseSchema):
    transaction_id: int
    transaction_type: str
    from_organization: Optional[str] = None
    to_organization: str
    quantity: int = Field(
        ..., gt=0, description="Quantity supplied must be greater than 0"
    )
    price_per_unit: Optional[float] = None
    status: str
    create_date: datetime
    update_date: datetime


class TransactionListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    transactions: List[TransactionViewSchema]

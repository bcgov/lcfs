from typing import Optional, List

from pydantic import ConfigDict
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

    class Config(BaseConfig):
        pass

class TransactionStatusSchema(TransactionStatusBase):
    pass


class TransactionTypeEnum(str, Enum):
    adjustment = "Adjustment"
    reserve = "Reserve"
    release = "Release"


class TransactionTypeSchema(BaseSchema):
    transaction_typ_id: int
    type: TransactionTypeEnum


class TransactionBaseSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    compliance_units: int
    transaction_type_id: int
    organization_id: int

    organization: Optional[OrganizationSummaryResponseSchema]
    transaction_type: TransactionTypeSchema


class TransactionViewSchema(BaseSchema):
    transaction_id: int
    transaction_type: str
    from_organization: Optional[str]
    to_organization: str
    quantity: int
    price_per_unit: Optional[float]
    status: str
    create_date: datetime
    update_date: datetime

    class Config(BaseConfig):
        pass

class TransactionListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    transactions: List[TransactionViewSchema]

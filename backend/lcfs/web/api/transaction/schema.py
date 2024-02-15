from typing import Optional, List

from pydantic import BaseModel, ConfigDict
from enum import Enum
from typing import List, Optional, Generic, TypeVar
from lcfs.web.api.organization.schema import OrganizationSummaryResponseSchema
from lcfs.web.api.base import PaginationResponseSchema


class TransactionTypeEnum(str, Enum):
    administrative_adjustment = "Administrative Adjustment"
    initiative_agreement = "Initiative Agreement"
    assessment = "Assessment"
    transfer = "Transfer"


class TransactionTypeSchema(BaseModel):
    transaction_typ_id: int
    type: TransactionTypeEnum


class TransactionBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    compliance_units: int
    transaction_type_id: int
    organization_id: int

    organization: Optional[OrganizationSummaryResponseSchema]
    transaction_type: TransactionTypeSchema


class Transactions(BaseModel):
    pagination: PaginationResponseSchema
    transactions: List[TransactionBase]


class CombinedTransaction(BaseModel):
    type: str  # 'Issuance' or 'Transfer'
    id: int
    create_date: str  # or datetime, depending on how we format it in the service

# Generic type for data
T = TypeVar("T")

class TransactionPaginationResponse(Generic[T], BaseModel):
    pagination: PaginationResponseSchema
    transactions: List[T]
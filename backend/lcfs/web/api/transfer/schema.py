from pydantic import BaseModel, constr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class TransactionTypeEnum(str, Enum):
    administrative_adjustment = "Administrative Adjustment"
    initiative_agreement = "Initiative Agreement"
    assessment = "Assessment"
    transfer = "Transfer"

class TransferStatusEnum(str, Enum):
    draft = "Draft"
    deleted = "Deleted"
    sent = "Sent"
    submitted = "Submitted"
    recommended = "Recommended"
    recorded = "Recorded"
    refused = "Refused"
    declined = "Declined"
    rescinded = "Rescinded"

class TransferBase(BaseModel):
    from_organization: int
    to_organization: int
    transaction_id: int
    transaction_effective_date: Optional[datetime]
    comment_id: Optional[int]
    transfer_status: int
    transfer_category: int

class Transfer(TransferBase):
    transfer_id: int

    class Config:
        orm_mode = True


class TransferHistory(TransferBase):
    transfer_history_id: int
    transfer_id: int

    class Config:
        orm_mode = True


class IssuanceSchema(BaseModel):
    issuance_id: int
    compliance_units: int
    organization_id: int
    transaction_effective_date: datetime
    transaction_id: int
    comment_id: Optional[int]

class IssuanceHistorySchema(BaseModel):
    issuance_history_id: int
    compliance_units: int
    issuance_id: int
    organization_id: int
    transaction_id: Optional[int]
    transaction_effective_date: Optional[datetime]
    comment_id: Optional[int]


class TransactionSchema(BaseModel):
    transaction_id: int
    compliance_units: int
    issuance_id: int
    transfer_id: int
    transaction_type: TransactionTypeEnum
    organization: int

class TransactionTypeSchema(BaseModel):
    transaction_typ_id: int
    type: TransactionTypeEnum

class TransferStatusSchema(BaseModel):
    transaction_status_id: int
    status: TransferStatusEnum

class CommentSchema(BaseModel):
    comment_id: int
    comment: str

class CategorySchema(BaseModel):
    category_id: int
    category: str
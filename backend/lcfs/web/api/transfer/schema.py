from pydantic import BaseModel
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


class TransferStatusSchema(BaseModel):
    transfer_status_id: int
    status: str

    class Config:
        from_attributes = True


class TransferCategorySchema(BaseModel):
    category: str

    class Config:
        from_attributes = True


class TransferOrganizationSchema(BaseModel):
    organization_id: int
    name: str

    class Config:
        from_attributes = True


class TransferCommentSchema(BaseModel):
    comment_id: int
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class TransferSchema(BaseModel):
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

    class Config:
        extra = 'ignore'
        from_attributes = True


class TransferCreate(BaseModel):
    from_organization_id: int
    to_organization_id: int
    agreement_date: str
    quantity: int
    price_per_unit: int
    signing_authority_declaration: bool
    comments: Optional[str] = None

    class Config:
        from_attributes = True


class TransferUpdate(BaseModel):
    current_status_id: int
    comments: Optional[str] = None


class TransferHistory(BaseModel):
    transfer_history_id: int
    transfer_id: int

    class Config:
        from_attributes = True

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class IssuanceSchema(BaseModel):
    issuance_id: int
    compliance_units: int
    transaction_effective_date: datetime
    organization_id: int
    transaction_id: Optional[int] = None
    comment_id: Optional[int] = None

    class Config:
        from_attributes = True

class IssuanceCreate(BaseModel):
    compliance_units: int
    transaction_effective_date: datetime
    organization_id: int
    transaction_id: Optional[int] = None
    comment: Optional[str] = None

class OrganizationSchema(BaseModel):
    organization_id: int
    name: str

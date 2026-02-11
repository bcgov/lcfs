from typing import List, Optional
from datetime import datetime

from pydantic import ConfigDict, field_validator
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema


class CreditLedgerTxnSchema(BaseSchema):
    transaction_type: str
    description: Optional[str] = None
    compliance_period: str
    organization_id: int
    compliance_units: int
    available_balance: Optional[int]
    update_date: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("available_balance")
    @classmethod
    def validate_available_balance(cls, v: Optional[int]) -> int:
        """Ensure available balance is never negative - display 0 instead"""
        return max(v or 0, 0)


class CreditLedgerListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    ledger: List[CreditLedgerTxnSchema]

from typing import List
from datetime import datetime

from pydantic import ConfigDict
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema


class CreditLedgerTxnSchema(BaseSchema):
    transaction_type: str
    compliance_period: str
    organization_id: int
    compliance_units: int
    available_balance: int
    update_date: datetime

    model_config = ConfigDict(from_attributes=True)


class CreditLedgerListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    ledger: List[CreditLedgerTxnSchema]

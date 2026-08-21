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


# ---------------------------------------------------------------------------
# Compliance-period ledger (#4714)
# ---------------------------------------------------------------------------


class PeriodLedgerTxnSchema(BaseSchema):
    """A single transaction row within a compliance-period ledger."""

    transaction_id: int
    transaction_type: str
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    units_in: int
    units_out: int
    # Cumulative balance from transactions within the selected period only.
    running_balance: int
    status: Optional[str] = None
    is_pending: bool = False

    model_config = ConfigDict(from_attributes=True)


class PeriodLedgerTypeTotalSchema(BaseSchema):
    """Units in/out and net for one transaction type (Show totals)."""

    transaction_type: str
    units_in: int
    units_out: int
    net: int


class AssessedBalanceSchema(BaseSchema):
    """
    Assessed balances per compliance year, read from Line 22 of the most recent
    assessed report for that year (#4831). A balance is ``None`` when the year
    has no assessed report — the UI leaves it blank rather than showing zero.
    """

    previous_year: Optional[int] = None
    previous_balance: Optional[int] = None
    current_year: int
    current_balance: Optional[int] = None


class PeriodLedgerSchema(BaseSchema):
    """Full compliance-period ledger response for one organization."""

    organization_id: int
    compliance_period: int
    include_pending: bool
    transactions: List[PeriodLedgerTxnSchema]
    totals_by_type: List[PeriodLedgerTypeTotalSchema]
    total_units_in: int
    total_units_out: int
    total_net: int
    assessed_balance: AssessedBalanceSchema

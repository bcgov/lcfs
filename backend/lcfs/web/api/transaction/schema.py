from typing import Optional, List

from pydantic import BaseModel, ConfigDict

from lcfs.web.api.organization.schema import OrganizationSummarySchema, OrganizationBase
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.transfer.schema import (
    TransactionTypeSchema,
    IssuanceHistorySchema,
    TransferHistory,
)


class TransactionBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_id: int
    compliance_units: int
    transaction_type_id: int
    organization_id: int

    organization: Optional[OrganizationSummarySchema]
    transaction_type: TransactionTypeSchema
    issuance_history_record: IssuanceHistorySchema
    transfer_history_record: TransferHistory


class Transactions(BaseModel):
    pagination: PaginationResponseSchema
    transactions: List[TransactionBase]

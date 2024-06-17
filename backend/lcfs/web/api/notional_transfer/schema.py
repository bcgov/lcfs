from typing import Optional, List
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from enum import Enum

class ReceivedOrTransferredEnumSchema(str, Enum):
    Received = "Received"
    Transferred = "Transferred"

class NotionalTransferCreateSchema(BaseSchema):
    notional_transfer_id: Optional[int] = None
    compliance_report_id: int
    quantity: int
    legal_name: str
    address_for_service: str
    fuel_category: str
    received_or_transferred: ReceivedOrTransferredEnumSchema
    deleted: Optional[bool]

class NotionalTransferSchema(NotionalTransferCreateSchema):
    pass

class ComplianceReportRequestSchema(BaseSchema):
    compliance_report_id: int
    # pagination: PaginationResponseSchema

class NotionalTransfersSchema(BaseSchema):
    notional_transfers: List[NotionalTransferSchema]
    # pagination: PaginationResponseSchema

class NotionalTransferFuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    description: Optional[str] = None

class NotionalTransferTableOptionsSchema(BaseSchema):
    fuel_categories: List[NotionalTransferFuelCategorySchema]
    received_or_transferred: List[str]

class NotionalTransferListCreateSchema(BaseSchema):
    compliance_report_id: int
    notional_transfers: List[NotionalTransferSchema]

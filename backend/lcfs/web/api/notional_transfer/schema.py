from typing import Optional, List
from pydantic import Field
from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    SortOrder,
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from enum import Enum


class ReceivedOrTransferredEnumSchema(str, Enum):
    Received = "Received"
    Transferred = "Transferred"


class NotionalTransferCreateSchema(BaseSchema):
    legal_name: str
    address_for_service: str
    fuel_category: str
    received_or_transferred: ReceivedOrTransferredEnumSchema
    quantity: int
    notional_transfer_id: Optional[int] = None
    compliance_report_id: int
    deleted: Optional[bool] = None


class NotionalTransferSchema(NotionalTransferCreateSchema):
    pass


class PaginatedNotionalTransferRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    filters: List[FilterModel]
    page: int
    size: int
    sort_orders: List[SortOrder]


class NotionalTransfersSchema(BaseSchema):
    notional_transfers: List[NotionalTransferSchema]
    pagination: Optional[PaginationResponseSchema] = None


class NotionalTransfersAllSchema(BaseSchema):
    notional_transfers: List[NotionalTransferSchema]


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


class DeleteNotionalTransferSchema(BaseSchema):
    notional_transfer_id: int
    compliance_report_id: int


class DeleteNotionalTransferResponseSchema(BaseSchema):
    message: str

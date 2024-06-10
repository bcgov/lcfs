from typing import Optional, List
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema

class NotionalTransferCreateSchema(BaseSchema):
    notional_transfer_id: Optional[int] = None
    compliance_report_id: int
    quantity: int
    legal_name: str
    address_for_service: str
    fuel_category_id: int
    received_or_transferred: str

class NotionalTransferSchema(NotionalTransferCreateSchema):
    pass

class NotionalTransfersSchema(BaseSchema):
    notional_transfers: List[NotionalTransferSchema]
    pagination: PaginationResponseSchema

class NotionalTransferFuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    description: Optional[str] = None

class NotionalTransferTableOptionsSchema(BaseSchema):
    fuel_categories: List[NotionalTransferFuelCategorySchema]
from lcfs.web.api.base import BaseSchema
from typing import Optional
from datetime import date

class AdminAdjustmentStatusSchema(BaseSchema):
    admin_adjustment_status_id: int
    status: str

    class Config:
        from_attributes = True

class AdminAdjustmentSchema(BaseSchema):
    admin_adjustment_id: int
    compliance_units: int
    current_status: AdminAdjustmentStatusSchema
    transaction_effective_date: date
    to_organization_id: int
    gov_comment: Optional[str] = None

    class Config:
        from_attributes = True

class AdminAdjustmentCreateSchema(BaseSchema):
    compliance_units: int
    current_status: str
    transaction_effective_date: date
    to_organization_id: int
    gov_comment: Optional[str] = None

    class Config:
        from_attributes = True

class AdminAdjustmentUpdateSchema(AdminAdjustmentSchema):
    pass
from lcfs.web.api.base import BaseSchema
from typing import Optional, List
from datetime import date, datetime


class AdminAdjustmentStatusSchema(BaseSchema):
    admin_adjustment_status_id: int
    status: str

    class Config:
        from_attributes = True


class HistoryUserSchema(BaseSchema):
    first_name: str
    last_name: str

    class Config:
        from_attributes = True


class OrganizationSchema(BaseSchema):
    organization_id: int
    name: str

    class Config:
        from_attributes = True


class AdminAdjustmentHistorySchema(BaseSchema):
    create_date: datetime
    admin_adjustment_status: AdminAdjustmentStatusSchema
    user_profile: HistoryUserSchema
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class AdminAdjustmentBaseSchema(BaseSchema):
    compliance_units: int
    current_status: AdminAdjustmentStatusSchema
    transaction_effective_date: Optional[date] = None
    to_organization_id: int
    gov_comment: Optional[str] = None
    internal_comment: Optional[str] = None

    class Config:
        from_attributes = True


class AdminAdjustmentSchema(AdminAdjustmentBaseSchema):
    admin_adjustment_id: int
    to_organization: OrganizationSchema
    history: Optional[List[AdminAdjustmentHistorySchema]]
    returned: Optional[bool] = False
    create_date: datetime


class AdminAdjustmentCreateSchema(AdminAdjustmentBaseSchema):
    current_status: str


class AdminAdjustmentUpdateSchema(AdminAdjustmentBaseSchema):
    admin_adjustment_id: int
    current_status: str

class CreateAdminAdjustmentHistorySchema(BaseSchema):
    admin_adjustment_id: int
    admin_adjustment_status_id: int
    user_profile_id: int
    display_name: str

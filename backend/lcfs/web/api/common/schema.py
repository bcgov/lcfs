from typing import Optional
from datetime import datetime
from lcfs.web.api.base import BaseSchema

class CompliancePeriodBaseSchema(BaseSchema):
    """Base schema for compliance period that can be shared across modules"""
    compliance_period_id: int
    description: str
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    display_order: Optional[int] = None
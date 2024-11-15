from typing import Optional, List
from datetime import datetime
from enum import Enum

from lcfs.web.api.base import BaseSchema, PaginationResponseSchema


# Operation Enum
class AuditLogOperationEnum(str, Enum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


# AuditLog Schema
class AuditLogSchema(BaseSchema):
    audit_log_id: int
    table_name: str
    operation: AuditLogOperationEnum
    row_id: int
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    delta: Optional[dict] = None
    create_date: Optional[datetime] = None
    create_user: Optional[str] = None
    update_date: Optional[datetime] = None
    update_user: Optional[str] = None

    class Config:
        from_attributes = True


# Simplified AuditLog Schema for list items
class AuditLogListItemSchema(BaseSchema):
    audit_log_id: int
    table_name: str
    operation: AuditLogOperationEnum
    row_id: int
    changed_fields: Optional[str] = None
    create_date: Optional[datetime] = None
    create_user: Optional[str] = None

    class Config:
        from_attributes = True


# AuditLog List Schema
class AuditLogListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    audit_logs: List[AuditLogListItemSchema]

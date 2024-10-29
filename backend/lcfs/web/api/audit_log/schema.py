from typing import Optional
from pydantic import BaseModel

class AuditLogFilterSchema(BaseModel):
    table_name: Optional[str]
    operation: Optional[str]

class AuditLogResponseSchema(BaseModel):
    id: int
    table_name: str
    operation: str
    row_id: int
    old_values: Optional[dict]
    new_values: Optional[dict]
    delta: Optional[dict]

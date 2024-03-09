from typing import Optional
from lcfs.web.api.base import BaseSchema


class RoleSchema(BaseSchema):
    role_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_government_role: bool

    class Config:
        from_attributes = True

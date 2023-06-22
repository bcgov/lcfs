from typing import Optional, List

from pydantic import BaseModel

from lcfs.web.api.organization.schema import Organization
from lcfs.web.api.permission.schema import PermissionSchema
from lcfs.web.api.role.schema import RoleSchema


class UserSchema(BaseModel):
    """DTO for user values."""
    id: Optional[int] = None
    title: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    email: str
    username: str
    display_name: Optional[str] = None
    is_active: Optional[bool] = True
    organization: Optional[dict] = []
    roles: List[RoleSchema] = []
    permissions: List[PermissionSchema] = []
    is_government_user: Optional[bool] = False
    phone: Optional[str] = None
    cell_phone: Optional[str] = None


class UserCreateSchema(BaseModel):
    """DTO for creating a user."""
    title: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    email: str
    username: str
    display_name: Optional[str] = None
    is_active: Optional[bool] = True
    organization: Optional[Organization] = None
    roles: List[dict] = []
    permissions: List[dict] = []
    is_government_user: Optional[bool] = False
    phone: Optional[str] = None
    cell_phone: Optional[str] = None

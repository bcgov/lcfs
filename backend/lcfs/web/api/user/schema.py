from typing import Optional, List

from pydantic import BaseModel

from lcfs.web.api.organization.schema import Organization
from lcfs.web.api.permission.schema import PermissionSchema
from lcfs.web.api.role.schema import RoleSchema

"""
Base - all shared attributes of a resource
Create - attributes required to create a new resource - used at POST requests
Update - attributes that can be updated - used at PUT requests
InDB - attributes present on any resource coming out of the database
Public - attributes present on public facing resources being returned from GET, POST, and PUT requests
"""
class UserBase(BaseModel):
    """DTO for user values."""
    id: Optional[int] = None
    title: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    email: str
    username: str
    display_name: Optional[str] = None
    is_active: Optional[bool] = True
    organization: dict = {}
    # organization: Optional[OrganizationSchema] = {}
    roles: List[RoleSchema] = []
    permissions: List[PermissionSchema] = []
    is_government_user: Optional[bool] = False
    phone: Optional[str] = None
    cell_phone: Optional[str] = None


class UserCreate(BaseModel):
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

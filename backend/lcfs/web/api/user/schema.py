from typing import Optional, List

from pydantic import BaseModel, EmailStr

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
    first_name: str
    last_name: Optional[str] = None
    email: EmailStr
    username: str
    title: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None


class UserCreate(BaseModel):
    pass

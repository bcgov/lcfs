from typing import Optional, List

from pydantic import BaseModel, EmailStr

from lcfs.web.api.organization.schema import OrganizationSummary
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
    last_name: str
    username: str
    email: EmailStr
    display_name: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    organization: Optional[OrganizationSummary] = None
    user_roles: Optional[List[RoleSchema]] = None
    
    class Config:
        from_attributes = True


class UserCreate(UserBase):
    keycloak_user_id: Optional[str] = None
    keycloak_email: Optional[str] = None
    keycloak_username: Optional[str] = None

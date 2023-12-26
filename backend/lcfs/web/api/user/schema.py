from typing import Optional, List

from pydantic import BaseModel, EmailStr

from lcfs.web.api.organization.schema import OrganizationSummarySchema
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.api.base import PaginationResponseScehema

"""
Base - all shared attributes of a resource
Create - attributes required to create a new resource - used at POST requests
Update - attributes that can be updated - used at PUT requests
InDB - attributes present on any resource coming out of the database
Public - attributes present on public facing resources being returned from GET, POST, and PUT requests
"""


class UserBase(BaseModel):
    """DTO for user values."""

    user_profile_id: int
    username: str
    email: EmailStr
    display_name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: bool = True
    mobile_phone: Optional[str] = None
    organization: Optional[OrganizationSummarySchema] = None
    roles: Optional[List[RoleSchema]] = []

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, user_profile):
        roles = [role.to_dict() for role in user_profile.user_roles]
        return cls(roles=roles, **user_profile.__dict__)


class Users(BaseModel):
    pagination: PaginationResponseScehema
    users: List[UserBase]


class UserCreate(UserBase):
    title: str
    phone: str
    mobile_phone: str
    first_name: str
    last_name: str
    is_active: bool
    keycloak_email: str
    keycloak_username: str
    pass

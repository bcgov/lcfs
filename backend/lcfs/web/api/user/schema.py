from typing import Optional, List, Union

from pydantic import BaseModel, EmailStr, Field

from lcfs.web.api.organization.schema import OrganizationSummaryResponseSchema
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.api.base import PaginationResponseSchema

"""
Base - all shared attributes of a resource
Create - attributes required to create a new resource - used at POST requests
Update - attributes that can be updated - used at PUT requests
InDB - attributes present on any resource coming out of the database
Public - attributes present on public facing resources being returned from GET, POST, and PUT requests
"""


class UserCreate(BaseModel):
    user_profile_id: Optional[int] = None
    title: str
    username: str
    email: EmailStr
    display_name: str
    phone: str
    mobile_phone: str
    first_name: str
    last_name: str
    is_active: bool
    organization_id: Optional[int] = None
    organization: OrganizationSummaryResponseSchema = Field(exclude=True)
    roles: List[RoleSchema] = Field(exclude=True)

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    """DTO for user values."""

    user_profile_id: int
    keycloak_username: str
    username: str
    email: EmailStr
    display_name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Union[bool, str]
    mobile_phone: Optional[str] = None
    organization: Optional[OrganizationSummaryResponseSchema] = None
    roles: Optional[List[RoleSchema]] = []
    is_government_user: Optional[bool] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, user_profile):
        is_government_user = False
        roles = []
        for role in user_profile.user_roles:
            roles.append(role.to_dict())
            if role.role.is_government_role:
                is_government_user = True
        return cls(roles=roles, is_government_user=is_government_user, **user_profile.__dict__)


class Users(BaseModel):
    pagination: PaginationResponseSchema
    users: List[UserBase]


class UserHistory(BaseModel):
    user_profile_id: int
    user_login_history_id: int
    keycloak_email: str
    external_username: str
    keycloak_user_id: str
    is_login_successful: bool
    login_error_message: str


class UserHistories(BaseModel):
    pagination: PaginationResponseSchema
    history: List[UserHistory]

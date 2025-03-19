from typing import Optional, List, Union
from datetime import datetime

from pydantic import EmailStr
from lcfs.web.api.base import BaseSchema

from lcfs.web.api.organizations.schema import OrganizationSummaryResponseSchema
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.api.base import PaginationResponseSchema

"""
Base - all shared attributes of a resource
Create - attributes required to create a new resource - used at POST requests
Update - attributes that can be updated - used at PUT requests
InDB - attributes present on any resource coming out of the database
Public - attributes present on public facing resources being returned from GET, POST, and PUT requests
"""


class UserCreateSchema(BaseSchema):
    user_profile_id: Optional[int] = None
    title: str
    keycloak_username: str
    keycloak_email: EmailStr
    email: Optional[EmailStr] = ""
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    first_name: str
    last_name: str
    is_active: bool
    organization_id: Optional[int] = None
    organization: Optional[OrganizationSummaryResponseSchema] = None
    roles: Optional[List[str]] = []


class UserBaseSchema(BaseSchema):
    """DTO for user values."""

    user_profile_id: int
    keycloak_username: str
    keycloak_email: EmailStr
    email: Optional[EmailStr] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Union[bool, str]
    mobile_phone: Optional[str] = None
    organization: Optional[OrganizationSummaryResponseSchema] = None
    roles: Optional[List[RoleSchema]] = None
    is_government_user: Optional[bool] = None
    is_safe_to_remove: bool = False

    @classmethod
    def model_validate(cls, user_profile):
        is_government_user = False
        roles = []
        for role in user_profile.user_roles:
            roles.append(role.to_dict())
            if role.role.is_government_role:
                is_government_user = True
        user_dict = user_profile.__dict__.copy()  # make a copy of the dictionary
        user_dict.pop("roles", None)  # remove the roles key if it exists
        return cls(roles=roles, is_government_user=is_government_user, **user_dict)


class UsersSchema(BaseSchema):
    pagination: PaginationResponseSchema
    users: List[UserBaseSchema]


class UserActivitySchema(BaseSchema):
    transaction_id: int
    action_taken: str
    transaction_type: str
    create_date: datetime
    user_id: Optional[int] = None  # Present when fetching activities for all users


class UserActivitiesResponseSchema(BaseSchema):
    activities: List[UserActivitySchema]
    pagination: PaginationResponseSchema


class UserLoginHistorySchema(BaseSchema):
    user_login_history_id: int
    keycloak_email: str
    external_username: str
    is_login_successful: bool
    login_error_message: Optional[str] = None
    create_date: datetime


class UserLoginHistoryResponseSchema(BaseSchema):
    histories: List[UserLoginHistorySchema]
    pagination: PaginationResponseSchema


class UpdateEmailSchema(BaseSchema):
    email: EmailStr

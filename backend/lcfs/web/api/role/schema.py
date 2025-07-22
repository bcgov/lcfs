from typing import Optional, List

from lcfs.db.models import UserProfile
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import BaseSchema


class RoleSchema(BaseSchema):
    role_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_government_role: bool


def user_has_roles(user: UserProfile, desired_role_names: List[RoleEnum]) -> bool:
    """
    Checks if the user has all specified roles, ignoring invalid role names.

    Parameters:
    - user: User object with a user_roles attribute containing role objects.
    - desired_role_names: List of strings representing the desired role names.

    Returns:
    - True if the user has all the desired roles, False otherwise.
    """
    user_role_names = user.role_names
    desired_role_set = set(desired_role_names)

    # Check if all desired roles are in the user's roles
    # This line checks if the desired roles are a subset of the user's roles
    return desired_role_set.issubset(user_role_names)


def is_government_user(user: UserProfile) -> bool:
    """
    Check if a user is a government user by examining if any of their roles
    has the is_government_role flag set to True.
    """
    return any(role.role.is_government_role for role in user.user_roles)

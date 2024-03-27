from typing import Optional, List
from lcfs.web.api.base import BaseSchema
from lcfs.db.models.Role import RoleEnum


class RoleSchema(BaseSchema):
    role_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_government_role: bool

    class Config:
        from_attributes = True


def user_has_roles(user, desired_role_names: List[str]) -> bool:
    """
    Checks if the user has all specified roles, ignoring invalid role names.
    
    Parameters:
    - user: User object with a user_roles attribute containing role objects.
    - desired_role_names: List of strings representing the desired role names.
    
    Returns:
    - True if the user has all the desired roles, False otherwise.
    """
    user_role_names = {role_obj.role.name.name for role_obj in user.user_roles}
    desired_role_set = set(desired_role_names)

    # Check if all desired roles are in the user's roles
    # This line checks if the desired roles are a subset of the user's roles
    return desired_role_set.issubset(user_role_names)

from functools import wraps
from fastapi import HTTPException, Request
from lcfs.db.models.UserRole import UserRole
from lcfs.db.models.Role import RoleEnum

def role_enum_member(role):
    # If role is a RoleEnum member, return it directly
    if isinstance(role, RoleEnum):
        return role
    # If role is a UserRole object, convert its role attribute to RoleEnum member
    if isinstance(role, UserRole):
        return RoleEnum[role.role.name.name] # TODO refactor
    # Otherwise, raise an error
    raise ValueError(f"Invalid role type: {type(role)}")


def roles_required(*required_roles):
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            user = getattr(request, "user", None)

            if not user:
                raise HTTPException(status_code=401, detail="User not authenticated")
            
            # Extract the role names or enum members from the user_roles attribute
            user_role_names = {role_enum_member(role) for role in user.user_roles}

            # Convert required_roles to a set of RoleEnum members
            required_role_set = {RoleEnum[role.upper()] for role in required_roles}

            # Check if user has all the required roles
            if not required_role_set.issubset(user_role_names):
                raise HTTPException(status_code=403, detail="Insufficient permissions")

            return await func(request, *args, **kwargs)
        
        return wrapper
    return decorator
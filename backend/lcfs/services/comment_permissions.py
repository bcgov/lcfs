"""Permissions shared by penalty comments and their supporting documents."""

from typing import TYPE_CHECKING

from lcfs.db.models.user.Role import RoleEnum

if TYPE_CHECKING:
    from lcfs.db.models.comment.InternalComment import InternalComment
    from lcfs.db.models.user.UserProfile import UserProfile


def can_manage_penalty_comment(user: "UserProfile", comment: "InternalComment") -> bool:
    """Allow government authors and government administrators to make changes."""
    return RoleEnum.GOVERNMENT in user.role_names and (
        comment.create_user == user.keycloak_username
        or RoleEnum.ADMINISTRATOR in user.role_names
    )

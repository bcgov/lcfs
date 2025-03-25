from typing import List
import structlog
from fastapi import Depends

from lcfs.web.api.role.repo import RoleRepository
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = structlog.get_logger(__name__)


class RoleServices:
    def __init__(self, repo: RoleRepository = Depends(RoleRepository)) -> None:
        self.repo = repo

    @service_handler
    async def get_roles(self, government_roles_only) -> List[RoleSchema]:
        """
        Gets the list of roles related to government user or org users.
        """
        roles = await self.repo.get_roles(government_roles_only)
        if len(roles) == 0:
            raise DataNotFoundException("No roles found")
        return roles

    @service_handler
    async def remove_roles_for_user(self, user_profile_id: int) -> None:
        """
        Removes all user roles from the given user.
        """
        await self.repo.delete_roles_for_user(user_profile_id)

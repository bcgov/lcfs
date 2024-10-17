from typing import List
from logging import getLogger
from fastapi import Depends

from lcfs.web.api.role.repo import RoleRepository
from lcfs.web.api.role.schema import RoleSchema
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = getLogger("role_services")


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

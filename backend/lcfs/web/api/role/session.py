from logging import getLogger
from typing import List

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.db.models.Role import Role
from lcfs.web.api.role.schema import RoleSchema

logger = getLogger("role")


class RoleRepository:
    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_all_roles(self) -> List[RoleSchema]:
        logger.info("Getting all roles from repository")
        stmt = "Select id, name, description, is_government_role from role"
        results = await self.session.execute(text(stmt))
        results = results.fetchall()
        if results.__len__() == 0:
            return []
        roles: List[RoleSchema] = []
        for role in results:
            roles.append(RoleSchema(id=role[0], name=role[1], description=role[2],
                                    is_government_role=role[3]))
        return roles

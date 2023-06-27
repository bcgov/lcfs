from logging import getLogger
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.base import row_to_dict
from lcfs.web.api.role.schema import RoleSchema

logger = getLogger("role")
role_stmt = "Select * from role_view"


class RoleRepository:
    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_all_roles(self, government_roles_only) -> List[RoleSchema]:
        logger.info("Getting all roles from repository")
        stmt = f"{role_stmt} where is_government_role = {government_roles_only}"
        results = await self.session.execute(text(stmt))
        results = results.fetchall()
        if results.__len__() == 0:
            return []
        return [row_to_dict(role, schema=RoleSchema) for role in results]

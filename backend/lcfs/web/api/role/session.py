from logging import getLogger
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.base import row_to_dict
from lcfs.web.api.role.schema import RoleSchema
from lcfs.db.models.Role import Role

logger = getLogger("role")


class RoleRepository:
    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_all_roles(self, government_roles_only) -> List[RoleSchema]:
        logger.info("Getting all roles from repository")
        results = await self.session.execute(
            select(Role).where(Role.is_government_role == government_roles_only)
        )
        results = results.scalars().all()

        # Convert Role instances to dictionaries
        role_dicts = [role.__dict__ for role in results]

        if not role_dicts:
            return []
        return [RoleSchema.model_validate(role) for role in role_dicts]

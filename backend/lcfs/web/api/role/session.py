from logging import getLogger
from typing import List

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.role.schema import RoleSchema
from lcfs.db.models.Role import Role

logger = getLogger("role")


class RoleRepository:
    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_all_roles(self, government_roles_only) -> List[RoleSchema]:
        logger.info("Getting all roles from repository")
        conditions = []
        if government_roles_only is not None:
            conditions.append(
                func.lower(Role.is_government_role) == government_roles_only.lower()
            )

        results = await self.session.execute(
            select(Role)
            .where(and_(*conditions))
            .order_by(Role.is_government_role.desc(), Role.display_order.asc())
        )
        # Convert Role instances to dictionaries
        roles = results.scalars().unique().all()
        role_dicts = [role.__dict__ for role in roles]

        return [RoleSchema.model_validate(role) for role in role_dicts]

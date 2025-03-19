import structlog
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import and_, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.role.schema import RoleSchema
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserRole import UserRole

logger = structlog.get_logger(__name__)


class RoleRepository:
    def __init__(
        self,
        session: AsyncSession = Depends(get_async_db_session),
        request: Request = None,
    ):
        self.session = session
        self.request = request

    async def get_roles(self, government_roles_only) -> List[RoleSchema]:
        logger.info("Getting all roles from repository")
        # exclude "Government & Supplier Roles"
        exclude_roles = [RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER]
        conditions = []
        if government_roles_only is not None:
            conditions.append(Role.name.not_in(exclude_roles))
            conditions.append(Role.is_government_role == government_roles_only)

        results = await self.session.execute(
            select(Role)
            .where(and_(*conditions))
            .order_by(Role.is_government_role.desc(), Role.display_order.asc())
        )
        # Convert Role instances to dictionaries
        roles = results.scalars().unique().all()
        role_dicts = [role.__dict__ for role in roles]

        return [RoleSchema.model_validate(role) for role in role_dicts]

    @repo_handler
    async def delete_roles_for_user(self, user_profile_id: int):
        """
        Delete all UserRole entries for the given user_profile_id.
        """
        await self.session.execute(
            delete(UserRole).where(UserRole.user_profile_id == user_profile_id)
        )
        await self.session.flush()

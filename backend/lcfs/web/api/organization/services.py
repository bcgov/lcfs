import math
from logging import getLogger

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.user.repo import UserRepository
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import (
    FilterModel,
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.user.schema import UsersSchema

logger = getLogger("organization_services")


class OrganizationServices:
    def __init__(
        self,
        request: Request = None,
        user_repo: UserRepository = Depends(UserRepository),
        session: AsyncSession = Depends(get_async_db_session),
    ) -> None:
        self.user_repo = user_repo
        self.request = request
        self.session = session

    @service_handler
    async def get_organization_users_list(
        self, organization_id: int, status: str, pagination: PaginationRequestSchema
    ) -> UsersSchema:
        """
        Get all users for the organization
        """
        # Add Organization and status to filter
        pagination.filters.append(
            FilterModel(
                filterType="number",
                field="organization_id",
                type="equals",
                filter=organization_id,
            )
        )
        users, total_count = await self.user_repo.get_users_paginated(
            pagination=pagination
        )
        return UsersSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            users=users,
        )

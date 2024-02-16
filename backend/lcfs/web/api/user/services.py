import io
import math
from datetime import datetime
from logging import getLogger
from typing import List

from fastapi import Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.role.schema import RoleSchema
from lcfs.db.dependencies import get_async_db_session
from lcfs.utils.constants import LCFS_Constants, FILE_MEDIA_TYPE
from lcfs.web.core.decorators import service_handler, transactional
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.base import (
    FilterModel,
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.db.models import UserProfile
from lcfs.web.api.user.schema import (
    UserCreateSchema,
    UserBaseSchema,
    UserHistorySchema,
    UsersSchema,
)
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder
from lcfs.web.api.user.repo import UserRepository
from fastapi_cache import FastAPICache

logger = getLogger("organization_repo")


class UserServices:
    def __init__(
        self,
        request: Request = None,
        repo: UserRepository = Depends(UserRepository),
        session: AsyncSession = Depends(get_async_db_session),
    ) -> None:
        self.repo = repo
        self.request = request
        self.session = session

    @service_handler
    @transactional
    async def export_users(self, export_format) -> StreamingResponse:
        """
        Prepares a list of users in a file that is downloadable
        """
        if not export_format in ["xls", "xlsx", "csv"]:
            raise DataNotFoundException("Export format not supported")

        exclude_government_users = FilterModel(
            filterType="number",
            type="notBlank",
            field="organization_id",
            filter=None,
        )
        # Query database for the list of users. Exclude government users.
        results = await self.repo.get_users_paginated(
            pagination=PaginationRequestSchema(
                page=1,
                size=0,
                filters=[exclude_government_users],
                sortOrders=[],
            )
        )

        # Prepare data for the spreadsheet
        data = []
        for u in results[0]:
            user = u if isinstance(u, dict) else u.dict()
            data.append(
                [
                    user["last_name"],
                    user["first_name"],
                    user["email"],
                    user["keycloak_username"],
                    user["title"],
                    user["phone"],
                    user["mobile_phone"],
                    "Active" if user["is_active"] else "Inactive",
                    ", ".join(role["name"] for role in user["roles"]),
                    user["organization"]["name"],
                ]
            )

        # Create a spreadsheet
        builder = SpreadsheetBuilder(file_format=export_format)

        builder.add_sheet(
            sheet_name=LCFS_Constants.USERS_EXPORT_SHEETNAME,
            columns=LCFS_Constants.USERS_EXPORT_COLUMNS,
            rows=data,
            styles={"bold_headers": True},
        )

        file_content = builder.build_spreadsheet()

        # Get the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        filename = (
            f"{LCFS_Constants.USERS_EXPORT_FILENAME}-{current_date}.{export_format}"
        )
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=FILE_MEDIA_TYPE[export_format.upper()].value,
            headers=headers,
        )

    @service_handler
    @transactional
    async def get_all_users(self, pagination: PaginationRequestSchema) -> UsersSchema:
        """
        Get all users
        """
        users, total_count = await self.repo.get_users_paginated(pagination=pagination)
        if len(users) == 0:
            raise DataNotFoundException("No users found")
        return UsersSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            users=users,
        )

    @service_handler
    @transactional
    async def get_user_by_id(self, user_id: int) -> UserBaseSchema:
        """
        Get user info by ID
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        return UserBaseSchema.model_validate(user)

    @service_handler
    @transactional
    async def create_user(self, user_create: UserCreateSchema) -> UserBaseSchema:
        """
        Create a new user
        """
        user = await self.repo.create_user(user_create)
        FastAPICache.clear(namespace="users")
        return user

    @service_handler
    @transactional
    async def update_user(
        self, user_create: UserCreateSchema, user_id: int
    ) -> UserProfile:
        """
        Update user info
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        await self.repo.update_user(user, user_create)
        await FastAPICache.clear(namespace="users")
        return user

    @service_handler
    @transactional
    async def delete_user(self, user_id: int) -> None:
        """
        Delete only if the user has never logged in to the system.
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        history = await self.repo.get_user_history(user_id)
        if len(history) <= 0:
            await self.repo.delete_user(user)
            await FastAPICache.clear(namespace="users")
        return None

    @service_handler
    @transactional
    async def get_user_roles(self, user_id: int) -> List[dict]:
        """
        Get user roles
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        return [RoleSchema.model_validate(role.to_dict()) for role in user.user_roles]

    @service_handler
    @transactional
    async def get_user_history(self, user_id: str) -> List[UserHistorySchema]:
        """
        Get user activities
        """
        result = await self.repo.get_user_history(user_id)
        if len(result) <= 0:
            raise DataNotFoundException("User history not found")
        return [
            UserHistorySchema.model_validate(history._data[0]) for history in result
        ]

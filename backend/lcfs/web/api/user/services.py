import io
import math
from datetime import datetime
import structlog
from typing import List

from fastapi import Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.role.schema import RoleSchema, user_has_roles
from lcfs.db.dependencies import get_async_db_session
from lcfs.utils.constants import LCFS_Constants, FILE_MEDIA_TYPE
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import (
    DataNotFoundException,
    PermissionDeniedException,
)
from lcfs.web.api.base import (
    FilterModel,
    PaginationRequestSchema,
    PaginationResponseSchema,
    validate_pagination,
)
from lcfs.db.models import UserProfile
from lcfs.web.api.user.schema import (
    UserCreateSchema,
    UserBaseSchema,
    UserLoginHistoryResponseSchema,
    UsersSchema,
    UserActivitySchema,
    UserActivitiesResponseSchema,
)
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder
from lcfs.web.api.user.repo import UserRepository
from fastapi_cache import FastAPICache
from lcfs.db.models.user.Role import RoleEnum

logger = structlog.get_logger(__name__)


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
    async def export_users(self, export_format) -> StreamingResponse:
        """
        Prepares a list of users in a file that is downloadable
        """
        if not export_format in ["xls", "xlsx", "csv"]:
            raise DataNotFoundException("Export format not supported")

        exclude_government_users = FilterModel(
            filter_type="number",
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
    async def get_user_by_id(self, user_id: int) -> UserBaseSchema:
        """
        Get user info by ID
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        if user_has_roles(self.request.user, [RoleEnum.GOVERNMENT]):
            pass
        elif (
            not user.organization
            or self.request.user.organization.organization_id
            != user.organization.organization_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this user's information.",
            )
        return UserBaseSchema.model_validate(user)

    @service_handler
    async def create_user(self, user_create: UserCreateSchema) -> str:
        """
        Create a new user
        """
        user = await self.repo.create_user(user_create)
        await FastAPICache.clear(namespace="users")
        return "User created successfully"

    @service_handler
    async def update_user(
        self, user_create: UserCreateSchema, user_id: int
    ) -> UserProfile:
        """
        Update user info
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        user = await self.repo.update_user(user, user_create)
        await FastAPICache.clear(namespace="users")
        return user

    @service_handler
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
    async def get_user_roles(self, user_id: int) -> List[dict]:
        """
        Get user roles
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")
        return [RoleSchema.model_validate(role.to_dict()) for role in user.user_roles]

    @service_handler
    async def get_user_activities(
        self, user_id: int, current_user, pagination: PaginationRequestSchema
    ) -> UserActivitiesResponseSchema:
        """
        Retrieves activities for a specific user with proper permission checks.
        """
        # Permission Checks
        if not await self._has_access_to_user_activities(current_user, user_id):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this user's activities.",
            )

        pagination = validate_pagination(pagination)

        activities, total_count = await self.repo.get_user_activities_paginated(
            user_id, pagination
        )
        activities_schema = [
            UserActivitySchema(**activity._asdict()) for activity in activities
        ]

        return UserActivitiesResponseSchema(
            activities=activities_schema,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

    @service_handler
    async def get_all_user_activities(
        self, current_user, pagination: PaginationRequestSchema
    ) -> UserActivitiesResponseSchema:
        """
        Retrieves activities for all users (Administrator role only).
        """
        if not any(
            role.role.name == RoleEnum.ADMINISTRATOR for role in current_user.user_roles
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view all user activities.",
            )

        pagination = validate_pagination(pagination)

        activities, total_count = await self.repo.get_all_user_activities_paginated(
            pagination
        )
        activities_schema = [
            UserActivitySchema(**activity._asdict()) for activity in activities
        ]

        return UserActivitiesResponseSchema(
            activities=activities_schema,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

    @service_handler
    async def get_all_user_login_history(
        self, current_user, pagination: PaginationRequestSchema
    ) -> UserLoginHistoryResponseSchema:
        """
        Retrieves login histories for all users (Administrator role only).
        """
        if not any(
            role.role.name == RoleEnum.ADMINISTRATOR for role in current_user.user_roles
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view all user login histories.",
            )

        pagination = validate_pagination(pagination)
        login_history, total_count = (
            await self.repo.get_all_user_login_history_paginated(pagination)
        )

        return UserLoginHistoryResponseSchema(
            histories=login_history,
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
        )

    async def _has_access_to_user_activities(
        self, current_user: UserProfile, target_user_id: int
    ) -> bool:
        """
        Checks if the current user has access to the target user's activities.
        """
        target_user = await self.repo.get_user_by_id(target_user_id)
        if not target_user:
            raise HTTPException(
                status_code=404,
                detail="User not found.",
            )

        current_user_roles = current_user.role_names

        # Administrator users can access any user's activities
        if RoleEnum.ADMINISTRATOR in current_user_roles:
            return True

        # Manage Users can access activities of users within the same organization
        if (
            RoleEnum.MANAGE_USERS in current_user_roles
            and current_user.organization_id == target_user.organization_id
        ):
            return True

        return False

    async def track_user_login(self, user: UserProfile):
        await self.repo.create_login_history(user)

    @service_handler
    async def update_notifications_email(self, user_id: int, email: str):
        try:
            # Update the notifications_email field of the user
            return await self.repo.update_notifications_email(user_id, email)
            # Return the updated user
            return UserBaseSchema.model_validate(user)
        except DataNotFoundException as e:
            logger.error(f"User not found: {e}")
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating notifications email: {e}")
            raise HTTPException(status_code=500, detail="Internal Server Error")

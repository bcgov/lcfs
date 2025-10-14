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
from lcfs.web.exception.exceptions import DataNotFoundException
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
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.role.services import RoleServices

logger = structlog.get_logger(__name__)

# For government users, we manage subscriptions for these roles only
IDIR_NOTIFICATION_ROLES = {
    RoleEnum.ANALYST,
    RoleEnum.COMPLIANCE_MANAGER,
    RoleEnum.DIRECTOR,
}


class UserServices:

    def __init__(
        self,
        request: Request = None,
        repo: UserRepository = Depends(UserRepository),
        session: AsyncSession = Depends(get_async_db_session),
        notification_service: NotificationService = Depends(NotificationService),
        role_service: RoleServices = Depends(RoleServices),
    ) -> None:
        self.repo = repo
        self.request = request
        self.session = session
        self.notification_service = notification_service
        self.role_service = role_service

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
        return UsersSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=(
                    math.ceil(total_count / pagination.size) if total_count > 0 else 0
                ),
            ),
            users=users,
        )

    @service_handler
    async def get_user_by_id(self, user_id: int) -> UserBaseSchema:
        """
        Get information of a user by ID, plus indicates if they're safe to remove.
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

        user_schema = UserBaseSchema.model_validate(user)

        # Check if the user is safe to remove
        is_safe = await self.repo.is_user_safe_to_remove(user.keycloak_username)
        user_schema.is_safe_to_remove = is_safe

        return user_schema

    @service_handler
    async def create_user(self, user_create: UserCreateSchema) -> str:
        """
        Create a new user. If active:
          - Government user => add subscriptions for any assigned government roles listed in IDIR_NOTIFICATION_ROLES.
          - Non-gov user => add subscription for SUPPLIER only (ignore assigned roles).
        """
        user = await self.repo.create_user(user_create)

        user = await self.repo.get_user_by_id(user.user_profile_id)
        if user.is_active:
            if user.is_government:
                for role_str in user.role_names:
                    role_enum = RoleEnum(role_str)
                    if role_enum in IDIR_NOTIFICATION_ROLES:
                        await self.notification_service.add_subscriptions_for_user_role(
                            user.user_profile_id, role_enum
                        )
            else:
                await self.notification_service.add_subscriptions_for_user_role(
                    user.user_profile_id, RoleEnum.SUPPLIER
                )

        await FastAPICache.clear(namespace="users")
        return "User created successfully"

    @service_handler
    async def update_user(
        self, user_create: UserCreateSchema, user_id: int
    ) -> UserProfile:
        """
        Update user info along with updating subscriptions based on the changes.
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")

        # Snapshot old roles & active status
        old_roles = {RoleEnum(r) for r in user.role_names}
        was_active = user.is_active

        # Update the user in DB
        user = await self.repo.update_user(user, user_create)

        new_roles = {RoleEnum(r) for r in user.role_names}
        is_active_now = user.is_active

        # 1) Inactive → Active
        if not was_active and is_active_now:
            if user.is_government:
                # Add subscriptions for assigned IDIR roles
                for role in new_roles.intersection(IDIR_NOTIFICATION_ROLES):
                    await self.notification_service.add_subscriptions_for_user_role(
                        user.user_profile_id, role
                    )
                logger.info(
                    f"User {user.user_profile_id} became active (gov) -> IDIR added."
                )
            else:
                # Add Supplier for non-gov
                await self.notification_service.add_subscriptions_for_user_role(
                    user.user_profile_id, RoleEnum.SUPPLIER
                )
                logger.info(
                    f"User {user.user_profile_id} became active (non-gov) -> Supplier added."
                )

        # 2) Active → Inactive
        elif was_active and not is_active_now:
            if user.is_government:
                # Remove IDIR for old roles
                for role in old_roles.intersection(IDIR_NOTIFICATION_ROLES):
                    await self.notification_service.delete_subscriptions_for_user_role(
                        user.user_profile_id, role
                    )
                logger.info(
                    f"User {user.user_profile_id} became inactive (gov) -> IDIR removed."
                )
            else:
                # Remove Supplier
                await self.notification_service.delete_subscriptions_for_user_role(
                    user.user_profile_id, RoleEnum.SUPPLIER
                )
                logger.info(
                    f"User {user.user_profile_id} became inactive (non-gov) -> Supplier removed."
                )

        # 3) Remains Active
        else:
            if user.is_government:
                # Adjust subscriptions for IDIR role changes
                removed_roles = old_roles - new_roles
                added_roles = new_roles - old_roles

                for role in removed_roles.intersection(IDIR_NOTIFICATION_ROLES):
                    await self.notification_service.delete_subscriptions_for_user_role(
                        user.user_profile_id, role
                    )
                    logger.info(
                        f"User {user.user_profile_id} unsubscribed from {role.value}."
                    )

                for role in added_roles.intersection(IDIR_NOTIFICATION_ROLES):
                    await self.notification_service.add_subscriptions_for_user_role(
                        user.user_profile_id, role
                    )
                    logger.info(
                        f"User {user.user_profile_id} subscribed to {role.value}."
                    )
            else:
                # Non-gov, remains active => no role changes.
                # (We ignore assigned roles for non-gov.)
                pass

        await FastAPICache.clear(namespace="users")
        return user

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
        # Permission Checks, pass no data found instead of 403
        if not await self._has_access_to_user_activities(current_user, user_id):
            raise HTTPException(
                status_code=404,
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
    async def update_email(self, user_id: int, email: str):
        try:
            return await self.repo.update_email(user_id, email)
        except DataNotFoundException as e:
            logger.error(f"User not found: {e}")
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating email: {e}")
            raise HTTPException(status_code=500, detail="Internal Server Error")

    @service_handler
    async def remove_user(self, user_id: int) -> None:
        """
        Removes user from the system following the safe-to-remove check.
        """
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise DataNotFoundException("User not found")

        # Check if safe to remove
        is_safe = await self.repo.is_user_safe_to_remove(user.keycloak_username)
        if not is_safe:
            raise HTTPException(status_code=400, detail="User is not safe to remove.")

        await self.role_service.remove_roles_for_user(user.user_profile_id)
        await self.notification_service.remove_subscriptions_for_user(
            user.user_profile_id
        )
        await self.repo.delete_user(user)
        await FastAPICache.clear(namespace="users")

        return None

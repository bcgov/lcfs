from logging import getLogger
from typing import List
import numpy as np

from fastapi import Depends
from fastapi_cache.decorator import cache
from sqlalchemy import and_, func, select, asc, desc, delete, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.UserProfile import UserProfile
from lcfs.db.models.UserRole import UserRole
from lcfs.db.models.UserLoginHistory import UserLoginHistory
from lcfs.db.models.Role import Role, RoleEnum
from lcfs.web.api.user.schema import UserCreate, UserBase, UserHistory
from lcfs.web.api.base import (
    PaginationRequestSchema,
    lcfs_cache_key_builder,
    apply_filter_conditions,
    get_field_for_filter,
)

logger = getLogger("user_repo")


class UserRepository:
    def __init__(
        self,
        session: AsyncSession = Depends(get_async_db_session),
    ):
        self.session = session

    def apply_filters(self, pagination, conditions):
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filterType

            if filter.field == "role":
                field = get_field_for_filter(Role, "name")
                conditions.append(
                    Role.name.in_(
                        [RoleEnum(role.strip()) for role in filter_value.split(",")]
                    )
                )
            elif filter.field == "is_active":
                filter_value = True if filter_value == "Active" else False
                filter_option = "true" if filter_value else "false"
                field = get_field_for_filter(UserProfile, "is_active")
                conditions.append(
                    apply_filter_conditions(
                        field,
                        filter_value,
                        filter_option,
                        filter_type,
                    )
                )
            elif filter.field == "first_name":
                txt = filter_value.split(" ")
                field1 = get_field_for_filter(UserProfile, "first_name")
                conditions.append(
                    apply_filter_conditions(
                        field1,
                        txt[0],
                        filter_option,
                        filter_type,
                    )
                )
                field2 = get_field_for_filter(UserProfile, "last_name")
                conditions.append(
                    apply_filter_conditions(
                        field2,
                        txt[1] if len(txt) > 1 else "",
                        filter_option,
                        filter_type,
                    )
                )
            else:
                field = get_field_for_filter(UserProfile, filter.field)
                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                )

    @cache(
        expire=3600 * 24,
        key_builder=lcfs_cache_key_builder,
        namespace="users",
    )  # Cache for 24 hours, already handled to clear cache if any new users are added or existing users are updated.
    @repo_handler
    async def get_users_paginated(
        self,
        pagination: PaginationRequestSchema,
    ) -> List[UserBase]:
        """
        Queries users from the database with optional filters for username, surname,
        organization, and active status. Supports pagination and sorting.

        Args:
            username (Optional[str]): Filter for users with a username similar to the provided value.
            organization (Optional[str]): Filter for users belonging to a specific organization.
            surname (Optional[str]): Filter for users with a surname similar to the provided value.
            include_inactive (bool): Whether to include inactive users in the results.
            pagination (dict): Pagination and sorting parameters.

        Returns:
            List[UserBase]: A list of user profiles matching the query.
        """
        # Build the base query statement
        conditions = []
        if pagination.filters and len(pagination.filters) > 0:
            try:
                self.apply_filters(pagination, conditions)
            except Exception as e:
                raise ValueError(f"Invalid filter provided: {pagination.filters}.")

        # Apply pagination and sorting parameters
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

        # Applying pagination, sorting, and filters to the query
        query = (
            select(UserProfile)
            .join(UserRole, UserProfile.user_profile_id == UserRole.user_profile_id)
            .join(Role, UserRole.role_id == Role.role_id)
            .options(
                joinedload(UserProfile.organization),
                joinedload(UserProfile.user_roles).options(joinedload(UserRole.role)),
            )
            .where(and_(*conditions))
        )

        count_query = await self.session.execute(
            select(func.count(distinct(UserProfile.user_profile_id)))
            .select_from(UserProfile)
            .join(UserRole, UserProfile.user_profile_id == UserRole.user_profile_id)
            .join(Role, UserRole.role_id == Role.role_id)
            .where(and_(*conditions))
        )
        total_count = count_query.unique().scalar_one_or_none()
        # Sort the query results
        for order in pagination.sortOrders:
            sort_method = asc if order.direction == "asc" else desc
            if order.field == "role":
                order.field = get_field_for_filter(Role, "name")
            query = query.order_by(sort_method(order.field))

        # Execute the query
        user_results = (
            await self.session.execute(query.offset(offset).limit(limit))
            if limit > 0
            else await self.session.execute(query)
        )
        results = user_results.scalars().unique().all()

        # Convert the results to UserBase schemas
        return [UserBase.model_validate(user) for user in results], total_count

    @repo_handler
    async def get_user_by_id(self, user_id: int) -> UserProfile:
        query = (
            select(UserProfile)
            .options(
                joinedload(UserProfile.organization),
                joinedload(UserProfile.user_roles).options(joinedload(UserRole.role)),
            )
            .where(UserProfile.user_profile_id == user_id)
        )

        # Execute the query
        return await self.session.scalar(query)

    @repo_handler
    async def create_user(
        self, user_create: UserCreate, user_id: int = None
    ) -> UserProfile:
        user_data = user_create.model_dump()
        roles = user_data.pop("roles", {})
        new_user = UserProfile()
        # get the next sequence value for the user_profile_id and begin the async transaction.
        id_seq = func.nextval("user_profile_user_profile_id_seq")
        result = await self.session.execute(select(id_seq))
        user_id = result.unique().scalar_one_or_none()
        user_data["user_profile_id"] = user_id
        # convert the UserCreate instance to UserProfile schema object
        new_user = UserProfile.form_user_profile(new_user, user_data)
        new_user.roles = roles
        self.session.add(new_user)
        # Update/insert the roles separately
        user_roles = UserRole.get_user_roles(new_user)
        self.session.add_all(user_roles)

        logger.info(f"Created user with id: {user_id}")
        return user_id

    @repo_handler
    async def update_user(
        self, user: UserProfile, user_update: UserCreate
    ) -> UserProfile:
        user_data = user_update.model_dump()

        # convert UserCreate instance to UserProfile and save the data.
        user_profile = UserProfile.form_user_profile(user, user_data)
        self.session.add(user_profile)
        existing_roles = [ur.role_id for ur in user_profile.user_roles]
        new_roles = [role["role_id"] for role in user_data.pop("roles", [])]
        if not np.array_equal(existing_roles, new_roles):
            # Delete existing roles and update with new roles
            await self.session.execute(
                delete(UserRole).where(UserRole.user_profile_id == user.user_profile_id)
            )
            user_roles = UserRole.get_user_roles(user_profile)
            self.session.add_all(user_roles)

        logger.info(f"Updated user_profile_id: {user.user_profile_id}")
        return user_profile.user_profile_id

    @repo_handler
    async def delete_user(self, user: UserProfile) -> None:
        await self.session.delete(user)
        logger.info(f"Deleted user with id: {user.user_profile_id}")
        return None

    # TODO: User History pagination implementation if needed
    @repo_handler
    async def get_user_history(self, user_id: int = None) -> List[UserHistory]:
        histories = await self.session.execute(
            select(UserLoginHistory)
            .join(
                UserProfile,
                UserProfile.keycloak_username == UserLoginHistory.external_username,
            )
            .filter(
                UserProfile.user_profile_id == user_id,
                UserLoginHistory.is_login_successful == True,
            )
        )
        return histories.all()

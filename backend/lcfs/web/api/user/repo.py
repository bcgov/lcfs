from logging import getLogger
from typing import List, Optional

from fastapi import Depends, Request
from fastapi_cache.decorator import cache
from sqlalchemy import and_, func, select, asc, desc, delete, distinct
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.UserProfile import UserProfile
from lcfs.db.models.UserRole import UserRole
from lcfs.db.models.Role import Role, RoleEnum
from lcfs.web.api.user.schema import UserCreate, UserBase, UserHistory
from lcfs.web.api.base import (
    PaginationRequestSchema,
    lcfs_cache_key_builder,
    apply_filter_conditions,
    get_field_for_filter,
)
from fastapi import HTTPException

logger = getLogger("user_repo")


class UserRepository:
    def __init__(
        self,
        session: AsyncSession = Depends(get_async_db_session),
        request: Request = None,
    ):
        self.session = session
        self.request = request

    async def export_users(
        self,
        sort_field: Optional[str] = "last_name",
        sort_direction: str = "asc",
    ) -> List:
        """
        Retrieves all users from the database, optionally sorted by a specified field.

        Args:
            sort_field (Optional[str]): The field by which to sort the users.
                                        Defaults to 'last_name'. Set to None for no sorting.
            sort_direction (str): The direction of sorting, either 'asc' for ascending or
                                'desc' for descending. Defaults to 'asc'.

        Returns:
            List: A list of user profiles, optionally sorted.
        """
        # Build the base query statement
        query = select(UserProfile).options(
            joinedload(UserProfile.organization),
            joinedload(UserProfile.user_roles).options(joinedload(UserRole.role)),
        )

        # Apply sorting if sort_field is provided
        if sort_field:
            sort_method = asc if sort_direction == "asc" else desc
            query = query.order_by(sort_method(getattr(UserProfile, sort_field)))

        # Execute the query
        user_results = await self.session.execute(query)
        results = user_results.scalars().unique().all()

        return results

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
    async def get_all_users(
        self,
        pagination: PaginationRequestSchema = {},
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
        try:
            # Build the base query statement
            conditions = []
            if pagination.filters and len(pagination.filters) > 0:
                try:
                    self.apply_filters(pagination, conditions)
                except Exception as e:
                    raise ValueError(f"Invalid filter provided: {pagination.filters}.")

            # Apply pagination and sorting parameters
            offset = (
                0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
            )
            limit = pagination.size

            # Applying pagination, sorting, and filters to the query
            query = (
                select(UserProfile)
                .join(UserRole, UserProfile.user_profile_id == UserRole.user_profile_id)
                .join(Role, UserRole.role_id == Role.role_id)
                .options(
                    joinedload(UserProfile.organization),
                    joinedload(UserProfile.user_roles).options(
                        joinedload(UserRole.role)
                    ),
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
        except Exception as e:
            logger.error(f"Error occurred while fetching users: {e}")
            raise Exception("Error occurred while fetching users.")

    async def get_user(self, user_id: int):
        try:
            query = (
                select(UserProfile)
                .options(
                    joinedload(UserProfile.organization),
                    joinedload(UserProfile.user_roles).options(
                        joinedload(UserRole.role)
                    ),
                )
                .where(UserProfile.user_profile_id == user_id)
            )

            # Execute the query
            result = await self.session.execute(query)
            user = result.unique().scalar_one_or_none()
            return UserBase.model_validate(user)
        except Exception as e:
            logger.error(f"Error occurred while fetching user: {e}")
            raise Exception("Error occurred while fetching user.")

    async def create_user(
        self, user_create: UserCreate, user_id: int = None
    ) -> UserProfile:
        user_data = user_create.model_dump()
        roles = user_data.pop("roles", {})
        new_user = UserProfile()
        try:
            # get the next sequence value for the user_profile_id and begin the async transaction.
            user_profile_id_seq = func.nextval("user_profile_user_profile_id_seq")
            user_profile_id = await self.session.execute(select(user_profile_id_seq))
            user_id = user_profile_id.unique().scalar_one_or_none()
            new_user.user_profile_id = user_id
            # convert the UserCreate instance to UserProfile schema object
            new_user = UserProfile.form_user_profile(new_user, user_data, user_id)
            self.session.add(new_user)
            self.session.refresh(new_user)
            # Update/insert the roles separately
            user_roles = UserRole.get_user_roles(roles, new_user)
            self.session.add_all(user_roles)
            # Commit and close the connection
            self.session.commit()

        except Exception as e:
            # in case of any failures rollback the session
            self.session.rollback()
            logger.error(f"Error creating user: {e}")
            raise Exception(f"Error creating user")

        logger.info(f"Created user with id: {user_id}")
        return UserBase.model_validate(await self.get_user(user_id))

    async def update_user(
        self, user_update: UserCreate, user_profile_id: int = None
    ) -> UserProfile:
        user_data = user_update.model_dump()

        try:
            # Get existing record for update.
            user = await self.session.get(UserProfile, user_profile_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            # convert UserCreate instance to UserProfile and save the data.
            user_profile = UserProfile.form_user_profile(
                user, user_data, user_profile_id
            )
            # Delete existing roles and update with new roles
            await self.session.execute(
                delete(UserRole).where(UserRole.user_profile_id == user.user_profile_id)
            )
            user_roles = UserRole.get_user_roles(
                user_data.pop("roles", {}), user_profile
            )
            self.session.add_all(user_roles)
            # commit and close the connection
            self.session.commit()

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error updating user: {e}")
            raise Exception(f"Error updating user:.")

        logger.info(f"Updated user_profile_id: {user_profile_id}")
        return await self.get_user(user_profile_id)

    # TODO: User History implementation
    async def get_user_history(
        self, pagination: PaginationRequestSchema = {}, user_id: int = None
    ) -> List[UserHistory]:
        return []

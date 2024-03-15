from logging import getLogger
from typing import List

from fastapi import Depends
from fastapi_cache.decorator import cache
from sqlalchemy import and_, select, asc, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.UserProfile import UserProfile
from lcfs.db.models.UserRole import UserRole
from lcfs.db.models.UserLoginHistory import UserLoginHistory
from lcfs.db.models.Organization import Organization
from lcfs.db.models.Role import Role, RoleEnum
from lcfs.web.api.user.schema import UserCreateSchema, UserBaseSchema, UserHistorySchema
from lcfs.web.api.repo import BaseRepository
from lcfs.web.api.base import (
    PaginationRequestSchema,
    lcfs_cache_key_builder,
    apply_filter_conditions,
    get_field_for_filter,
)

logger = getLogger("user_repo")


class UserRepository(BaseRepository):
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        super().__init__(db)

    def apply_filters(self, pagination, conditions):
        role_filter_present = False
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filterType

            if filter.field == "role":
                field = get_field_for_filter(Role, "name")
                role_filter_present = True
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
        return role_filter_present

    async def find_user_role(self, role_name):
        role_result = await self.db.execute(
            select(Role).filter(Role.name == role_name)
        )
        role = role_result.scalar_one_or_none()
        if role:
            db_user_role = UserRole(role=role)
            return db_user_role
        return None

    async def update_idir_roles(self, user, new_roles, existing_roles_set):
        for new_role in new_roles:
            if new_role in {
                RoleEnum.ANALYST,
                RoleEnum.COMPLIANCE_MANAGER,
                RoleEnum.DIRECTOR,
            }:
                if new_role not in existing_roles_set:
                    # Remove existing roles
                    roles_to_keep = [
                        user_role
                        for user_role in user.user_roles
                        if user_role.role.name
                        not in {
                            RoleEnum.ANALYST,
                            RoleEnum.COMPLIANCE_MANAGER,
                            RoleEnum.DIRECTOR,
                        }
                    ]
                    # Add new role
                    user.user_roles = roles_to_keep
                    user.user_roles.append(await self.find_user_role(new_role.name))
            elif (
                new_role == RoleEnum.ADMINISTRATOR
                and RoleEnum.ADMINISTRATOR not in existing_roles_set
            ):
                # Add administrator role
                user.user_roles.append(await self.find_user_role(new_role.name))
            elif (
                new_role == RoleEnum.GOVERNMENT
                and RoleEnum.GOVERNMENT not in existing_roles_set
            ):
                # Add government role
                user.user_roles.append(await self.find_user_role(new_role.name))

        if (
            RoleEnum.ADMINISTRATOR not in new_roles
            and RoleEnum.ADMINISTRATOR in existing_roles_set
        ):
            # Remove existing roles
            roles_to_keep = [
                user_role
                for user_role in user.user_roles
                if user_role.role.name != RoleEnum.ADMINISTRATOR
            ]
            user.user_roles = roles_to_keep

    async def update_bceid_roles(self, user, new_roles, existing_roles_set):
        for new_role in new_roles:
            if (
                new_role == RoleEnum.READ_ONLY
                and RoleEnum.READ_ONLY not in existing_roles_set
            ):
                roles_to_keep = [
                    user_role
                    for user_role in user.user_roles
                    if user_role.role.name == RoleEnum.SUPPLIER
                ]
                # Add read_only role
                user.user_roles = roles_to_keep
                user.user_roles.append(await self.find_user_role(new_role.name))
            elif (
                new_role == RoleEnum.SUPPLIER
                and RoleEnum.SUPPLIER not in existing_roles_set
            ):
                # Add supplier role
                user.user_roles.append(await self.find_user_role(new_role.name))
            elif new_role in {
                RoleEnum.COMPLIANCE_REPORTING,
                RoleEnum.MANAGE_USERS,
                RoleEnum.TRANSFER,
                RoleEnum.SIGNING_AUTHORITY,
            }:
                if new_role not in existing_roles_set:
                    # Add missing role
                    user.user_roles.append(await self.find_user_role(new_role.name))
        user_roles_to_keep = [user_role for user_role in user.user_roles]
        for user_role in user.user_roles:
            if (
                user_role.role.name
                in {
                    RoleEnum.COMPLIANCE_REPORTING,
                    RoleEnum.MANAGE_USERS,
                    RoleEnum.TRANSFER,
                    RoleEnum.SIGNING_AUTHORITY,
                    RoleEnum.READ_ONLY,
                }
                and user_role.role.name not in new_roles
            ):
                user_roles_to_keep.remove(user_role)
        user.user_roles = user_roles_to_keep

    @cache(
        expire=3600 * 24,
        key_builder=lcfs_cache_key_builder,
        namespace="users",
    )  # Cache for 24 hours, already handled to clear cache if any new users are added or existing users are updated.
    @repo_handler
    async def get_users_paginated(
        self,
        pagination: PaginationRequestSchema,
    ) -> List[UserBaseSchema]:
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
            List[UserBaseSchema]: A list of user profiles matching the query.
        """
        # Build the base query statement
        conditions = []
        role_filter_present = False
        if pagination.filters and len(pagination.filters) > 0:
            try:
                role_filter_present = self.apply_filters(pagination, conditions)
            except Exception as e:
                raise ValueError(f"Invalid filter provided: {pagination.filters}.")

        # Apply pagination and sorting parameters
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size
        # get distinct profile ids from UserProfile
        unique_ids_query = select(UserProfile).where(and_(*conditions))
        if role_filter_present:
            unique_ids_query = unique_ids_query.join(
                UserRole, UserProfile.user_profile_id == UserRole.user_profile_id
            ).join(Role, UserRole.role_id == Role.role_id)

        # Applying pagination, sorting, and filters to the query
        query = (
            select(UserProfile)
            .join(
                UserRole,
                UserProfile.user_profile_id == UserRole.user_profile_id,
                isouter=True,
            )
            .join(Role, UserRole.role_id == Role.role_id, isouter=True)
            .options(
                joinedload(UserProfile.organization),
                joinedload(UserProfile.user_roles).options(joinedload(UserRole.role)),
            )
        )

        query_result = (
            (await self.db.execute(unique_ids_query)).unique().scalars().all()
        )
        total_count = len(query_result)
        # Sort the query results
        for order in pagination.sortOrders:
            sort_method = asc if order.direction == "asc" else desc
            if order.field == "role":
                order.field = get_field_for_filter(Role, "name")
            unique_ids_query = unique_ids_query.order_by(sort_method(order.field))
            query = query.order_by(sort_method(order.field))
        unique_ids = (
            (await self.db.execute(unique_ids_query.offset(offset).limit(limit)))
            .unique()
            .scalars()
            .all()
        )
    
        profile_id_list = [user.user_profile_id for user in unique_ids]
        if limit <= 0:
            query = query.where(*conditions)
        else:
            query = query.where(
                and_(UserProfile.user_profile_id.in_(profile_id_list), *conditions)
            )
        # Execute the query
        user_results = await self.db.execute(query)
        results = user_results.scalars().unique().all()

        # Convert the results to UserBaseSchema schemas
        return [UserBaseSchema.model_validate(user) for user in results], total_count

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
        user_result = await self.db.execute(query)
        return user_result.unique().scalar_one_or_none() if user_result else None

    @repo_handler
    async def create_user(
        self, user_create: UserCreateSchema, user_id: int = None
    ) -> UserProfile:
        db_user_profile = UserProfile(**user_create.model_dump(exclude={"roles"}))
        user_data = user_create.model_dump()
        roles = user_data.pop("roles", {})
        # Find the RoleEnum member corresponding to each role
        role_enum_members = [
            role_enum for role_enum in RoleEnum if role_enum.value.lower() in roles
        ]

        if db_user_profile.is_active:
            for role_name in role_enum_members:
                role_result = await self.db.execute(
                    select(Role).filter(Role.name == role_name)
                )
                role = role_result.scalar_one_or_none()
                if role:
                    db_user_role = UserRole(role=role)
                    db_user_profile.user_roles.append(db_user_role)
        if db_user_profile.organization_id:
            org_result = await self.db.execute(
                select(Organization).filter(
                    Organization.organization_id == db_user_profile.organization_id
                )
            )
            org = org_result.scalar_one_or_none()
            db_user_profile.organization = org
        self.db.add(db_user_profile)
        await self.commit_to_db()
        return db_user_profile

    @repo_handler
    async def update_user(
        self, user: UserProfile, user_update: UserCreateSchema
    ) -> None:
        user_data = user_update.model_dump()
        updated_user_profile = UserProfile(**user_update.model_dump(exclude={"roles"}))
        roles = user_data.pop("roles", {})
        # Find the RoleEnum member corresponding to each role
        new_roles = [
            role_enum for role_enum in RoleEnum if role_enum.value.lower() in roles
        ]
        # Create a set for faster membership checks
        existing_roles_set = set([user_role.role.name for user_role in user.user_roles])

        # Update the user object with the new data
        user.email = updated_user_profile.email
        user.title = updated_user_profile.title
        user.first_name = updated_user_profile.first_name
        user.last_name = updated_user_profile.last_name
        user.is_active = updated_user_profile.is_active
        user.keycloak_email = updated_user_profile.keycloak_email
        user.keycloak_username = updated_user_profile.keycloak_username
        user.phone = updated_user_profile.phone
        user.mobile_phone = updated_user_profile.mobile_phone

        if user.organization:
            await self.update_bceid_roles(user, new_roles, existing_roles_set)
        else:
            await self.update_idir_roles(user, new_roles, existing_roles_set)
        self.db.add(user)
        await self.commit_to_db()
        return user

    @repo_handler
    async def delete_user(self, user: UserProfile) -> None:
        await self.db.delete(user)
        await self.commit_to_db()
        logger.info(f"Deleted user with id: {user.user_profile_id}")
        return None

    # TODO: User History pagination implementation if needed
    @repo_handler
    async def get_user_history(self, user_id: int = None) -> List[UserHistorySchema]:
        histories = await self.db.execute(
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

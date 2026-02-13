from typing import List

import structlog
from fastapi import Depends, HTTPException
from sqlalchemy import (
    and_,
    select,
    asc,
    desc,
    union_all,
    literal_column,
    func,
    cast,
    String,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.admin_adjustment.AdminAdjustmentHistory import (
    AdminAdjustmentHistory,
)
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import AdminAdjustmentStatus
from lcfs.db.models.initiative_agreement.InitiativeAgreementHistory import (
    InitiativeAgreementHistory,
)
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatus,
)
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.transfer.TransferStatus import TransferStatus
from lcfs.db.models.user import UserLoginHistory
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.user.UserRole import UserRole
from lcfs.db.models.notification.NotificationChannelSubscription import (
    NotificationChannelSubscription,
)
from lcfs.web.api.base import (
    PaginationRequestSchema,
    camel_to_snake,
    apply_filter_conditions,
    get_field_for_filter,
)
from lcfs.web.api.user.schema import (
    UserCreateSchema,
    UserBaseSchema,
    UserLoginHistorySchema,
)
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class UserRepository:
    EXCLUDED_USER_ACTIVITY_STATUSES = ["Draft"]

    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    def apply_filters(self, pagination, conditions, full_name):
        role_filter_present = False
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filter_type

            if filter.field == "role":
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
                name_filter = full_name.ilike(f"%{filter_value}%")
                conditions.append(name_filter)
            else:
                field = get_field_for_filter(UserProfile, filter.field)
                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                )
        return role_filter_present

    async def find_user_role(self, role_name):
        role_result = await self.db.execute(select(Role).filter(Role.name == role_name))
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
                    user.user_roles.append(await self.find_user_role(new_role))
            elif (
                new_role == RoleEnum.ADMINISTRATOR
                and RoleEnum.ADMINISTRATOR not in existing_roles_set
            ):
                # Add administrator role
                user.user_roles.append(await self.find_user_role(new_role))
            elif (
                new_role == RoleEnum.GOVERNMENT
                and RoleEnum.GOVERNMENT not in existing_roles_set
            ):
                # Add government role
                user.user_roles.append(await self.find_user_role(new_role))

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
                user.user_roles.append(await self.find_user_role(new_role))
            elif (
                new_role == RoleEnum.SUPPLIER
                and RoleEnum.SUPPLIER not in existing_roles_set
            ):
                # Add supplier role
                user.user_roles.append(await self.find_user_role(new_role))
            elif new_role in {
                RoleEnum.COMPLIANCE_REPORTING,
                RoleEnum.MANAGE_USERS,
                RoleEnum.TRANSFER,
                RoleEnum.SIGNING_AUTHORITY,
                RoleEnum.CI_APPLICANT,
                RoleEnum.IA_PROPONENT,
            }:
                if new_role not in existing_roles_set:
                    # Add missing role
                    user.user_roles.append(await self.find_user_role(new_role))
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
                    RoleEnum.CI_APPLICANT,
                    RoleEnum.IA_PROPONENT,
                }
                and user_role.role.name not in new_roles
            ):
                user_roles_to_keep.remove(user_role)
        user.user_roles = user_roles_to_keep

    @repo_handler
    async def get_users_paginated(
        self,
        pagination: PaginationRequestSchema,
    ) -> tuple[list[UserBaseSchema], int]:
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
        full_name = func.concat_ws(" ", UserProfile.first_name, UserProfile.last_name)

        if pagination.filters and len(pagination.filters) > 0:
            try:
                role_filter_present = self.apply_filters(
                    pagination, conditions, full_name
                )
            except Exception as e:
                raise ValueError(f"Invalid filter provided: {pagination.filters}.")

        # Apply pagination and sorting parameters
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size
        # get distinct profile ids from UserProfile
        unique_ids_query = select(
            UserProfile,
            full_name,
        ).where(and_(*conditions))
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
        for order in pagination.sort_orders:
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
    async def get_user_by_username(self, username: str) -> UserProfile:
        query = (
            select(UserProfile)
            .options(
                joinedload(UserProfile.organization),
                joinedload(UserProfile.user_roles).options(joinedload(UserRole.role)),
            )
            .where(UserProfile.keycloak_username == username)
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

        # For IDIR users (no organization), ensure email field matches keycloak_email
        # This is critical for notification delivery
        if not db_user_profile.organization_id:
            if (
                not db_user_profile.email
                or db_user_profile.email != db_user_profile.keycloak_email
            ):
                db_user_profile.email = db_user_profile.keycloak_email

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
        await self.db.flush()
        return db_user_profile

    @repo_handler
    async def update_user(
        self, user: UserProfile, user_update: UserCreateSchema
    ) -> None:
        """
        Update an existing UserProfile with new data.
        """

        # Extract incoming data from the Pydantic schema
        user_data = user_update.model_dump()
        new_roles = user_data.pop("roles", {})

        # Update basic fields directly
        user.email = user_update.email
        user.title = user_update.title
        user.first_name = user_update.first_name
        user.last_name = user_update.last_name
        user.is_active = user_update.is_active
        user.keycloak_email = user_update.keycloak_email
        user.keycloak_username = user_update.keycloak_username
        user.phone = user_update.phone
        user.mobile_phone = user_update.mobile_phone

        # For IDIR users (no organization), ensure email field matches keycloak_email
        # This is critical for notification delivery
        if not user.organization_id:
            if not user.email or user.email != user.keycloak_email:
                user.email = user.keycloak_email

        # Find the RoleEnum member corresponding to each role
        new_role_enums = []
        for role_str in new_roles:
            try:
                name_str = role_str.title()
                role_enum = RoleEnum(name_str)
                new_role_enums.append(role_enum)
            except ValueError:
                pass

        # Create a set for faster membership checks
        existing_roles_set = set(user.role_names)

        if user.organization:
            # BCEID logic
            await self.update_bceid_roles(user, new_role_enums, existing_roles_set)
        else:
            # IDIR logic
            await self.update_idir_roles(user, new_role_enums, existing_roles_set)

        # Add the updated user to the session
        self.db.add(user)
        return user

    @repo_handler
    async def delete_user(self, user: UserProfile) -> None:
        await self.db.delete(user)
        logger.info("Deleted user", user_profile_id=user.user_profile_id)
        return None

    @repo_handler
    async def get_full_name(self, username: str) -> str:
        """
        Fetches the full name of a user based on their username.

        Args:
            username (str): Username of the user whose full name is to be fetched.

        Returns:
            str: The full name of the user.
        """
        full_name_result = await self.db.execute(
            select(
                (UserProfile.first_name + " " + UserProfile.last_name).label(
                    "full_name"
                )
            ).where(UserProfile.keycloak_username == username)
        )
        return full_name_result.scalars().first()

    def _build_activity_queries(self, user_id: int = None):
        """
        Builds the activity queries for user-specific or all-user activity logs.

        Args:
            user_id (Optional[int]): If provided, filters activities for a specific user.

        Returns:
            Tuple: Combined query for user activities, list of relevant conditions.
        """

        # Note: If we encounter performance issues in the future,
        # consider replacing the current UNION ALL with a materialized view to pre-compute the union of activity logs.
        # We also need to add indexes on create_date and other sorting columns to improve performance across the system.

        # TransferHistory Query
        transfer_query = (
            select(
                cast(TransferHistory.transfer_id, String).label("transaction_id"),
                cast(TransferStatus.status, String).label("action_taken"),
                literal_column("'Transfer'").label("transaction_type"),
                TransferHistory.create_date.label("create_date"),
                TransferHistory.user_profile_id.label("user_id"),
            )
            .select_from(TransferHistory)
            .join(
                TransferStatus,
                TransferHistory.transfer_status_id == TransferStatus.transfer_status_id,
            )
            .where(
                cast(TransferStatus.status, String).notin_(
                    self.EXCLUDED_USER_ACTIVITY_STATUSES
                )
            )
        )

        # InitiativeAgreementHistory Query
        initiative_query = (
            select(
                cast(InitiativeAgreementHistory.initiative_agreement_id, String).label(
                    "transaction_id"
                ),
                cast(InitiativeAgreementStatus.status, String).label("action_taken"),
                literal_column("'InitiativeAgreement'").label("transaction_type"),
                InitiativeAgreementHistory.create_date.label("create_date"),
                InitiativeAgreementHistory.user_profile_id.label("user_id"),
            )
            .select_from(InitiativeAgreementHistory)
            .join(
                InitiativeAgreementStatus,
                InitiativeAgreementHistory.initiative_agreement_status_id
                == InitiativeAgreementStatus.initiative_agreement_status_id,
            )
            .where(
                cast(InitiativeAgreementStatus.status, String).notin_(
                    self.EXCLUDED_USER_ACTIVITY_STATUSES
                )
            )
        )

        # AdminAdjustmentHistory Query
        admin_adjustment_query = (
            select(
                cast(AdminAdjustmentHistory.admin_adjustment_id, String).label(
                    "transaction_id"
                ),
                cast(AdminAdjustmentStatus.status, String).label("action_taken"),
                literal_column("'AdminAdjustment'").label("transaction_type"),
                AdminAdjustmentHistory.create_date.label("create_date"),
                AdminAdjustmentHistory.user_profile_id.label("user_id"),
            )
            .select_from(AdminAdjustmentHistory)
            .join(
                AdminAdjustmentStatus,
                AdminAdjustmentHistory.admin_adjustment_status_id
                == AdminAdjustmentStatus.admin_adjustment_status_id,
            )
            .where(
                cast(AdminAdjustmentStatus.status, String).notin_(
                    self.EXCLUDED_USER_ACTIVITY_STATUSES
                )
            )
        )

        # Combine all queries using union_all
        combined_query = union_all(
            transfer_query, initiative_query, admin_adjustment_query
        ).alias("activities")

        # If a specific user_id is provided, filter by that user_id
        conditions = []
        if user_id is not None:
            conditions.append(combined_query.c.user_id == user_id)

        return combined_query, conditions

    async def _get_paginated_user_activities(
        self, combined_query, conditions, pagination
    ):
        """
        Handles pagination, filtering, and sorting for user activities.

        Args:
            combined_query: The SQLAlchemy query for activities.
            conditions: List of conditions to apply to the query.
            pagination: PaginationRequestSchema for pagination and filtering.

        Returns:
            Tuple: List of activities and total count.
        """
        # Apply filters from pagination
        if pagination.filters:
            for filter in pagination.filters:
                field_name = camel_to_snake(filter.field)
                field = getattr(combined_query.c, field_name, None)
                if field is not None:
                    condition = apply_filter_conditions(
                        field, filter.filter, filter.type, filter.filter_type
                    )
                    if condition is not None:
                        conditions.append(condition)

        # Apply ordering
        order_by_clauses = []
        if pagination.sort_orders:
            for sort_order in pagination.sort_orders:
                field_name = camel_to_snake(sort_order.field)
                field = getattr(combined_query.c, field_name, None)
                if field is not None:
                    order = asc(field) if sort_order.direction == "asc" else desc(field)
                    order_by_clauses.append(order)
        else:
            # Default ordering by timestamp descending
            order_by_clauses.append(desc(combined_query.c.create_date))

        # Build the final query with conditions, ordering, and pagination
        final_query = (
            select(combined_query)
            .where(and_(*conditions))
            .order_by(*order_by_clauses)
            .offset((pagination.page - 1) * pagination.size)
            .limit(pagination.size)
        )

        # Execute the query
        result = await self.db.execute(final_query)
        activities = result.fetchall()

        # Get total count for pagination
        count_query = (
            select(func.count()).select_from(combined_query).where(and_(*conditions))
        )
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar()

        return activities, total_count

    @repo_handler
    async def get_user_activities_paginated(
        self, user_id: int, pagination: PaginationRequestSchema
    ) -> List[dict]:
        """
        Fetches major activities for a specific user with pagination and filters,
        excluding specified statuses.
        """
        combined_query, conditions = self._build_activity_queries(user_id=user_id)
        return await self._get_paginated_user_activities(
            combined_query, conditions, pagination
        )

    @repo_handler
    async def get_all_user_activities_paginated(
        self, pagination: PaginationRequestSchema
    ) -> List[dict]:
        """
        Fetches major activities for all users with pagination and filters,
        excluding specified statuses.
        """
        combined_query, conditions = self._build_activity_queries()
        return await self._get_paginated_user_activities(
            combined_query, conditions, pagination
        )

    def _apply_login_history_filters(self, query, pagination):
        """
        Applies filters and sorting orders to the login history query based on the pagination parameters.

        Args:
            query: The SQLAlchemy query for login history.
            conditions: List of conditions to apply to the query.
            pagination: PaginationRequestSchema for pagination and filtering.

        Returns:
            Tuple: The modified query and conditions.
        """
        conditions = []
        if pagination.filters and len(pagination.filters) > 0:
            for filter in pagination.filters:
                filter_value = filter.filter
                filter_option = filter.type
                filter_type = filter.filter_type
                if filter.field == "is_login_successful":
                    filter_option = "true" if filter_value == "Success" else "false"
                    field = get_field_for_filter(
                        UserLoginHistory, "is_login_successful"
                    )
                elif filter.field is not None:
                    field = get_field_for_filter(UserLoginHistory, filter.field)
                if field is not None:
                    condition = apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                    if condition is not None:
                        conditions.append(condition)

        query = query.where(and_(*conditions))
        # Apply ordering
        order_by_clauses = []
        if pagination.sort_orders and len(pagination.sort_orders) > 0:
            for sort_order in pagination.sort_orders:
                field = get_field_for_filter(UserLoginHistory, sort_order.field)
                if field is not None:
                    sort_order = (
                        asc(field) if sort_order.direction == "asc" else desc(field)
                    )
                    order_by_clauses.append(sort_order)
        else:
            # Default ordering by timestamp descending
            order_by_clauses.append(desc(UserLoginHistory.create_date))
        return query.order_by(*order_by_clauses)

    @repo_handler
    async def get_all_user_login_history_paginated(
        self, pagination: PaginationRequestSchema
    ) -> List[UserLoginHistorySchema]:
        """
        Fetches major activities for all users with pagination and filters,
        excluding specified statuses.
        """
        query = self._apply_login_history_filters(select(UserLoginHistory), pagination)
        total_count = len((await self.db.execute(query)).scalars().unique().all())
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size
        result = (
            (await self.db.execute(query.offset(offset).limit(limit)))
            .scalars()
            .unique()
            .all()
        )
        return [
            UserLoginHistorySchema.model_validate(history) for history in result
        ], total_count

    @repo_handler
    async def create_login_history(self, user: UserProfile):
        """
        Creates a user login history entry asynchronously.
        """
        login_history = UserLoginHistory(
            keycloak_email=user.keycloak_email if user.keycloak_email else user.email,
            external_username=user.keycloak_username,
            keycloak_user_id=user.keycloak_user_id,
            is_login_successful=True,
        )

        self.db.add(login_history)

    @repo_handler
    async def update_email(self, user_profile_id: int, email: str) -> UserProfile:
        # Fetch the user profile
        query = select(UserProfile).where(
            UserProfile.user_profile_id == user_profile_id
        )
        result = await self.db.execute(query)
        user_profile = result.scalar_one_or_none()

        user_profile.email = email

        # Flush and refresh without committing
        await self.db.flush()
        await self.db.refresh(user_profile)

        return user_profile

    @repo_handler
    async def is_user_safe_to_remove(self, keycloak_username: str) -> bool:
        """
        Invokes the is_user_safe_to_remove() SQL function,
        returning True if no references exist in create_user/update_user columns.
        """
        query_text = text("SELECT is_user_safe_to_remove(:username) AS safe")
        result = await self.db.execute(query_text, {"username": keycloak_username})
        safe_to_remove = result.scalar()
        return safe_to_remove

    @repo_handler
    async def delete_user(self, user: UserProfile) -> None:
        """
        Deletes the user.
        """
        await self.db.delete(user)
        await self.db.flush()

from logging import getLogger
from typing import List, Optional
from fastapi import Depends

from sqlalchemy import text, and_, func, select, asc, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.db.models.UserProfile import UserProfile
from lcfs.db.models.UserRole import UserRole
from lcfs.db.models.Role import Role
from lcfs.web.api.user.schema import UserCreate
from lcfs.web.api.base import PaginationRequestSchema, row_to_dict
from lcfs.web.api.user.schema import UserBase

logger = getLogger("user_repo")


class UserRepository:
    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def query_users(
        self,
        username: Optional[str] = None,
        organization: Optional[str] = None,
        include_inactive: bool = False,
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
        # Build the base query statement
        conditions = []
        if username:
            conditions.append(
                func.lower(UserProfile.username).like(f"%{username.lower()}%")
            )
        if organization:
            conditions.append(
                func.lower(UserProfile.organization.name).like(
                    f"%{organization.lower()}%"
                )
            )
        # if not include_inactive:
        #     conditions.append(UserProfile.is_active.is_(True))

        # Apply pagination and sorting parameters
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

        # Applying pagination, sorting, and filters to the query
        query = (
            select(UserProfile)
            .options(
                joinedload(UserProfile.organization),
                joinedload(UserProfile.user_roles).options(joinedload(UserRole.role)),
            )
            .where(and_(*conditions))
        )

        total_count = await self.session.scalar(
            select(func.count(UserProfile.user_profile_id)).where(and_(*conditions))
        )
        # Sort the query results
        for order in pagination.sortOrders:
            sort_method = asc if order.direction == "asc" else desc
            query = query.order_by(sort_method(order.field))

        # Execute the query
        user_results = await self.session.execute(query.offset(offset).limit(limit))
        # total_count = query.count()
        results = user_results.scalars().unique().all()

        # Convert the results to UserBase schemas
        return [UserBase.model_validate(user) for user in results], total_count

# TODO: Need to redine search, create and modify endpoints
# async def get_user(self, user_id: int) -> UserBase:
#     """
#     Gets a user by their ID in the database.

#     This method queries the database for a user with a given ID and an active status. If found, it
#     converts the database row to a dictionary matching the UserBase Pydantic model.

#     Args:
#         user_id (int): The unique identifier of the user to be found.

#     Returns:
#         UserBase: The found user's data converted to a UserBase Pydantic model. If no user is found, returns None.
#     """
#     stmt = f"{USER_VIEW_STMT} and u.is_active = true and u.id = :user_id"

#     user_results = await self.session.execute(text(stmt), {"user_id": user_id})

#     user = user_results.fetchone()
#     return row_to_dict(user, UserBase) if user else None

# async def create_user(self, user_create: UserCreate) -> UserProfile:
#     """
#     Creates a new user entity in the database.

#     This method takes a UserCreate Pydantic model, converts it into a dictionary, and then creates a new
#     UserProfile ORM model instance. If an organization is associated with the user, it ensures that the organization_id
#     is set appropriately. The new user is then added to the database session and saved to the database.

#     Args:
#         user_create (UserCreate): The Pydantic model containing the data for the new user.

#     Returns:
#         UserProfile: The ORM model instance of the newly created user.
#     """
#     user_data = user_create.dict(exclude_unset=True, exclude_none=True)

#     if "organization" in user_data:
#         user_data["organization_id"] = user_data.pop("organization").id

#     new_user = UserProfile(**user_data)

#     self.session.add(new_user)
#     await self.session.commit()

#     return new_user

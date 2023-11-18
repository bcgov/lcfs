from logging import getLogger
from typing import List, Optional
from fastapi import Depends

from sqlalchemy import text, and_, func, select, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.db.models.UserProfile import UserProfile
from lcfs.web.api.user.schema import UserCreate
from lcfs.web.api.base import row_to_dict
from lcfs.web.api.user.schema import UserBase
from lcfs.web.api.dependancies import pagination_query

logger = getLogger("user_repo")
USER_VIEW_STMT = "select * from public.user u where 1=1"
USER_COUNT_STMT = "select count(*) from public.user u where 1=1"
# USER_VIEW_STMT = "select * from user_view u where 1=1"
# USER_COUNT_STMT = "select count(*) from user_view u where 1=1"


class UserRepository:

    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_users_count(self) -> int:
        """
        Retrieves the count of all active users in the database.

        Returns:
            int: The number of active users.
        """
        count_query = text(USER_COUNT_STMT)
        count_result = await self.session.execute(count_query)
        count = count_result.fetchone()

        # Extract the count from the first column of the first row.
        # The [0] index accesses the first column in the row.
        user_count = count[0]

        return user_count


    async def query_users(
        self, 
        username: Optional[str] = None,
        organization: Optional[str] = None,
        include_inactive: bool = False,
        pagination: dict = Depends(pagination_query)
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
            conditions.append(func.lower(UserProfile.username).like(f"%{username.lower()}%"))
        if organization:
            conditions.append(func.lower(UserProfile.organization.name).like(f"%{organization.lower()}%"))
        # if not include_inactive:
        #     conditions.append(UserProfile.is_active.is_(True))

        # Sorting direction
        sort_function = desc if pagination["sort_direction"] == "desc" else asc
        sort_field = pagination["sort_field"]
        offset = pagination["page"] * pagination["per_page"]
        limit = pagination["per_page"]

        # Applying pagination, sorting, and filters to the query
        query = (
            select(UserProfile)
            .where(and_(*conditions))
            .order_by(sort_function(getattr(UserProfile, sort_field)))
            .offset(offset)
            .limit(limit)
        )

        # Execute the query
        user_results = await self.session.execute(query)
        results = user_results.scalars().all()

        # Convert the results to UserBase schemas
        return [UserBase.from_orm(user) for user in results]


    async def get_user(self, user_id: int) -> UserBase:
        """
        Gets a user by their ID in the database.

        This method queries the database for a user with a given ID and an active status. If found, it
        converts the database row to a dictionary matching the UserBase Pydantic model.

        Args:
            user_id (int): The unique identifier of the user to be found.

        Returns:
            UserBase: The found user's data converted to a UserBase Pydantic model. If no user is found, returns None.
        """
        stmt = f'{USER_VIEW_STMT} and u.is_active = true and u.id = :user_id'
        
        user_results = await self.session.execute(text(stmt), {'user_id': user_id})
        
        user = user_results.fetchone()
        return row_to_dict(user, UserBase) if user else None


    async def create_user(self, user_create: UserCreate) -> UserProfile:
        """
        Creates a new user entity in the database.

        This method takes a UserCreate Pydantic model, converts it into a dictionary, and then creates a new
        User ORM model instance. If an organization is associated with the user, it ensures that the organization_id
        is set appropriately. The new user is then added to the database session and saved to the database.

        Args:
            user_create (UserCreate): The Pydantic model containing the data for the new user.

        Returns:
            User: The ORM model instance of the newly created user.
        """
        user_data = user_create.dict(exclude_unset=True, exclude_none=True)

        if 'organization' in user_data:
            user_data['organization_id'] = user_data.pop('organization').id

        new_user = UserProfile(**user_data)

        self.session.add(new_user)
        await self.session.commit()

        return new_user

from logging import getLogger
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.base import row_to_dict
from lcfs.web.api.user.schema import UserBase

logger = getLogger("user_repo")
USER_VIEW_STMT = "select * from user_view u where 1=1"
USER_COUNT_STMT = "select count(*) from user_view u where 1=1"


class UserRepository:

    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_users_count(self):
        count_result = await self.session.execute(text(USER_COUNT_STMT))
        return count_result.fetchone()[0]

    async def get_all_users(self, limit, offset, current_user: UserBase=None) -> List[UserBase]:
        # TODO: add sorting, limitation based on user role, organization schema needs to be defined
        logger.info("Getting all users from repository")
        stmt = f'{USER_VIEW_STMT} and u.is_active = true limit {limit} offset {offset}'
        user_results = await self.session.execute(text(stmt))
        results = user_results.fetchall()
        if results.__len__() == 0:
            return []
        return [row_to_dict(user, UserBase) for user in results]

    async def get_user(self, user_id) -> UserBase:
        logger.info("Getting user by id from repository")
        stmt = f'{USER_VIEW_STMT} and u.is_active = true and u.id = {user_id}'
        user_results = await self.session.execute(text(stmt))
        return row_to_dict(user_results.fetchone(), UserBase)

    async def search_users(self, username, organization, surname, include_inactive) -> List[UserBase]:
        # TODO: add pagination, add sorting, add organization search capability
        logger.info("Searching users from repository")
        stmt = USER_VIEW_STMT
        if username is not None:
            stmt += f" and lower(u.username) like lower('%{username}%')"
        # yet to implement Organization
        # if organization is not None:
        #     stmt += f' and lower(u.organization) like lower("%{organization}%")'
        if surname is not None:
            stmt += f" and lower(u.surname) like lower('%{surname}%')"
        if not include_inactive:
            stmt += ' and u.is_active = true'
        user_results = await self.session.execute(text(stmt))
        results = user_results.fetchall()
        if results.__len__() == 0:
            return []
        return [row_to_dict(user, UserBase) for user in results]

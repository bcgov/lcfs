from logging import getLogger
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.base_schema import row_to_dict
from lcfs.web.api.user.schema import UserSchema

logger = getLogger("role")
user_stmt = "select id, title, first_name, last_name, email, username, display_name, " \
            "is_active, phone, cell_phone, ( select json_agg(row_to_json(temp_roles)) " \
            " from ( select r.id, r.name, r.description, r.is_government_role " \
            "from role r inner join user_role ur on ur.user_id = u.id and ur.role_id = r.id ) " \
            "as temp_roles )::json as roles, ( select json_agg(row_to_json(temp_permissions)) " \
            " from ( select p.id, p.code, p.name, p.description from role r " \
            "inner join user_role ur on ur.user_id = u.id and ur.role_id = r.id " \
            "inner join role_permission rp on rp.role_id = r.id inner join permission p " \
            "on p.id = rp.permission_id ) as temp_permissions )::json as permissions, " \
            "coalesce( ( select r.is_government_role from role r inner join user_role ur " \
            "on u.id = ur.user_id and r.id = ur.role_id " \
            "where r.is_government_role = true limit 1 ), false ) as is_government_user " \
            ", null as organization " \
            " from public.user u where 1=1"

user_stmt_count = "select count(*) from public.user u where 1=1"


class UserRepository:

    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_users_count(self):
        count_result = await self.session.execute(text(user_stmt_count))
        return count_result.fetchone()[0]

    async def get_all_users(self, limit, offset, current_user=None) -> List[UserSchema]:
        # TODO: add sorting, limitation based on user role
        logger.info("Getting all users from repository")
        stmt = f'{user_stmt} and u.is_active = true limit {limit} offset {offset}'
        user_results = await self.session.execute(text(stmt))
        results = user_results.fetchall()
        if results.__len__() == 0:
            return []
        return [row_to_dict(user, UserSchema) for user in results]

    async def get_user(self, user_id) -> UserSchema:
        logger.info("Getting user by id from repository")
        stmt = f'{user_stmt} and u.is_active = true and u.id = {user_id}'
        user_results = await self.session.execute(text(stmt))
        return row_to_dict(user_results.fetchone(), UserSchema)

    async def search_users(self, username, organization, surname, include_inactive) -> List[UserSchema]:
        # TODO: add pagination, add sorting, add organization search capability
        logger.info("Searching users from repository")
        stmt = user_stmt
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
        return [row_to_dict(user, UserSchema) for user in results]

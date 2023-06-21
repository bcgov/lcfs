from logging import getLogger
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.user.schema import UserSchema

logger = getLogger("role")
user_stmt = "select id, title, first_name, last_name, email, username, display_name, " \
            "is_active, phone, cell_phone, ( select json_agg(row_to_json(temp_roles)) " \
            "as roles from ( select r.id, r.name, r.description, r.is_government_role " \
            "from role r inner join user_role ur on ur.user_id = u.id and ur.role_id = r.id ) " \
            "as temp_roles )::json as roles, ( select json_agg(row_to_json(temp_permissions)) " \
            "as permissions from ( select p.id, p.code, p.name, p.description from role r " \
            "inner join user_role ur on ur.user_id = u.id and ur.role_id = r.id " \
            "inner join role_permission rp on rp.role_id = r.id inner join permission p " \
            "on p.id = rp.permission_id ) as temp_permissions )::json as permissions, " \
            "coalesce( ( select r.is_government_role from role r inner join user_role ur " \
            "on u.id = ur.user_id and r.id = ur.role_id " \
            "where r.is_government_role = true limit 1 ), false ) from public.user u"


class UserRepository:

    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_all_users(self, current_user=None) -> List[UserSchema]:
        logger.info("Getting all users from repository")
        stmt = f'{user_stmt} where u.is_active = true'
        user_results = await self.session.execute(text(stmt))
        results = user_results.fetchall()
        if results.__len__() == 0:
            return []
        users: List[UserSchema] = []
        for user in results:
            users.append(UserSchema(id=user[0], title=user[1], first_name=user[2],
                                    last_name=user[3], email=user[4], username=user[5],
                                    display_name=user[6],
                                    is_active=user[7], phone=user[8],
                                    cell_phone=user[9], roles=user[10],
                                    permissions=user[11], is_government_role=user[12]))
        return users

    async def get_user(self, user_id):
        logger.info("Getting user by id from repository")
        stmt = f'{user_stmt} where u.is_active = true and u.id = {user_id}'
        user_results = await self.session.execute(text(stmt))
        results = user_results.fetchall()
        if results.__len__() == 0:
            return None
        user: UserSchema = UserSchema(id=results[0][0], title=results[0][1],
                                      first_name=results[0][2],
                                      last_name=results[0][3], email=results[0][4],
                                      username=results[0][5],
                                      display_name=results[0][6],
                                      is_active=results[0][7], phone=results[0][8],
                                      cell_phone=results[0][9], roles=results[0][10],
                                      permissions=results[0][11],
                                      is_government_role=results[0][12])
        return user

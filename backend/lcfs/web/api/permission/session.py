from logging import getLogger
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.web.api.base_schema import row_to_dict
from lcfs.web.api.permission.schema import PermissionSchema

logger = getLogger("permission")


class PermissionRepository:
    def __init__(self, session: AsyncSession, request: Request = None):
        self.session = session
        self.request = request

    async def get_all_permissions(self) -> List[PermissionSchema]:
        logger.info("Getting all permissions from repository")
        stmt = "Select id, code, name, description from permission"
        results = await self.session.execute(text(stmt))
        results = results.fetchall()
        if results.__len__() == 0:
            return []
        return [row_to_dict(permission, PermissionSchema) for permission in results]

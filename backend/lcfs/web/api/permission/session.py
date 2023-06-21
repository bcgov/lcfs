from logging import getLogger
from typing import List

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from lcfs.db.models.Permission import Permission
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
        permissions: List[PermissionSchema] = []
        for permission in results:
            permissions.append(PermissionSchema(id=permission[0], code=permission[1], name=permission[2],
                                                 description=permission[3]))
        return permissions

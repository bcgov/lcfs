from logging import getLogger

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session

from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = getLogger("organization_repo")


class OrganizationRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    
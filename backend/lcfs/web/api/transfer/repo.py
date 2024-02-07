from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.db.models.Transfer import Transfer

logger = getLogger("transfer_repo")


class TransferRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def create_transfer(self, new_transfer: Transfer):
        '''
        Create and save a new transfer in the database
        '''
        async with self.db.begin():
            
            self.db.add(new_transfer)
            await self.db.flush()
            
            return new_transfer

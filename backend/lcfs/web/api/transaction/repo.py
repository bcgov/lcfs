# transactions/repo.py

from typing import List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.future import select
from fastapi import Depends

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

class TransactionsRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_combined_transactions_paginated(self, page: int, size: int) -> List[Any]:
        offset = (page - 1) * size
        combined_query = text("""
        (SELECT 'Transfer' AS type, transfer_id AS id, create_date FROM Transfer)
        UNION ALL
        (SELECT 'Issuance' AS type, issuance_id AS id, create_date FROM Issuance)
        ORDER BY create_date DESC
        LIMIT :size OFFSET :offset
        """)
        results = await self.db.execute(combined_query, {'size': size, 'offset': offset})
        combined_list = results.fetchall()
        return combined_list

# transactions/repo.py

from typing import List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.future import select
from fastapi import Depends

from sqlalchemy import select, func, desc, asc, and_

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.TransactionView import TransactionView
from lcfs.db.models.TransactionStatusView import TransactionStatusView


class TransactionRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_transactions_paginated(self, offset: int, limit: int, conditions: list, sort_orders: list):
        """
        Fetch paginated, filtered, and sorted transactions.
        
        Args:
            offset (int): Pagination offset.
            limit (int): Pagination limit.
            conditions (list): Filtering conditions.
            sort_orders (list): Sorting orders.
        
        Returns:
            A tuple of (list of TransactionView instances, total count).
        """

        # Construct the base query
        query = select(TransactionView).where(and_(*conditions))

        # Apply sorting
        for order in sort_orders:
            direction = asc if order.direction == 'asc' else desc
            query = query.order_by(direction(getattr(TransactionView, order.field)))

        # Execute count query for total records matching the filter
        count_query = select(func.count()).select_from(query.subquery())
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar_one()

        # Apply pagination
        query = query.offset(offset).limit(limit)

        # Execute the query
        result = await self.db.execute(query)
        transactions = result.scalars().all()

        return transactions, total_count


    @repo_handler
    async def get_transaction_statuses(self) -> List[TransactionStatusView]:
        """
        Get all available statuses for transactions from the database.

        Returns:
            List[TransactionStatusView]: A list of TransactionStatusView objects containing the basic transaction status details.
        """
        query = select(TransactionStatusView).order_by(asc(TransactionStatusView.status)).distinct()
        status_results = await self.db.execute(query)
        return status_results.scalars().all()
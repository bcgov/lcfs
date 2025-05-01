import structlog
from typing import Optional

from fastapi import Depends
from sqlalchemy import func, select, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.db.models.transaction.CreditLedgerView import CreditLedgerView

log = structlog.get_logger(__name__)


class CreditLedgerRepository:

    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
    ):
        self.db = db

    @repo_handler
    async def get_rows_paginated(
        self,
        *,
        offset: int,
        limit: Optional[int],
        conditions: list,
        sort_orders: list,
    ):
        # Base query
        stmt = select(CreditLedgerView).where(and_(*conditions))

        # Sort and order
        for order in sort_orders:
            direction = asc if order.direction == "asc" else desc
            stmt = stmt.order_by(direction(getattr(CreditLedgerView, order.field)))
        if not sort_orders:
            stmt = stmt.order_by(CreditLedgerView.update_date.desc())

        # Count before pagination
        total = await self.db.scalar(select(func.count()).select_from(stmt.subquery()))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)

        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total or 0

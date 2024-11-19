from typing import Optional, List
from fastapi import Depends
from sqlalchemy import select, desc, asc, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.audit.AuditLog import AuditLog
from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.base import (
    get_field_for_filter,
    SortOrder,
)


class AuditLogRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_audit_logs_paginated(
        self,
        offset: int,
        limit: Optional[int],
        conditions: List = [],
        sort_orders: List[SortOrder] = [],
    ):
        """
        Fetches paginated, filtered, and sorted audit logs.
        """
        query = select(AuditLog).where(and_(*conditions))

        # Apply sorting
        if sort_orders:
            for order in sort_orders:
                direction = asc if order.direction == "asc" else desc
                field = get_field_for_filter(AuditLog, order.field)
                if field is not None:
                    query = query.order_by(direction(field))
        else:
            # Default sorting by create_date descending
            query = query.order_by(desc(AuditLog.create_date))

        # Get total count for pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_count_result = await self.db.execute(count_query)
        total_count = total_count_result.scalar_one()

        # Apply pagination
        query = query.offset(offset).limit(limit)

        # Execute the query
        result = await self.db.execute(query)
        audit_logs = result.scalars().all()

        return audit_logs, total_count

    @repo_handler
    async def get_audit_log_by_id(self, audit_log_id: int) -> Optional[AuditLog]:
        """
        Retrieves an audit log entry by its ID.
        """
        query = select(AuditLog).where(AuditLog.audit_log_id == audit_log_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

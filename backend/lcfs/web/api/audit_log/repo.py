from typing import Optional, List
from fastapi import Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.audit.AuditLog import AuditLog
from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.base import (
    PaginatedQueryBuilder,
    paginate_with_window_count,
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
        builder = PaginatedQueryBuilder(AuditLog)
        query = builder.apply_sorting(query, sort_orders, default_field="create_date")

        return await paginate_with_window_count(self.db, query, offset, limit)

    @repo_handler
    async def get_audit_log_by_id(self, audit_log_id: int) -> Optional[AuditLog]:
        """
        Retrieves an audit log entry by its ID.
        """
        query = select(AuditLog).where(AuditLog.audit_log_id == audit_log_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

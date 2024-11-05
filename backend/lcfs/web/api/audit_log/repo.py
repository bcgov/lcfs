from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from lcfs.db.models.audit.AuditLog import AuditLog
from lcfs.web.core.decorators import repo_handler
from sqlalchemy.dialects.postgresql import dialect  # Import dialect for compiling with Postgres


class AuditLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_audit_log(
        self, table_name: Optional[str] = None, operation: Optional[str] = None
    ) -> List[AuditLog]:
        query = select(AuditLog)
        if table_name:
            query = query.where(AuditLog.table_name == table_name)
        if operation:
            query = query.where(AuditLog.operation == operation)
        
         # Order by created_at in descending order and limit to 1
        query = query.order_by(AuditLog.create_date.desc()).limit(1)

        result = await self.session.execute(query)
        return result.scalars().first()
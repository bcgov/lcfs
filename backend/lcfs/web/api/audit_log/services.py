from typing import List, Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.core.decorators import service_handler
from .repo import AuditLogRepository
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.audit.AuditLog import AuditLog

class AuditLogService:
    def __init__(self, session: AsyncSession = Depends(get_async_db_session)):
        self.repo = AuditLogRepository(session)
    
    async def get_audit_log(
        self, table_name: Optional[str] = None, operation: Optional[str] = None
    ) -> List[AuditLog]:
        return await self.repo.get_audit_log(table_name, operation)
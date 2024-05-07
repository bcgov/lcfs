from fastapi import Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.AdminAdjustment import AdminAdjustment
from lcfs.db.models.AdminAdjustmentStatus import AdminAdjustmentStatus
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentCreateSchema

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

class AdminAdjustmentRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    async def get_admin_adjustment_by_id(self, admin_adjustment_id: int) -> Optional[AdminAdjustment]:
        query = select(AdminAdjustment).where(AdminAdjustment.admin_adjustment_id == admin_adjustment_id)
        result = await self.db.execute(query)
        return result.scalars().first()

    async def create_admin_adjustment(self, admin_adjustment: AdminAdjustment) -> AdminAdjustment:
        self.db.add(admin_adjustment)
        await self.db.flush()
        return admin_adjustment

    async def update_admin_adjustment(self, admin_adjustment: AdminAdjustment) -> AdminAdjustment:
        merged_admin_adjustment = await self.db.merge(admin_adjustment)
        await self.db.flush()
        return merged_admin_adjustment

    async def get_admin_adjustment_status_by_name(self, status_name: str) -> AdminAdjustmentStatus:
        """
        Fetches the Admin Adjustment status by its name.
        """
        query = await self.db.execute(
            select(AdminAdjustmentStatus).where(AdminAdjustmentStatus.status == status_name)
        )
        status = query.scalars().first()
        
        if not status:
            raise DataNotFoundException(f"Admin Adjustment status '{status_name}' not found")
        
        return status
from typing import List
from fastapi import Depends, Request
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.models.tasks import ScheduledTask
import structlog

logger = structlog.get_logger(__name__)


class TaskRepository:
    def __init__(
        self,
        session: AsyncSession = Depends(get_async_db_session),
        request: Request = None,
    ):
        self.session = session
        self.request = request

    @repo_handler
    async def get_tasks(self, enabled=True) -> List[ScheduledTask]:
        query = select(ScheduledTask)
        if enabled:
            query = query.where(ScheduledTask.is_enabled == True)
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_task_by_id(self, task_id: int) -> ScheduledTask:
        query = select(ScheduledTask).where(ScheduledTask.id == task_id)
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_task_by_name(self, task_name: str) -> ScheduledTask:
        query = select(ScheduledTask).where(ScheduledTask.name == task_name)
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def create_task(self, task: ScheduledTask):
        self.db.add(task)
        await self.db.refresh(task)
        return task

    @repo_handler
    async def update_task(self, task: ScheduledTask):
        return await self.db.refresh(task)

    @repo_handler
    async def delete_task(self, task: ScheduledTask):
        await self.db.delete(task)
        return task

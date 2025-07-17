import datetime
from typing import List
import croniter
from fastapi import Depends
from lcfs.web.api.tasks.repo import TaskRepository
from lcfs.db.models.tasks import ScheduledTask
from lcfs.web.api.tasks.schema import TaskCreate, TaskResponse, TaskUpdate
from lcfs.web.core.decorators import service_handler


class TaskService:
    def __init__(self, repo: TaskRepository = Depends(TaskRepository)):
        self.repo = repo

    @service_handler
    async def list_tasks(self, enabled=True) -> List[TaskResponse]:
        tasks = await self.repo.get_tasks(enabled=enabled)
        return [TaskResponse.model_validate(task) for task in tasks]

    @service_handler
    async def get_task_by_id(self, task_id: int) -> TaskResponse:
        task = await self.repo.get_task(task_id)
        return TaskResponse.model_validate(task)

    @service_handler
    async def create_task(self, task: TaskCreate) -> TaskResponse:
        if not croniter.is_valid(task.schedule):
            raise ValueError("Invalid cron schedule")

        # Check if task name already exists
        existing = await self.repo.get_task_by_name(task.name)
        if existing:
            raise ValueError("Task name already exists")
        # Calculate next run time
        next_run = croniter(task.schedule, datetime.now()).get_next(datetime)
        task = ScheduledTask(**task.model_dump(), next_run=next_run)
        return await self.repo.create_task(task)

    @service_handler
    async def update_task(self, task_id: int, task_update: TaskUpdate) -> TaskResponse:
        if not croniter.is_valid(task.schedule):
            raise ValueError("Invalid cron schedule")

        # Check if task already exists
        existing = await self.repo.get_task_by_id(task_id)
        if not existing:
            raise ValueError("Task does not exist")
        task = ScheduledTask(**task_update.model_dump())
        # Re-calculate next run time if schedule changed
        if task_update.schedule != existing.schedule:
            task.next_run = croniter(task.schedule, datetime.now()).get_next(datetime)
        return await self.repo.update_task(task)

    @service_handler
    async def delete_rask(self, task_id: int):
        task = self.repo.get_task_by_id(task_id)
        if not task:
            raise ValueError("Task does not exist")
        return await self.repo.delete_task(task)

    @service_handler
    async def run_task(self, task_id: int) -> TaskResponse:
        task = await self.repo.get_task(task_id)
        if not task:
            raise ValueError("Task does not exist")
        task.last_run = datetime.now()
        task.next_run = croniter(task.schedule, task.last_run).get_next(datetime)
        await self.repo.update_task(task)
        return TaskResponse.model_validate(task)

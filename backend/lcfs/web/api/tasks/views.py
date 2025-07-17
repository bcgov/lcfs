from fastapi import APIRouter, Depends, HTTPException, Query, Request
from lcfs.db.models.tasks import ScheduledTask, TaskExecution
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.tasks.schema import TaskCreate, TaskResponse, TaskUpdate
from lcfs.web.api.tasks.services import TaskService
from lcfs.web.core.decorators import view_handler
from sqlalchemy.orm import Session
from typing import List, Optional
from croniter import croniter

router = APIRouter()


@router.get("/", response_model=List[TaskResponse])
@view_handler([RoleEnum.ADMINISTRATOR])
async def list_tasks(
    request: Request,
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    service: TaskService = Depends(),
):
    """List all scheduled tasks"""
    return await service.list_tasks(enabled=enabled)


@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    service: TaskService = Depends(),
):
    """Create a new scheduled task"""
    return await service.create_task(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    service: TaskService = Depends(),
):
    """Get specific task by ID"""
    return await service.get_task_by_id(task_id)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    service: TaskService = Depends(),
):
    """Update existing task"""
    return await service.update_task(task_id, task_update)


# @router.delete("/{task_id}")
# async def delete_task(
#     task_id: int,
#     service: TaskService = Depends(),
# ):
#     """Delete task"""
#     task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
#     if not task:
#         raise HTTPException(status_code=404, detail="Task not found")

#     db.delete(task)
#     db.commit()

#     return {"message": "Task deleted successfully"}


# @router.post("/{task_id}/enable")
# async def enable_task(
#     task_id: int,
#     service: TaskService = Depends(),
# ):
#     """Enable task"""
#     task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
#     if not task:
#         raise HTTPException(status_code=404, detail="Task not found")

#     task.enabled = True
#     db.commit()

#     return {"message": "Task enabled successfully"}


# @router.post("/{task_id}/disable")
# async def disable_task(
#     task_id: int,
#     service: TaskService = Depends(),
# ):
#     """Disable task"""
#     task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
#     if not task:
#         raise HTTPException(status_code=404, detail="Task not found")

#     task.enabled = False
#     db.commit()

#     return {"message": "Task disabled successfully"}


# @router.post("/{task_id}/trigger")
# async def trigger_task_now(
#     task_id: int,
#     service: TaskService = Depends(),
# ):
#     """Manually trigger task execution"""
#     task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
#     if not task:
#         raise HTTPException(status_code=404, detail="Task not found")

#     # This would trigger immediate execution
#     # Implementation depends on your scheduler architecture

#     return {"message": f"Task {task.name} triggered for immediate execution"}


# @router.get("/{task_id}/executions")
# async def get_task_executions(
#     task_id: int,
#     limit: int = Query(10, ge=1, le=100),
#     service: TaskService = Depends(),
# ):
#     """Get recent executions for a task"""
#     executions = (
#         db.query(TaskExecution)
#         .filter(TaskExecution.task_id == task_id)
#         .order_by(TaskExecution.started_at.desc())
#         .limit(limit)
#         .all()
#     )

#     return executions

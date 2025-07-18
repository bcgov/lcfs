from datetime import datetime
from typing import Any, Dict, Optional

from lcfs.web.api.base import BaseSchema


class TaskCreate(BaseSchema):
    """Create new task"""

    name: str
    description: Optional[str] = None
    schedule: str  # Cron expression
    timezone: str = "UTC"
    is_enabled: bool = True
    task_function: str
    parameters: Optional[Dict[str, Any]] = None
    max_retries: int = 3
    timeout_seconds: int = 300


class TaskUpdate(BaseSchema):
    """Update existing task"""

    description: Optional[str] = None
    schedule: Optional[str] = None
    timezone: Optional[str] = None
    is_enabled: Optional[bool] = None
    parameters: Optional[Dict[str, Any]] = None
    max_retries: Optional[int] = None
    timeout_seconds: Optional[int] = None


class TaskResponse(BaseSchema):
    """Task response model"""

    id: int
    name: str
    description: Optional[str]
    schedule: str
    timezone: str
    is_enabled: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    status: str
    execution_count: int
    failure_count: int
    task_function: str
    parameters: Optional[Dict[str, Any]]
    create_date: datetime
    update_date: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True

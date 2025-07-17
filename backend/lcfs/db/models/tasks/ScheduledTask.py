from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from enum import Enum

Base = declarative_base()


class TaskStatus(str, Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    DISABLED = "disabled"


class ScheduledTask(BaseModel, Auditable):
    """
    Enhanced task model for dynamic scheduling
    """

    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Scheduling
    schedule = Column(String(100), nullable=False)  # Cron expression
    timezone = Column(String(50), default="UTC")
    is_enabled = Column(Boolean, default=True, index=True)

    # Execution tracking
    last_run = Column(DateTime(timezone=True), nullable=True)
    next_run = Column(DateTime(timezone=True), nullable=True)  # Calculated field
    status = Column(String(20), default=TaskStatus.PENDING)
    execution_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)

    # Configuration
    task_function = Column(String(200), nullable=False)  # Function name in registry
    parameters = Column(JSON, nullable=True)  # Task-specific parameters
    max_retries = Column(Integer, default=3)
    timeout_seconds = Column(Integer, default=300)  # 5 minutes default

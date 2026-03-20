from lcfs.db.base import Base, get_current_user
from sqlalchemy import (
    JSON,
    TIMESTAMP,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    func,
    text,
)
from enum import Enum


class TaskStatus(str, Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    DISABLED = "disabled"


class ScheduledTask(Base):
    """
    Enhanced task model for dynamic scheduling
    """

    __tablename__ = "scheduled_tasks"
    __table_args__ = {"comment": "Represents an scheduled batch tasks"}

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

    create_date = Column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        comment="Date and time (UTC) when the physical record was created in the database.",
    )
    update_date = Column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        onupdate=func.now(),
        comment="Date and time (UTC) when the physical record was updated in the database.",
    )
    create_user = Column(
        String,
        default=get_current_user,
        comment="The user who created this record in the database.",
    )
    update_user = Column(
        String,
        default=get_current_user,
        onupdate=get_current_user,
        comment="The user who last updated this record in the database.",
    )

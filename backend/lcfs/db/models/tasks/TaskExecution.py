from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import Column, DateTime, Integer, String, Text, func


class TaskExecution(BaseModel, Auditable):
    """
    Track individual task executions for monitoring and debugging
    """

    __tablename__ = "task_executions"
    __table_args__ = {"comment": "Represents an scheduled batch tasks"}

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, index=True, nullable=False)

    # Execution details
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False)

    # Results
    result = Column(Text, nullable=True)  # Success result or error message
    execution_time_seconds = Column(Integer, nullable=True)

    # Environment
    worker_id = Column(String(100), nullable=True)  # Pod/worker identifier
    version = Column(String(50), nullable=True)  # App version

from lcfs.db.base import Base, get_current_user
from sqlalchemy import Column, DateTime, Integer, String, TIMESTAMP, Text, func, text


class TaskExecution(Base):
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

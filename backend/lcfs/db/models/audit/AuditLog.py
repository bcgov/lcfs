from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import (
    Integer,
    Column,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB


class AuditLog(BaseModel, Auditable):
    """
    Audit log capturing changes to database tables.

    As the table grows, consider implementing automatic archiving (e.g., moving older logs to an archive table)
    and purging (e.g., deleting logs after a retention period) using tools like `pg_cron` or external schedulers.

    Archiving:
    - Create an `audit_log_archive` table with the same structure as `audit_log`.
    - Use a scheduled job (e.g., with `pg_cron`) to move records older than a certain threshold (e.g., 1 month) from `audit_log` to `audit_log_archive`.
    - Alternatively, consider creating date-based archive tables (e.g., audit_log_archive_2025_01) to organize logs by time periods.

    Purging:
    - Use a scheduled job (e.g., with `pg_cron`) to delete records older than a defined retention period (e.g., 1 year) from `audit_log_archive`.
    """

    __tablename__ = "audit_log"
    __table_args__ = {"comment": "Track changes in defined tables."}

    audit_log_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for each audit log entry.",
    )
    table_name = Column(
        Text,
        nullable=False,
        comment="Name of the table where the action occurred.",
    )
    operation = Column(
        Text,
        nullable=False,
        comment="Type of operation: 'INSERT', 'UPDATE', or 'DELETE'.",
    )
    row_id = Column(
        JSONB,
        nullable=False,
        comment="Primary key of the affected row, stored as JSONB to support composite keys.",
    )
    old_values = Column(
        JSONB,
        nullable=True,
        comment="Previous values before the operation.",
    )
    new_values = Column(
        JSONB,
        nullable=True,
        comment="New values after the operation.",
    )
    delta = Column(
        JSONB,
        nullable=True,
        comment="JSONB delta of the changes.",
    )

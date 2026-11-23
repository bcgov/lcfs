import enum

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, DisplayOrder


class LCJFIPApplicationStatusEnum(enum.Enum):
    """Mirrors the rows seeded into ``lcjfip_application_status``."""

    Draft = "Draft"
    Submitted = "Submitted"
    Approved = "Approved"
    Rejected = "Rejected"


class LCJFIPApplicationStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "lcjfip_application_status"
    __table_args__ = {
        "comment": "Lookup table for LCJFIP application workflow statuses."
    }

    lcjfip_application_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the LCJFIP application status.",
    )
    status = Column(
        String(100),
        nullable=False,
        unique=True,
        comment="Status value (e.g. Draft, Submitted, Approved, Rejected).",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Description of the status.",
    )

    applications = relationship("LCJFIPApplication", back_populates="status")

    def __repr__(self) -> str:
        return f"<LCJFIPApplicationStatus(id={self.lcjfip_application_status_id}, status={self.status})>"

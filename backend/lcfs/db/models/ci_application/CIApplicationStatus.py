from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class CIApplicationStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "ci_application_status"
    __table_args__ = {
        "comment": "Lookup table for CI application workflow statuses"
    }

    ci_application_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the CI application status",
    )
    status = Column(
        String(100),
        nullable=False,
        comment=(
            "Status value (e.g. Draft, Submitted, Completed, Withdrawn)"
        ),
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Optional description of the status",
    )

    ci_applications = relationship("CIApplication", back_populates="ci_application_status")

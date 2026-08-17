from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class EvidenceSubmissionStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "evidence_submission_status"
    __table_args__ = {
        "comment": "Lookup table for evidence submission review statuses"
    }

    evidence_submission_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the evidence submission status",
    )
    status = Column(
        String(100),
        nullable=False,
        comment=(
            "Status value (e.g. Submitted, Under review, Accepted, Rejected)"
        ),
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Optional description of the status",
    )

    evidence_submissions = relationship(
        "EvidenceSubmission", back_populates="current_status"
    )

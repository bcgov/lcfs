from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, Versioning


class CIApplicationHistory(BaseModel, Auditable, Versioning):
    __tablename__ = "ci_application_history"
    __table_args__ = {
        "comment": "Audit trail capturing snapshots of CI application state at each change"
    }

    ci_application_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the history record",
    )
    ci_application_id = Column(
        Integer,
        ForeignKey("ci_application.ci_application_id"),
        nullable=False,
        comment="CI application this history record belongs to",
    )
    status_id = Column(
        Integer,
        ForeignKey("ci_application_status.ci_application_status_id"),
        nullable=True,
        comment="Status of the CI application at the time this history record was created",
    )
    ci_application_snapshot = Column(
        JSONB,
        nullable=True,
        comment="Complete snapshot of the CI application (and its pathways) at the time of change",
    )

    ci_application = relationship(
        "CIApplication",
        back_populates="history_records",
        lazy="selectin",
    )
    status = relationship(
        "CIApplicationStatus",
        lazy="selectin",
    )

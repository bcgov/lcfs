from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class LCJFIPApplicationHistory(BaseModel, Auditable):
    __tablename__ = "lcjfip_application_history"
    __table_args__ = {
        "comment": (
            "Status timeline of LCJFIP applications. Each row records a status "
            "change, who made it, and a snapshot of the application at that time."
        )
    }

    lcjfip_application_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the history record.",
    )
    lcjfip_application_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_application.lcjfip_application_id",
            name="fk_lcjfip_application_history_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
        comment="LCJFIP application this history record belongs to.",
    )
    status_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_application_status.lcjfip_application_status_id",
            name="fk_lcjfip_application_history_status_id",
        ),
        nullable=False,
        comment="Status the application moved into.",
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who made the status change.",
    )
    application_snapshot = Column(
        JSONB,
        nullable=True,
        comment="Snapshot of the application, its purchase details and the applicant contact at the time of the change.",
    )

    application = relationship("LCJFIPApplication", back_populates="history_records")
    status = relationship("LCJFIPApplicationStatus", lazy="selectin")
    user_profile = relationship("UserProfile", lazy="selectin")

    def __repr__(self) -> str:
        return f"<LCJFIPApplicationHistory(id={self.lcjfip_application_history_id}, application_id={self.lcjfip_application_id})>"

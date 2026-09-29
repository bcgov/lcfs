from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class DesignatedActionStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "designated_action_status"
    __table_args__ = {
        "comment": "Lookup table for designated action completion statuses"
    }

    designated_action_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the designated action status",
    )
    status = Column(
        String(100),
        nullable=False,
        comment="Status value (e.g. Not started, In progress, Complete)",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Optional description of the status",
    )

    designated_actions = relationship(
        "DesignatedAction", back_populates="current_status"
    )

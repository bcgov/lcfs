from sqlalchemy import Column, Integer, ForeignKey, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates


class AdminAdjustmentHistory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "admin_adjustment_history"
    __table_args__ = (
        {"comment": "History record for admin_adjustment status change."},
    )

    admin_adjustment_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the admin_adjustment history record",
    )
    admin_adjustment_id = Column(
        Integer, ForeignKey("admin_adjustment.admin_adjustment_id")
    )
    admin_adjustment_status_id = Column(
        Integer, ForeignKey("admin_adjustment_status.admin_adjustment_status_id")
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        comment="Foreign key to user_profile",
    )
    display_name = Column(
        String(255),
        comment="Display name for the admin_adjustment history record",
        nullable=True
    )

    admin_adjustment = relationship("AdminAdjustment", back_populates="history")
    admin_adjustment_status = relationship("AdminAdjustmentStatus")
    user_profile = relationship("UserProfile")

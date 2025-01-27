from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, Text, String, ForeignKey
from sqlalchemy.orm import relationship


class NotificationType(BaseModel, Auditable):
    __tablename__ = "notification_type"
    __table_args__ = {"comment": "Represents a Notification type"}

    # Columns
    notification_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the notification type",
    )
    name = Column(
        String(255), nullable=False, comment="The name of the notification type"
    )
    description = Column(
        Text, nullable=True, comment="Detailed description of the notification type"
    )
    email_content = Column(
        Text,
        nullable=True,
        comment="The email content template for this notification type",
    )
    role_id = Column(
        Integer,
        ForeignKey("role.role_id"),
        comment="Foreign key referencing the Role table",
    )

    # Relationships
    subscriptions = relationship(
        "NotificationChannelSubscription", back_populates="notification_type"
    )
    role = relationship("Role", back_populates="notification_type_roles")

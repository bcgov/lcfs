import enum
from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, Text, String
from sqlalchemy.orm import relationship


class NotificationType(BaseModel, Auditable):
    __tablename__ = "notification_type"
    __table_args__ = {"comment": "Represents a Notification type"}

    notification_type_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    email_content = Column(Text, nullable=True)

    subscriptions = relationship(
        "NotificationChannelSubscription", back_populates="notification_type"
    )

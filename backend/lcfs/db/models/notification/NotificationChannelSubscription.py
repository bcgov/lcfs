from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship


class NotificationChannelSubscription(BaseModel, Auditable):
    __tablename__ = "notification_channel_subscription"
    __table_args__ = (
        UniqueConstraint(
            "user_profile_id", "notification_channel_id", "notification_type_id",
            name="uq_user_channel_type"
        ),
        {"comment": "Represents a user's subscription to notification events"},
    )

    notification_channel_subscription_id = Column(
        Integer, primary_key=True, autoincrement=True
    )

    is_enabled = Column(Boolean, default=False)

    user_profile_id = Column(Integer, ForeignKey("user_profile.user_profile_id"))
    notification_type_id = Column(
        Integer, ForeignKey("notification_type.notification_type_id")
    )
    notification_channel_id = Column(
        Integer, ForeignKey("notification_channel.notification_channel_id")
    )

    notification_type = relationship("NotificationType", back_populates="subscriptions")
    user_profile = relationship("UserProfile", back_populates="notification_channel_subscriptions")
    notification_channel = relationship("NotificationChannel", back_populates="notification_channel_subscriptions")

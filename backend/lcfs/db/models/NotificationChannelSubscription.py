from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship

class NotificationChannelSubscription(BaseModel, Auditable):
     __tablename__ = 'notification_channel_subscription'
     __table_args__ = {'comment': "Represents a user's subscription to notification events"}

     notification_channel_subscription_id = Column(Integer, primary_key=True, autoincrement=True)

     is_enabled = Column(Boolean, default=False)

     user_id = Column(Integer, ForeignKey('user.id'))
     channel_id = Column(Integer, ForeignKey('notification_channel.notification_channel_id'))
     notification_type_id = Column(Integer, ForeignKey('notification_type.notification_type_id'))

     user = relationship('User', back_populates='notification_channel_subscriptions')
     channel = relationship('NotificationChannel', back_populates='notification_channel_subscriptions')
     notification_type = relationship('NotificationType', back_populates='notification_channel_subscriptions')
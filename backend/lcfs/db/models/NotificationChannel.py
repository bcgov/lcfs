import enum
from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, Enum, Boolean
from sqlalchemy.orm import relationship

class ChannelEnum(enum.Enum):
    EMAIL = "Email"
    IN_APP = "In-Application"

class NotificationChannel(BaseModel, Auditable):
    __tablename__ = 'notification_channel'
    __table_args__ = {'comment': "Tracks the state and defaults for communication channels"}

    notification_channel_id = Column(Integer, primary_key=True, autoincrement=True)
    channel_name = Column(Enum(ChannelEnum, name="channel_enum", create_type=True), nullable=False)
    enabled = Column(Boolean, default=False)
    subscribe_by_default = Column(Boolean, default=False)

    notification_channel_subscriptions = relationship('NotificationChannelSubscription', back_populates='notification_channel')

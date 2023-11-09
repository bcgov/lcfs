from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, ForeignKey, Boolean

class Notificationtype(BaseModel, Auditable):
     __tablename__ = 'notification_channel_subscription'
     __table_args__ = {'comment': "Represents a user's subscription to notification events"}

     id = Column(Integer, primary_key=True, autoincrement=True)

     is_enabled = Column(Boolean, default=False)

     user_id = Column(Integer, ForeignKey('user.id'))
     channel_id = Column(Integer, ForeignKey('notification_channel.id'))
     notification_type_id = Column(Integer, ForeignKey('notification_type.id'))

from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import (Column, Integer, String, Boolean, ForeignKey, DateTime,
                        UniqueConstraint, text, Sequence)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from lcfs.db.models.NotificationMessage import NotificationMessage

class UserProfile(BaseModel, Auditable):
    __tablename__ = 'user_profile'
    __table_args__ = (
        UniqueConstraint('username'),
        {'comment': 'Users who may access the application'}
    )

    user_profile_id = Column(Integer, Sequence('user_profile_id_seq'), primary_key=True, autoincrement=True)

    keycloak_user_id = Column(String(150), nullable=True, comment='Unique id returned from Keycloak')
    keycloak_email = Column(String(255), nullable=True, comment='keycloak email address')
    keycloak_username = Column(String(150), unique=True, nullable=False,
                      comment='keycloak Username')
    email = Column(String(255), nullable=True, comment='Primary email address')
    username = Column(String(150), unique=True, nullable=False,
                      comment='Login Username')
    display_name = Column('display_name', String(500), nullable=True,
                          comment='Displayed name for user')
    title = Column(String(100), nullable=True, comment='Professional Title')
    phone = Column(String(50), nullable=True, comment='Primary phone number')
    mobile_phone = Column(String(50), nullable=True, comment='Mobile phone number')
    organization_id = Column(Integer, ForeignKey('organization.organization_id'))

    organization = relationship('Organization', back_populates='user_profiles')
    user_roles = relationship('UserRole', back_populates='user_profile')
    
    notification_channel_subscriptions = relationship('NotificationChannelSubscription', back_populates='user_profile')

    originated_notifications = relationship(
        'NotificationMessage', 
        foreign_keys=[NotificationMessage.origin_user_profile_id],
        back_populates='origin_user_profile'
    )
    notification_messages = relationship(
        'NotificationMessage', 
        foreign_keys=[NotificationMessage.related_user_profile_id],
        back_populates='related_user_profile'
    )

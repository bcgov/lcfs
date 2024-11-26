from sqlalchemy import Column, Integer, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

# from lcfs.db.models.NotificationType import NotificationType
from lcfs.db.models.organization.Organization import (
    Organization,
)  # Adjust according to your project structure


class NotificationMessage(BaseModel, Auditable):
    __tablename__ = "notification_message"
    __table_args__ = {
        "comment": "Represents a notification message sent to an application user"
    }

    notification_message_id = Column(Integer, primary_key=True, autoincrement=True)

    is_read = Column(Boolean, default=False)
    is_warning = Column(Boolean, default=False)
    is_error = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    message = Column(Text, nullable=False)

    related_organization_id = Column(
        Integer, ForeignKey("organization.organization_id")
    )
    origin_user_profile_id = Column(Integer, ForeignKey("user_profile.user_profile_id"))
    related_user_profile_id = Column(
        Integer, ForeignKey("user_profile.user_profile_id")
    )
    notification_type_id = Column(
        Integer, ForeignKey("notification_type.notification_type_id")
    )

    # Models not created yet
    # related_transaction_id = Column(Integer,ForeignKey(''))
    # related_document_id = Column(Integer, ForeignKey('document.id'))
    # related_report_id = Column(Integer, ForeignKey('compliance_report.id'))

    related_organization = relationship(
        "Organization", back_populates="notification_messages"
    )
    notification_type = relationship("NotificationType")
    origin_user_profile = relationship(
        "UserProfile",
        foreign_keys=[origin_user_profile_id],
        back_populates="originated_notifications",
    )
    related_user_profile = relationship(
        "UserProfile",
        foreign_keys=[related_user_profile_id],
        back_populates="notification_messages",
    )

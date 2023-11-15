from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import Column, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship

class NotificationMessage(BaseModel, Auditable):
    __tablename__ = 'notification_message'
    __table_args__ = {'comment': "Represents a notification message sent to an application user"}

    id = Column(Integer, primary_key=True, autoincrement=True)

    is_read = Column(Boolean, default=False)
    is_warning = Column(Boolean, default=False)
    is_error = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)

    origin_user_id = Column(Integer,ForeignKey('user.id'))
    related_organization_id = Column(Integer, ForeignKey('organization.id'))
    related_user_id = Column(Integer,ForeignKey('user.id'))
    notification_type_id = Column(Integer, ForeignKey('notification_type.id'))
    # Models not created yet
    # related_transaction_id = Column(Integer,ForeignKey(''))
    # related_document_id = Column(Integer, ForeignKey('document.id'))
    # related_report_id = Column(Integer, ForeignKey('compliance_report.id'))

    origin_user = relationship('User', back_populates='notification_message')
    orgnaization = relationship('Organization', back_populates='notification_message')
    related_user = relationship('User', back_populates='notification_message')
    notification_type = relationship('NotificationType', back_populates='notification_message')

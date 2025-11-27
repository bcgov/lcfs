import enum
from sqlalchemy import Column, Integer, String, Text, Enum
from lcfs.db.base import BaseModel, Auditable


class NotificationTypeEnum(enum.Enum):
    """Enum for notification types that map to MUI Alert color variants"""

    ALERT = "Alert"
    OUTAGE = "Outage"
    DEADLINE = "Deadline"
    GENERAL = "General"


class GovernmentNotification(BaseModel, Auditable):
    __tablename__ = "government_notification"
    __table_args__ = {
        "comment": "Stores government notifications displayed on dashboards for all users"
    }

    government_notification_id = Column(Integer, primary_key=True, autoincrement=True)

    notification_title = Column(
        String(200), nullable=False, comment="Title of the notification"
    )
    notification_text = Column(
        Text,
        nullable=False,
        comment="Body of the notification, supports HTML markup",
    )
    link_url = Column(
        String(500), nullable=True, comment="Optional URL link to apply to the title"
    )
    notification_type = Column(
        Enum(NotificationTypeEnum, name="notification_type_enum", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=NotificationTypeEnum.GENERAL,
        comment="Type of notification that determines card styling and presentation",
    )

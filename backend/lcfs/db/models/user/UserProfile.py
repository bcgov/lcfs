from typing import Optional
from lcfs.web.api.organizations.schema import OrganizationSummaryResponseSchema
from lcfs.db.base import Auditable, BaseModel

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from lcfs.db.models.notification.NotificationMessage import NotificationMessage
from lcfs.db.models.user.Role import RoleEnum


class UserProfile(BaseModel, Auditable):
    __tablename__ = "user_profile"
    __table_args__ = (
        UniqueConstraint("keycloak_username"),
        {"comment": "Users who may access the application"},
    )

    user_profile_id = Column(Integer, primary_key=True, autoincrement=True)
    keycloak_user_id = Column(
        String(150), nullable=True, comment="Unique id returned from Keycloak"
    )
    keycloak_email = Column(
        String(255), nullable=True, comment="keycloak email address"
    )
    keycloak_username = Column(
        String(150), unique=True, nullable=False, comment="keycloak Username"
    )
    email = Column(String(255), nullable=True, comment="Primary email address")
    title = Column(String(100), nullable=True, comment="Professional Title")
    phone = Column(String(50), nullable=True, comment="Primary phone number")
    mobile_phone = Column(String(50), nullable=True, comment="Mobile phone number")
    first_name = Column(String(100), nullable=True, comment="First name")
    last_name = Column(String(100), nullable=True, comment="Last name")
    is_active = Column(
        Boolean, nullable=False, default=True, comment="Is the user active?"
    )
    organization_id = Column(Integer, ForeignKey("organization.organization_id"))

    organization = relationship("Organization", back_populates="user_profiles")
    user_roles = relationship("UserRole", back_populates="user_profile")

    notification_channel_subscriptions = relationship(
        "NotificationChannelSubscription", back_populates="user_profile"
    )

    originated_notifications = relationship(
        "NotificationMessage",
        foreign_keys=[NotificationMessage.origin_user_profile_id],
        back_populates="origin_user_profile",
    )
    notification_messages = relationship(
        "NotificationMessage",
        foreign_keys=[NotificationMessage.related_user_profile_id],
        back_populates="related_user_profile",
    )

    @classmethod
    def form_user_profile(cls, user_profile, user_data):
        """
        Copy UserProfile instance with data from UserCreate instance.
        """
        if user_data.get("organization"):
            organization_data = OrganizationSummaryResponseSchema(
                **user_data.pop("organization", {})
            )
            user_data["organization_id"] = organization_data.organization_id

        # user_profile = cls(**user_data)
        for field in user_data:
            setattr(user_profile, field, user_data[field])

        return user_profile

    @property
    def role_names(self):
        return [role.role.name for role in self.user_roles]

    @property
    def is_government(self) -> bool:
        """Returns True if the user has the 'GOVERNMENT' role."""
        return any(role == RoleEnum.GOVERNMENT for role in self.role_names)

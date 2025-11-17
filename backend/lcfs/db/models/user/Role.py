from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Enum
from sqlalchemy.orm import relationship
from lcfs.db.base import Auditable, BaseModel
import enum


class RoleEnum(enum.Enum):
    GOVERNMENT = "Government"
    ADMINISTRATOR = "Administrator"
    ANALYST = "Analyst"
    COMPLIANCE_MANAGER = "Compliance Manager"
    DIRECTOR = "Director"

    SUPPLIER = "Supplier"
    MANAGE_USERS = "Manage Users"
    TRANSFER = "Transfer"
    COMPLIANCE_REPORTING = "Compliance Reporting"
    SIGNING_AUTHORITY = "Signing Authority"
    READ_ONLY = "Read Only"
    BETA_TESTER = "Beta Tester"


class Role(BaseModel, Auditable):
    __tablename__ = "role"
    __table_args__ = (
        UniqueConstraint("name"),
        {"comment": "To hold all the available roles and  their descriptions."},
    )
    role_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(
        Enum(RoleEnum, name="role_enum", create_type=True),
        unique=True,
        nullable=False,
        comment="Role code. Natural key. Used internally. eg Admin, GovUser, GovDirector, etc",
    )
    description = Column(
        String(1000),
        comment="Descriptive text explaining this role. This is what's shown to the user.",
    )
    is_government_role = Column(
        Boolean,
        default=False,
        comment="Flag. True if this is a government role (eg. Analyst, Administrator)",
    )
    display_order = Column(Integer, comment="Relative rank in display sorting order")

    # Relationships
    user_roles = relationship("UserRole", back_populates="role")
    notification_type_roles = relationship("NotificationType", back_populates="role")

    def __repr__(self):
        return "<Role %r>" % self.name

    def __str__(self):
        return self.name

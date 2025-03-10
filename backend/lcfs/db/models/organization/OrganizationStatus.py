from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import relationship
import enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class OrgStatusEnum(enum.Enum):
    Unregistered = "Unregistered"
    Registered = "Registered"
    Suspended = "Suspended"
    Canceled = "Canceled"


class OrganizationStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "organization_status"
    __table_args__ = {"comment": "Contains list of organization type"}

    organization_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the organization",
    )
    status = Column(
        Enum(OrgStatusEnum, name="org_status_enum", create_type=True),
        default=OrgStatusEnum.Unregistered,
        comment="Organization's status",
    )
    description = Column(String(500), nullable=True, comment="Organization description")

    organizations = relationship("Organization", back_populates="org_status")

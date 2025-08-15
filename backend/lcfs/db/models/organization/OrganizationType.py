from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class OrganizationType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "organization_type"
    __table_args__ = {"comment": "Represents a Organization types"}

    organization_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        nullable=False,
        comment="Unique identifier for the organization_type",
    )
    org_type = Column(
        String(64),
        nullable=False,
        default="fuel_supplier",
        comment="Organization type key",
    )
    description = Column(String(500), nullable=True, comment="Organization Types")
    is_bceid_user = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        comment="Indicates whether this organization type is for BCeID users",
    )
    organizations = relationship("Organization", back_populates="org_type")

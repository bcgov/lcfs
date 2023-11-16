from sqlalchemy import Column, Integer, String, Sequence, Enum
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum

class OrgTypeEnum(enum.Enum):
    fuel_supplier = "Fuel Supplier"
    electricity_supplier = "Electricity Supplier"
    broker = "Broker"
    utilities = "Utilities (local or public)"

class OrganizationType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'organization_type'
    __table_args__ = {'comment': "Represents a Organization types"}

    organization_type_id = Column(Integer, Sequence('organization_type'), comment="Unique identifier for the organization_type", primary_key=True, autoincrement=True, nullable=False)
    type = Column(Enum(OrgTypeEnum, name="org_type_enum", create_type=True), default=OrgTypeEnum.fuel_supplier, comment="Organization's Types")
    description = Column(String(500), nullable=True, comment="Organization Types")

    organizations = relationship('Organization', back_populates='org_type')

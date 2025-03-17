from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates


class OrganizationAttorneyAddress(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "organization_attorney_address"
    __table_args__ = {"comment": "Represents an organization attorney's address."}

    organization_attorney_address_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    name = Column(String(500), nullable=True, comment="Attorney's Organization name")
    street_address = Column(String(500), nullable=True)
    address_other = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    province_state = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    postalCode_zipCode = Column(String(10), nullable=True)

    organization = relationship(
        "Organization", back_populates="org_attorney_address", uselist=False
    )

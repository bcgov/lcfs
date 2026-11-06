from sqlalchemy import Column, Enum, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel
from lcfs.db.models.fuel.FuelType import QuantityUnitsEnum

fuel_production_facility_document_association = Table(
    "fuel_production_facility_document_association",
    BaseModel.metadata,
    Column(
        "fuel_production_facility_id",
        Integer,
        ForeignKey("fuel_production_facility.fuel_production_facility_id"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id"),
        primary_key=True,
    ),
)


class FuelProductionFacility(BaseModel, Auditable):
    __tablename__ = "fuel_production_facility"
    __table_args__ = {
        "comment": "Production facilities associated with organizations and fuel codes"
    }

    fuel_production_facility_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the fuel production facility",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Owning organization; null for historical unmatched producers",
    )
    name = Column(String(500), nullable=True, comment="Facility name")
    city = Column(String(1000), nullable=True, comment="City or town")
    province_state = Column(String(1000), nullable=True, comment="Province or state")
    country = Column(String(1000), nullable=True, comment="Country")
    iso = Column(String(10), nullable=True, comment="ISO country or region code")
    nameplate_capacity = Column(Integer, nullable=True, comment="Nameplate capacity")
    nameplate_capacity_unit = Column(
        Enum(QuantityUnitsEnum),
        nullable=True,
        comment="Unit of fuel quantity",
    )
    contact_name = Column(String(500), nullable=True, comment="Facility contact name")
    contact_email = Column(String(500), nullable=True, comment="Facility contact email")

    organization = relationship(
        "Organization", back_populates="fuel_production_facilities"
    )
    fuel_codes = relationship(
        "FuelCode", back_populates="fuel_production_facility", lazy="selectin"
    )
    ci_applications = relationship(
        "CIApplication",
        back_populates="fuel_production_facility",
        lazy="selectin",
    )
    pathways = relationship(
        "Pathway",
        back_populates="fuel_production_facility",
        lazy="selectin",
    )
    documents = relationship(
        "Document",
        secondary=fuel_production_facility_document_association,
        back_populates="fuel_production_facilities",
        lazy="selectin",
    )

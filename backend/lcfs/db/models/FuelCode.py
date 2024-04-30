from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Date
from lcfs.db.base import BaseModel, Auditable, EffectiveDates
from sqlalchemy.orm import relationship


class FuelCode(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "fuel_code"
    __table_args__ = {"comment": "Contains a list of all of fuel codes"}

    fuel_code_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the fuel code",
    )
    fuel_status_id = Column(
        Integer,
        ForeignKey("fuel_code_status.fuel_code_status_id"),
        comment="Fuel code status",
    )
    prefix_id = Column(
        Integer,
        ForeignKey("fuel_code_prefix.fuel_code_prefix_id"),
        nullable=False,
        comment="Prefix ID",
    )
    fuel_code = Column(String(50), nullable=False, comment="Fuel code")
    company = Column(String(500), nullable=False, comment="Company name")
    carbon_intensity = Column(
        Numeric(precision=10, scale=2, asdecimal=True), nullable=False
    )
    edrms = Column(String(255), nullable=False, comment="EDRMS #")
    last_updated = Column(
        Date, nullable=False, comment="Date at which the record was last updated."
    )
    application_date = Column(
        Date, nullable=False, comment="application recorded date."
    )
    approval_date = Column(
        Date, nullable=True, comment="Date at which the record was approved."
    )
    fuel_type_id = Column(
        Integer,
        ForeignKey("fuel_type.fuel_type_id"),
        nullable=False,
        comment="Fuel type ID",
    )
    feedstock = Column(String(255), nullable=False, comment="Feedstock")
    feedstock_location = Column(
        String(1000), nullable=False, comment="Feedstock location"
    )
    feedstock_misc = Column(String(500), nullable=True, comment="Feedstock misc")
    fuel_production_facility_location = Column(
        String(1000), nullable=False, comment="Location of the fuel production"
    )
    facility_nameplate_capacity = Column(
        Integer, nullable=True, comment="Nameplate capacity"
    )
    former_company = Column(String(500), nullable=True, comment="Former company")
    notes = Column(String(1000), nullable=True, comment="Notes")

    # Define the relationships
    fuel_code_status = relationship(
        "FuelCodeStatus", back_populates="fuel_codes", lazy="joined"
    )
    fuel_code_prefix = relationship(
        "FuelCodePrefix", back_populates="fuel_codes", lazy="joined"
    )
    fuel_code_type = relationship(
        "FuelType", back_populates="fuel_codes", lazy="joined"
    )
    
    feedstock_fuel_transport_modes = relationship(
        "FeedstockFuelTransportMode",
        back_populates="feedstock_fuel_code",
        primaryjoin="FuelCode.fuel_code_id == FeedstockFuelTransportMode.fuel_code_id",
    )

    finished_fuel_transport_modes = relationship(
        "FinishedFuelTransportMode",
        back_populates="finished_fuel_code",
        primaryjoin="FuelCode.fuel_code_id == FinishedFuelTransportMode.fuel_code_id",
    )

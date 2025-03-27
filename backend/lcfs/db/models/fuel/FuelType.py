import enum

from sqlalchemy import Column, Integer, Text, Boolean, Enum, Numeric, text
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder


# Enum for fuel quantity units
class QuantityUnitsEnum(enum.Enum):
    Litres = "L"
    Kilograms = "kg"
    Kilowatt_hour = "kWh"
    Cubic_metres = "m³"


class FuelType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "fuel_type"
    __table_args__ = {"comment": "Represents a Fuel Type"}

    fuel_type_id = Column(Integer, primary_key=True, autoincrement=True)
    fuel_type = Column(Text, nullable=False)
    fossil_derived = Column(
        Boolean, default=False, comment="Indicates whether the fuel is fossil-derived"
    )
    other_uses_fossil_derived = Column(
        Boolean,
        default=False,
        comment="Indicates whether the fuel is fossil-derived for other uses",
    )
    renewable = Column(
        Boolean,
        server_default=text("FALSE"),
        nullable=False,
        comment="Indicates whether the fuel should be categorized as renewable",
    )
    provision_1_id = Column(
        Integer,
        ForeignKey("provision_of_the_act.provision_of_the_act_id"),
        nullable=True,
    )
    provision_2_id = Column(
        Integer,
        ForeignKey("provision_of_the_act.provision_of_the_act_id"),
        nullable=True,
    )
    default_carbon_intensity = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Carbon intensities: default & prescribed (gCO2e/MJ)",
    )
    units = Column(
        Enum(QuantityUnitsEnum), nullable=False, comment="Units of fuel quantity"
    )
    unrecognized = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Indicates if the fuel type is unrecognized",
    )
    is_legacy = Column(
        Boolean,
        server_default=text("FALSE"),
        nullable=False,
        comment="Indicates if the fuel type is legacy and should not be used for new reports",
    )

    # Relationships
    fuel_codes = relationship("FuelCode", back_populates="fuel_type")
    energy_density = relationship(
        "EnergyDensity", back_populates="fuel_type", uselist=True
    )  # One energy density per fuel type
    energy_effectiveness_ratio = relationship(
        "EnergyEffectivenessRatio", back_populates="fuel_type"
    )
    additional_carbon_intensity = relationship("AdditionalCarbonIntensity")
    provision_1 = relationship(
        "ProvisionOfTheAct",
        foreign_keys=[provision_1_id],
        back_populates="fuel_type_provision_1",
    )
    provision_2 = relationship(
        "ProvisionOfTheAct",
        foreign_keys=[provision_2_id],
        back_populates="fuel_type_provision_2",
    )
    fuel_instances = relationship("FuelInstance", back_populates="fuel_type")
    additional_carbon_intensities = relationship(
        "AdditionalCarbonIntensity",
        back_populates="fuel_type",
        overlaps="additional_carbon_intensity",
    )
    default_carbon_intensities = relationship(
        "DefaultCarbonIntensity",
        back_populates="fuel_type",
        lazy="selectin",
        order_by="DefaultCarbonIntensity.compliance_period_id",
    )

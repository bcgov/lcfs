from sqlalchemy import Column, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class DefaultCarbonIntensity(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "default_carbon_intensity"
    __table_args__ = (
        UniqueConstraint(
            "compliance_period_id", "fuel_type_id",
            name="uq_default_carbon_intensity_compliance_fueltype"
        ),
        {"comment": "Stores default carbon intensity values (gCO2e/MJ) for each fuel type per compliance period"}
    )

    default_carbon_intensity_id = Column(
        Integer, 
        primary_key=True, 
        autoincrement=True,
        comment="Unique identifier for the default carbon intensity record"
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Foreign key to the compliance period (year)"
    )
    fuel_type_id = Column(
        Integer,
        ForeignKey("fuel_type.fuel_type_id"),
        nullable=False,
        comment="Foreign key to the fuel type"
    )
    default_carbon_intensity = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Default carbon intensity value (gCO2e/MJ)"
    )

    # Relationships
    compliance_period = relationship("CompliancePeriod", lazy="joined")
    fuel_type = relationship("FuelType", back_populates="default_carbon_intensities", lazy="joined")
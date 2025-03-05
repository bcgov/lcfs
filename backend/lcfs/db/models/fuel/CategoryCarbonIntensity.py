from sqlalchemy import Column, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class CategoryCarbonIntensity(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "category_carbon_intensity"
    __table_args__ = (
        UniqueConstraint(
            "compliance_period_id", "fuel_category_id",
            name="uq_category_carbon_intensity_compliance_fuelcategory"
        ),
        {"comment": "Stores carbon intensity values (gCO2e/MJ) for each fuel category per compliance period"}
    )

    category_carbon_intensity_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the category carbon intensity record"
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Foreign key to the compliance period (year)"
    )
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Foreign key to the fuel category"
    )
    category_carbon_intensity = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Carbon intensity value (gCO2e/MJ) for the specified fuel category and compliance period"
    )

    # Relationships
    compliance_period = relationship("CompliancePeriod", lazy="selectin")
    fuel_category = relationship("FuelCategory", back_populates="category_carbon_intensities", lazy="selectin")
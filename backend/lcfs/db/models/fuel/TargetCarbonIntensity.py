from sqlalchemy import Column, Integer, Float, ForeignKey, Numeric, UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates
from sqlalchemy.orm import relationship


class TargetCarbonIntensity(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "target_carbon_intensity"
    __table_args__ = (
        UniqueConstraint(
            "compliance_period_id",
            "fuel_category_id",
            name="uq_target_carbon_intensity_compliance_fuel",
        ),
        {"comment": "Target carbon intensity values for various fuel categories"},
    )

    target_carbon_intensity_id = Column(Integer, primary_key=True, autoincrement=True)
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Compliance period ID",
    )
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Fuel category ID",
    )
    target_carbon_intensity = Column(
        Numeric(10, 2), nullable=False, comment="Target Carbon Intensity (gCO2e/MJ)"
    )
    reduction_target_percentage = Column(
        Float, nullable=False, comment="Reduction target percentage"
    )

    fuel_category = relationship(
        "FuelCategory", back_populates="target_carbon_intensities"
    )
    compliance_period = relationship("CompliancePeriod")

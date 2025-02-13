from sqlalchemy import Column, Integer, Numeric, UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey


class AdditionalCarbonIntensity(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "additional_carbon_intensity"
    __table_args__ = (
        UniqueConstraint(
            "compliance_period_id",
            "fuel_type_id",
            "end_use_type_id",
            name="uq_additional_ci_compliance_fuel_enduse",
        ),
        {
            "comment": "Additional carbon intensity attributable to the use of fuel with compliance period dependency"
        },
    )
    # if both fuel type and end use type id's are null, then this is a default uci
    additional_uci_id = Column(Integer, primary_key=True, autoincrement=True)
    fuel_type_id = Column(Integer, ForeignKey("fuel_type.fuel_type_id"), nullable=True)
    end_use_type_id = Column(
        Integer, ForeignKey("end_use_type.end_use_type_id"), nullable=True
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Compliance period for the UCI value"
    )
    uom_id = Column(Integer, ForeignKey("unit_of_measure.uom_id"), nullable=False)
    intensity = Column(Numeric(10, 2), nullable=False)

    # Relationships
    fuel_type = relationship(
        "FuelType",
        back_populates="additional_carbon_intensity",
        overlaps="additional_carbon_intensities"
    )
    end_use_type = relationship(
        "EndUseType",
        back_populates="additional_carbon_intensities")
    uom = relationship(
        "UnitOfMeasure")
    compliance_period = relationship(
        "CompliancePeriod",
        back_populates="additional_carbon_intensities")

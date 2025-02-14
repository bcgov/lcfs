from sqlalchemy import Column, Integer, Numeric, UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey


class EnergyDensity(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "energy_density"
    __table_args__ = (
        UniqueConstraint(
            "compliance_period_id",
            "fuel_type_id",
            name="uq_energy_density_compliance_fuel"
        ),
        {"comment": "Energy density values with annual variation"}
    )

    energy_density_id = Column(Integer, primary_key=True, autoincrement=True)
    fuel_type_id = Column(Integer, ForeignKey("fuel_type.fuel_type_id"), nullable=False)
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False
    )
    density = Column(Numeric(10, 2), nullable=False)
    uom_id = Column(Integer, ForeignKey("unit_of_measure.uom_id"), nullable=False)

    fuel_type = relationship("FuelType", back_populates="energy_density", uselist=False)
    uom = relationship("UnitOfMeasure", back_populates="energy_density")
    compliance_period = relationship("CompliancePeriod", back_populates="energy_density")
from sqlalchemy import Column, Integer, Float, ForeignKey, UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, DisplayOrder, EffectiveDates
from sqlalchemy.orm import relationship


class EnergyEffectivenessRatio(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    __tablename__ = "energy_effectiveness_ratio"
    __table_args__ = (
        UniqueConstraint(
            "compliance_period_id",
            "fuel_type_id",
            "fuel_category_id",
            "end_use_type_id",
            name="uq_eer_compliance_fuel_category_enduse"
        ),
        {"comment": "Energy effectiveness ratios with annual variation"}
    )

    # if both fuel type & category and end use type id's are null, then this is a default eer
    eer_id = Column(Integer, primary_key=True, autoincrement=True)
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False
    )
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Fuel category",
    )
    fuel_type_id = Column(
        Integer,
        ForeignKey("fuel_type.fuel_type_id"),
        nullable=True,
        comment="Fuel type",
    )
    end_use_type_id = Column(
        Integer,
        ForeignKey("end_use_type.end_use_type_id"),
        nullable=True,
        comment="End use type",
    )
    ratio = Column(
        Float(3, False, 2), nullable=False, comment="Energy effectiveness ratio constant"
    )

    compliance_period = relationship("CompliancePeriod")
    fuel_category = relationship(
        "FuelCategory", back_populates="energy_effectiveness_ratio"
    )
    fuel_type = relationship("FuelType", back_populates="energy_effectiveness_ratio")
    end_use_type = relationship(
        "EndUseType", back_populates="energy_effectiveness_ratio"
    )

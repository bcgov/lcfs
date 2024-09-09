from sqlalchemy import Column, Integer, Text, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder, EffectiveDates
from sqlalchemy.orm import relationship


class FuelCategory(BaseModel, Auditable, DisplayOrder, EffectiveDates):

    __tablename__ = "fuel_category"
    __table_args__ = {"comment": "Represents a static table for fuel categories"}

    fuel_category_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the fuel category",
    )
    category = Column(
        Enum(
            "Gasoline",
            "Diesel",
            "Jet fuel",
            name="fuel_category_enum",
            create_type=True,
        ),
        nullable=False,
        comment="Name of the fuel category",
    )
    description = Column(Text, nullable=True, comment="Description of the fuel categor")

    energy_effectiveness_ratio = relationship("EnergyEffectivenessRatio")
    target_carbon_intensities = relationship("TargetCarbonIntensity", back_populates="fuel_category")
    fuel_instances = relationship("FuelInstance", back_populates="fuel_category")

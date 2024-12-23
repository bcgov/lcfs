from sqlalchemy import Column, Integer, Text, Enum, Float, Numeric
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
    description = Column(
        Text, nullable=True, comment="Description of the fuel category"
    )
    default_carbon_intensity = Column(
        Numeric(10, 2),
        nullable=False,
        comment="Default carbon intensity of the fuel category",
    )

    energy_effectiveness_ratio = relationship("EnergyEffectivenessRatio")
    target_carbon_intensities = relationship(
        "TargetCarbonIntensity", back_populates="fuel_category"
    )
    fuel_instances = relationship("FuelInstance", back_populates="fuel_category")

    def __str__(self):
        """
        Returns a string representation of the model's values.
        """
        attributes = []
        for attr in self.__mapper__.c:
            value = getattr(self, attr.key, None)
            attributes.append(f"{attr.key}: {value}")
        return f"{self.__class__.__name__}({', '.join(attributes)})"

from sqlalchemy import Column, Integer, Text
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship


class UnitOfMeasure(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "unit_of_measure"
    __table_args__ = {"comment": "Units used to measure energy densities"}

    uom_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    description = Column(Text)

    energy_density = relationship("EnergyDensity", back_populates="uom")
    additional_carbon_intensity = relationship("AdditionalCarbonIntensity", back_populates="uom")

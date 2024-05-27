from sqlalchemy import Column, Integer, String, Date
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, EffectiveDates, DisplayOrder

class CustomFuelType(BaseModel, EffectiveDates, DisplayOrder):
    __tablename__ = 'custom_fuel_type'
    __table_args__ = (
        {'comment': "Lookup table for custom fuel types."}
    )
    
    custom_fuel_type_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the custom fuel type")
    type = Column(String, nullable=False, comment="Type of the custom fuel")
    description = Column(String, nullable=True, comment="Description of the custom fuel type")

    fuel_supplies = relationship('FuelSupply', back_populates='custom_fuel_type')

    def __repr__(self):
        return f"<CustomFuelType(id={self.custom_fuel_type_id}, type={self.type})>"

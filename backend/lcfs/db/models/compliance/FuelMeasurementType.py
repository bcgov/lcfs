from lcfs.db.base import Auditable, BaseModel, DisplayOrder
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship


class FuelMeasurementType(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "fuel_measurement_type"
    __table_args__ = {"comment": "Fuel measurement type"}

    fuel_measurement_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the fuel measurement type",
    )
    type = Column(String, nullable=False, comment="Name of the fuel measurement type")
    description = Column(Text, comment="Description of the fuel measurement type")
    # relationship
    final_supply_equipment = relationship("FinalSupplyEquipment")

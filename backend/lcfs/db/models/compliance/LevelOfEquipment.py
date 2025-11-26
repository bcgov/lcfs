from lcfs.db.base import Auditable, BaseModel, DisplayOrder
from sqlalchemy import Column, Integer, Text
from sqlalchemy import String
from sqlalchemy.orm import relationship


class LevelOfEquipment(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "level_of_equipment"
    __table_args__ = {
        "comment": "Represents a level of equipment for fuel supply equipments"
    }

    level_of_equipment_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), nullable=False)
    description = Column(Text)

    # relationship
    final_supply_equipment = relationship("FinalSupplyEquipment")
    charging_power_outputs = relationship(
        "ChargingPowerOutput", back_populates="level_of_equipment"
    )

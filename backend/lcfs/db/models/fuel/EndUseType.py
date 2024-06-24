from sqlalchemy import Column, Integer, Text, Boolean
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship


class EndUseType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "end_use_type"
    __table_args__ = {
        "comment": "Represents a end use types for various fuel types and categories"
    }

    end_use_type_id = Column(Integer, primary_key=True)
    type = Column(Text, nullable=False)
    sub_type = Column(Text)
    intended_use = Column(Boolean, nullable=False, default=False)

    energy_effectiveness_ratio = relationship("EnergyEffectivenessRatio")
    additional_carbon_intensity = relationship("AdditionalCarbonIntensity")
    final_supply_equipment = relationship("FinalSupplyEquipment")

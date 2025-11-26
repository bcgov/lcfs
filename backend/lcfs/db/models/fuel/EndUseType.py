from sqlalchemy import Column, Integer, Text, Boolean
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship
from lcfs.db.models.compliance.FinalSupplyEquipment import (
    final_supply_intended_use_association,
)


class EndUseType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "end_use_type"
    __table_args__ = {
        "comment": "Represents a end use types for various fuel types and categories"
    }

    end_use_type_id = Column(Integer, primary_key=True)
    type = Column(Text, nullable=False)
    sub_type = Column(Text)
    intended_use = Column(Boolean, nullable=False, default=False)

    energy_effectiveness_ratio = relationship(
        "EnergyEffectivenessRatio", back_populates="end_use_type"
    )
    additional_carbon_intensity = relationship(
        "AdditionalCarbonIntensity", back_populates="end_use_type"
    )
    charging_power_outputs = relationship(
        "ChargingPowerOutput", back_populates="end_use_type"
    )
    final_supply_equipments = relationship(
        "FinalSupplyEquipment",
        secondary=final_supply_intended_use_association,
        back_populates="intended_use_types",
    )
    additional_carbon_intensities = relationship(
        "AdditionalCarbonIntensity",
        back_populates="end_use_type",
        overlaps="additional_carbon_intensity",
    )

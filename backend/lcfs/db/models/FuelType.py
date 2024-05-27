from sqlalchemy import Column, Integer, Text, Boolean, Float
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey


class FuelType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'fuel_type'
    __table_args__ = {'comment': "Represents a Fuel Type"}

    fuel_type_id = Column(
        Integer, primary_key=True, autoincrement=True)
    fuel_type = Column(Text, nullable=False)
    fossil_derived = Column(Boolean, default=False)
    provision_1_act_id = Column(Integer, ForeignKey("provision_act.provision_act_id"), nullable=True)
    provision_2_act_id = Column(Integer, ForeignKey("provision_act.provision_act_id"), nullable=True)
    default_carbon_intensity = Column(Float(10, 2), nullable=True, comment="Carbon intensities: default & prescribed (gCO2e/MJ)")

    fuel_codes = relationship('FuelCode',  back_populates='fuel_code_type')
    energy_density = relationship('EnergyDensity', back_populates='fuel_type')
    energy_effectiveness_ratio = relationship('EnergyEffectivenessRatio', back_populates='fuel_type')
    additional_carbon_intensity = relationship('AdditionalCarbonIntensity')
    provision_1_act = relationship('ProvisionAct', foreign_keys=[provision_1_act_id], back_populates="fuel_type_provision_1")
    provision_2_act = relationship('ProvisionAct', foreign_keys=[provision_2_act_id], back_populates="fuel_type_provision_2")

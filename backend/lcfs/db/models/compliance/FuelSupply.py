from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

class FuelSupply(BaseModel, Auditable):
    __tablename__ = 'fuel_supply'
    __table_args__ = (
        {'comment': "Records the supply of fuel for compliance purposes."}
    )
    
    fuel_supply_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the fuel supply")
    quantity = Column(Integer, nullable=False, comment="Quantity of fuel supplied")
    fuel_category_id = Column(Integer, ForeignKey('fuel_category.fuel_category_id'), nullable=False, comment="Foreign key to the fuel category")
    fuel_code_id = Column(Integer, ForeignKey('fuel_code.fuel_code_id'), nullable=False, comment="Foreign key to the fuel code")
    fuel_type_id = Column(Integer, ForeignKey('fuel_type.fuel_type_id'), nullable=False, comment="Foreign key to the fuel type")
    provision_of_the_act_id = Column(Integer, ForeignKey('provision_of_the_act.provision_of_the_act_id'), nullable=False, comment="Foreign key to the provision of the act")
    custom_fuel_id = Column(Integer, ForeignKey('custom_fuel_type.custom_fuel_type_id'), nullable=True, comment="Foreign key to the custom fuel type")
    custom_fuel_energy_density = Column(Float, nullable=True, comment="Energy density of the custom fuel")
    end_use_id = Column(Integer, ForeignKey('end_use_type.end_use_type_id'), nullable=True, comment="Foreign key to the end use type")

    fuel_category = relationship('FuelCategory', back_populates='fuel_supplies')
    fuel_code = relationship('FuelCode', back_populates='fuel_supplies')
    fuel_type = relationship('FuelType', back_populates='fuel_supplies')
    provision_of_the_act = relationship('ProvisionOfTheAct', back_populates='fuel_supplies')
    custom_fuel_type = relationship('CustomFuelType', back_populates='fuel_supplies')
    end_use_type = relationship('EndUseType', back_populates='fuel_supplies')
    compliance_reports = relationship('ComplianceReport', back_populates='fuel_supply')

    def __repr__(self):
        return f"<FuelSupply(id={self.fuel_supply_id}, quantity={self.quantity})>"

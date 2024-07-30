from sqlalchemy import Column, Integer, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable
from enum import Enum

class Quarter(Enum):
    Q1 = 'Q1'
    Q2 = 'Q2'
    Q3 = 'Q3'
    Q4 = 'Q4'

class ChangeType(Enum):
    CREATE = 'Create'
    UPDATE = 'Update'
    DELETE = 'Delete'

class FuelSupply(BaseModel, Auditable):
    __tablename__ = 'fuel_supply'
    __table_args__ = (
        {'comment': "Records the supply of fuel for compliance purposes, including changes in supplemental reports"}
    )
    
    fuel_supply_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the fuel supply")
    compliance_report_id = Column(Integer, ForeignKey('compliance_report.compliance_report_id'), nullable=False, comment="Foreign key to the compliance report")
    supplemental_report_id = Column(Integer, ForeignKey('supplemental_report.supplemental_report_id'), nullable=True, comment="Foreign key to the supplemental report")
    previous_fuel_supply_id = Column(Integer, ForeignKey('fuel_supply.fuel_supply_id'), nullable=True, comment="Foreign key to the previous fuel supply record")
    quarter = Column(SQLEnum(Quarter), nullable=True, comment="Quarter for quarterly reports")

    quantity = Column(Integer, nullable=False, comment="Quantity of fuel supplied")
    compliance_units = Column(Integer, nullable=True, comment="Compliance units for the fuel supply")
    energy = Column(Float, nullable=True, comment="Energy content of the fuel supplied")
    fuel_category_id = Column(Integer, ForeignKey('fuel_category.fuel_category_id'), nullable=False, comment="Foreign key to the fuel category")
    fuel_code_id = Column(Integer, ForeignKey('fuel_code.fuel_code_id'), nullable=True, comment="Foreign key to the fuel code")
    fuel_type_id = Column(Integer, ForeignKey('fuel_type.fuel_type_id'), nullable=False, comment="Foreign key to the fuel type")
    provision_of_the_act_id = Column(Integer, ForeignKey('provision_of_the_act.provision_of_the_act_id'), nullable=False, comment="Foreign key to the provision of the act")
    custom_fuel_id = Column(Integer, ForeignKey('custom_fuel_type.custom_fuel_type_id'), nullable=True, comment="Foreign key to the custom fuel type")
    end_use_id = Column(Integer, ForeignKey('end_use_type.end_use_type_id'), nullable=True, comment="Foreign key to the end use type")

    compliance_report = relationship('ComplianceReport', back_populates='fuel_supplies')
    supplemental_report = relationship('SupplementalReport', back_populates='fuel_supplies')
    previous_fuel_supply = relationship('FuelSupply', remote_side=[fuel_supply_id])
    
    fuel_category = relationship('FuelCategory')
    fuel_code = relationship('FuelCode')
    fuel_type = relationship('FuelType')
    provision_of_the_act = relationship('ProvisionOfTheAct')
    custom_fuel_type = relationship('CustomFuelType')
    end_use_type = relationship('EndUseType')

    def __repr__(self):
        return f"<FuelSupply(id={self.fuel_supply_id}, quantity={self.quantity})>"

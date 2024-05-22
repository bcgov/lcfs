from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

class OtherUses(BaseModel, Auditable):
    __tablename__ = 'other_uses'
    __table_args__ = (
        {'comment': "Records other uses of fuels that are subject to renewable requirements but do not earn credits."}
    )
    
    other_uses_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the other uses record")
    custom_fuel_id = Column(Integer, ForeignKey('custom_fuel_type.custom_fuel_type_id'), nullable=False, comment="Foreign key to the custom fuel type")
    expected_use_id = Column(Integer, ForeignKey('expected_use_type.expected_use_type_id'), nullable=False, comment="Foreign key to the expected use type")
    fuel_category_id = Column(Integer, ForeignKey('fuel_category.fuel_category_id'), nullable=False, comment="Foreign key to the fuel category")
    fuel_type_id = Column(Integer, ForeignKey('fuel_type.fuel_type_id'), nullable=False, comment="Foreign key to the fuel type")
    quantity = Column(Integer, nullable=False, comment="Quantity of fuel used")
    rationale = Column(String, nullable=True, comment="Rationale for the use of the fuel")

    custom_fuel_type = relationship('CustomFuelType', back_populates='other_uses')
    expected_use_type = relationship('ExpectedUseType', back_populates='other_uses')
    fuel_category = relationship('FuelCategory', back_populates='other_uses')
    fuel_type = relationship('FuelType', back_populates='other_uses')
    compliance_reports = relationship('ComplianceReport', back_populates='other_uses')

    def __repr__(self):
        return f"<OtherUses(id={self.other_uses_id}, quantity={self.quantity})>"

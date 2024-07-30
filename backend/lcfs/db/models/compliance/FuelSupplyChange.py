from sqlalchemy import Column, Integer, Float, ForeignKey, Enum, JSON, DateTime
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable
import enum
from datetime import datetime

class ChangeType(enum.Enum):
    UPDATE = 'Update'
    DELETE = 'Delete'
    ADD = 'Add'

class FuelSupplyChange(BaseModel, Auditable):
    __tablename__ = 'fuel_supply_change'
    __table_args__ = (
        {'comment': "Tracks changes to fuel supply records for supplemental reports"}
    )
    
    change_id = Column(Integer, primary_key=True, autoincrement=True)
    supplemental_report_id = Column(Integer, ForeignKey('supplemental_report.supplemental_report_id'), nullable=False)
    original_fuel_supply_id = Column(Integer, ForeignKey('fuel_supply.fuel_supply_id'), nullable=True)
    change_type = Column(Enum(ChangeType), nullable=False)
    changed_fields = Column(JSON, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)

    supplemental_report = relationship('SupplementalReport', back_populates='fuel_supply_changes')
    original_fuel_supply = relationship('FuelSupply')

    def __repr__(self):
        return f"<FuelSupplyChange(id={self.change_id}, type={self.change_type})>"
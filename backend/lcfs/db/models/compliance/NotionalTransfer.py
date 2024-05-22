from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

class NotionalTransfer(BaseModel, Auditable):
    __tablename__ = 'notional_transfer'
    __table_args__ = (
        {'comment': "Notional transfers allow overcompliance to be transferred to another non-compliant party. The business name and address are text fields on the notional transfers record."}
    )
    
    notional_transfer_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the notional transfer")
    quantity = Column(Integer, nullable=False, comment="Quantity of fuel being notionally transferred")
    notional_transfer_partner = Column(String, nullable=False, comment="Partner to whom the fuel is being transferred")
    postal_address = Column(String, nullable=False, comment="Postal address of the transfer partner")
    fuel_category_id = Column(Integer, ForeignKey('fuel_category.fuel_category_id'), nullable=False, comment="Foreign key to the fuel category")

    compliance_reports = relationship('ComplianceReport', back_populates='notional_transfer')

    def __repr__(self):
        return f"<NotionalTransfer(id={self.notional_transfer_id}, partner={self.notional_transfer_partner})>"

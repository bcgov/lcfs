from sqlalchemy import Column, Integer, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable
import enum

class SupplementalReportType(enum.Enum):
    SUPPLEMENTAL = 'Supplemental'
    REASSESSMENT = 'Reassessment'

class SupplementalReport(BaseModel, Auditable):
    __tablename__ = 'supplemental_report'
    
    supplemental_report_id = Column(Integer, primary_key=True, autoincrement=True)
    original_report_id = Column(Integer, ForeignKey('compliance_report.compliance_report_id'), nullable=False)
    version = Column(Integer, nullable=False)
    report_type = Column(Enum(SupplementalReportType), nullable=False, comment="Whether a supplier or government user create this supplemental")
    status_id = Column(Integer, ForeignKey('compliance_report_status.compliance_report_status_id'), nullable=True, comment="Identifier for the compliance report status")
    
    # Relationships
    status = relationship('ComplianceReportStatus')
    original_report = relationship('ComplianceReport', back_populates='supplemental_reports')
    fuel_supply_changes = relationship('FuelSupplyChange', back_populates='supplemental_report')
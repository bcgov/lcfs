from sqlalchemy import Column, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable
from enum import Enum

class SupplementalReportType(Enum):
    SUPPLEMENTAL = 'Supplemental'
    REASSESSMENT = 'Reassessment'

class SupplementalReport(BaseModel, Auditable):
    __tablename__ = 'supplemental_report'
    __table_args__ = (
        {'comment': "Tracks supplemental reports and reassessments for compliance reports"}
    )
    
    supplemental_report_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the supplemental report")
    original_report_id = Column(Integer, ForeignKey('compliance_report.compliance_report_id'), nullable=False, comment="Foreign key to the original compliance report")
    previous_report_id = Column(Integer, ForeignKey('supplemental_report.supplemental_report_id'), nullable=True, comment="Foreign key to the previous supplemental report")
    version = Column(Integer, nullable=False, comment="Version number of the supplemental report")
    report_type = Column(SQLEnum(SupplementalReportType), nullable=False, comment="Type of supplemental report")
    current_status_id = Column(Integer, ForeignKey('compliance_report_status.compliance_report_status_id'), nullable=False, comment="Identifier for the compliance report status")
    
    # Relationships
    original_report = relationship('ComplianceReport', back_populates='supplemental_reports')
    previous_report = relationship('SupplementalReport', remote_side=[supplemental_report_id])
    current_status = relationship('ComplianceReportStatus')
    fuel_supplies = relationship('FuelSupply', back_populates='supplemental_report')
    summaries = relationship('ComplianceReportSummary', back_populates='supplemental_report')

    def __repr__(self):
        return f"<SupplementalReport(id={self.supplemental_report_id}, type={self.report_type}, version={self.version})>"
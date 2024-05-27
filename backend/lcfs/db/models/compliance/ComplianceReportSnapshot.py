from sqlalchemy import Column, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel

class ComplianceReportSnapshot(BaseModel):
    __tablename__ = 'compliance_report_snapshot'
    __table_args__ = (
        {'comment': "Stores snapshots of compliance reports at important status changes like recommended, approval, or cancellation"}
    )
    
    compliance_report_snapshot_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the compliance report snapshot")
    compliance_report_id = Column(Integer, ForeignKey('compliance_report.compliance_report_id'), nullable=False, comment="Foreign key to the compliance report")
    snapshot = Column(JSON, nullable=False, comment="JSON representation of the compliance report snapshot")

    compliance_report = relationship('ComplianceReport', back_populates='snapshots')

    def __repr__(self):
        return f"<ComplianceReportSnapshot(id={self.compliance_report_snapshot_id})>"

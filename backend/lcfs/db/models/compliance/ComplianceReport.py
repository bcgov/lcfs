from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable

class ComplianceReport(BaseModel, Auditable):
    __tablename__ = 'compliance_report'
    __table_args__ = (
        {'comment': "Main tracking table for all the sub-tables associated with a supplier's annual compliance report"}
    )
    
    compliance_report_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the compliance report")
    compliance_period_id = Column(Integer, ForeignKey('compliance_period.compliance_period_id'), nullable=False, comment="Foreign key to the compliance period")
    organization_id = Column(Integer, ForeignKey('organization.organization_id'), nullable=False, comment="Identifier for the organization")
    summary_id = Column(Integer, ForeignKey('compliance_report_summary.summary_id'), nullable=True, comment="Identifier for the compliance report summary")
    status_id = Column(Integer, ForeignKey('compliance_report_status.compliance_report_status_id'), nullable=True, comment="Identifier for the compliance report status")
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'), nullable=True, comment="Identifier for the transaction")
    nickname = Column(String, nullable=True, comment="Nickname for the compliance report")
    supplemental_note = Column(String, nullable=True, comment="Supplemental note for the compliance report")

    # Relationships
    compliance_period = relationship('CompliancePeriod', back_populates='compliance_reports')
    organization = relationship('Organization', back_populates='compliance_reports')
    summary = relationship('ComplianceReportSummary', back_populates='compliance_report')
    status = relationship('ComplianceReportStatus')
    transaction = relationship('Transaction')
    
    # Tracking relationships
    snapshots = relationship('ComplianceReportSnapshot', back_populates='compliance_report')
    history = relationship('ComplianceReportHistory', back_populates='compliance_report')

    # Schedule relationships
    notional_transfers = relationship('NotionalTransfer', back_populates='compliance_report')
    fuel_supplies = relationship('FuelSupply', back_populates='compliance_report')
    allocation_agreements = relationship('AllocationAgreement', back_populates='compliance_report')
    other_uses = relationship('OtherUses', back_populates='compliance_report')
    final_supply_equipment = relationship('FinalSupplyEquipment', back_populates='compliance_report')

    def __repr__(self):
        return f"<ComplianceReport(id={self.compliance_report_id}, nickname={self.nickname})>"

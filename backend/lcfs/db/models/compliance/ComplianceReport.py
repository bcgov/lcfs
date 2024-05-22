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
    fuel_type_id = Column(Integer, ForeignKey('fuel_type.fuel_type_id'), nullable=True, comment="Identifier for the fuel type")
    notional_transfer_id = Column(Integer, ForeignKey('notional_transfer.notional_transfer_id'), nullable=True, comment="Identifier for the notional transfer")
    fuel_supply_id = Column(Integer, ForeignKey('fuel_supply.fuel_supply_id'), nullable=True, comment="Identifier for the fuel supply")
    other_uses_id = Column(Integer, ForeignKey('other_uses.other_uses_id'), nullable=True, comment="Identifier for other uses")
    summary_id = Column(Integer, ForeignKey('compliance_report_summary.summary_id'), nullable=True, comment="Identifier for the compliance report summary")
    status_id = Column(Integer, ForeignKey('compliance_report_status.compliance_report_status_id'), nullable=True, comment="Identifier for the compliance report status")
    allocation_agreement_id = Column(Integer, ForeignKey('allocation_agreement.allocation_agreement_id'), nullable=True, comment="Identifier for the allocation agreement")
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'), nullable=True, comment="Identifier for the transaction")
    nickname = Column(String, nullable=True, comment="Nickname for the compliance report")
    supplemental_note = Column(String, nullable=True, comment="Supplemental note for the compliance report")

    compliance_period = relationship('CompliancePeriod', back_populates='compliance_reports')
    organization = relationship('Organization', back_populates='compliance_reports')
    fuel_type = relationship('FuelType', back_populates='compliance_reports')
    notional_transfer = relationship('NotionalTransfer', back_populates='compliance_reports')
    fuel_supply = relationship('FuelSupply', back_populates='compliance_reports')
    other_uses = relationship('OtherUses', back_populates='compliance_reports')
    summary = relationship('ComplianceReportSummary', back_populates='compliance_reports')
    status = relationship('ComplianceReportStatus', back_populates='compliance_reports')
    allocation_agreement = relationship('AllocationAgreement', back_populates='compliance_reports')
    transaction = relationship('Transaction', back_populates='compliance_reports')
    history = relationship('ComplianceReportHistory', back_populates='compliance_report')

    def __repr__(self):
        return f"<ComplianceReport(id={self.compliance_report_id}, nickname={self.nickname})>"

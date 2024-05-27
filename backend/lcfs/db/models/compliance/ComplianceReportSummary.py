from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel

class ComplianceReportSummary(BaseModel):
    __tablename__ = 'compliance_report_summary'
    __table_args__ = (
        {'comment': "Summary of all compliance calculations displaying the compliance units credits or debits over a compliance period"}
    )
    
    summary_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the compliance report summary")
    gasoline_category_retained = Column(Integer, nullable=False, comment="Retained gasoline category units")
    gasoline_category_deferred = Column(Integer, nullable=False, comment="Deferred gasoline category units")
    gasoline_category_obligation = Column(Integer, nullable=False, comment="Obligation for the gasoline category")
    gasoline_category_previously_retained = Column(Integer, nullable=False, comment="Previously retained gasoline category units")
    diesel_category_retained = Column(Integer, nullable=False, comment="Retained diesel category units")
    diesel_category_deferred = Column(Integer, nullable=False, comment="Deferred diesel category units")
    diesel_category_obligation = Column(Integer, nullable=False, comment="Obligation for the diesel category")
    diesel_category_previously_retained = Column(Integer, nullable=False, comment="Previously retained diesel category units")

    compliance_report = relationship('ComplianceReport', back_populates='summary')

    def __repr__(self):
        return f"<ComplianceReportSummary(id={self.summary_id})>"

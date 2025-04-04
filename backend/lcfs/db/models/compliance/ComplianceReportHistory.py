from sqlalchemy import Column, Integer, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable


class ComplianceReportHistory(BaseModel, Auditable):
    __tablename__ = "compliance_report_history"
    __table_args__ = (
        UniqueConstraint(
            'compliance_report_id',
            'status_id',
            name='uq_compliance_report_id_status_id'
        ),
        {"comment": "Tracks status changes of compliance reports"},
    )

    compliance_report_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the compliance report history",
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the compliance report",
    )
    status_id = Column(
        Integer,
        ForeignKey("compliance_report_status.compliance_report_status_id"),
        nullable=False,
        comment="Foreign key to the compliance report status",
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        comment="Identifier for the user associated with the status change",
    )
    display_name = Column(
        String(255),
        comment="Display name for the compliance report history",
        nullable=True
    )

    compliance_report = relationship("ComplianceReport", back_populates="history")
    status = relationship("ComplianceReportStatus")
    user_profile = relationship("UserProfile")

    def __repr__(self):
        return f"<ComplianceReportHistory(id={self.compliance_report_history_id}, status_id={self.status_id})>"

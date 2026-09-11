from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class ComplianceReportPenaltyStatusHistory(BaseModel, Auditable):
    __tablename__ = "compliance_report_penalty_status_history"
    __table_args__ = {
        "comment": "Tracks invoice and payment status changes for compliance report penalties."
    }

    penalty_status_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the penalty status history record.",
    )
    summary_id = Column(
        Integer,
        ForeignKey("compliance_report_summary.summary_id"),
        nullable=False,
        comment="Summary row group where the penalty status changed.",
    )
    compliance_report_group_uuid = Column(
        String(36),
        nullable=False,
        comment="Compliance report group UUID where the penalty status changed.",
    )
    version = Column(
        Integer,
        nullable=False,
        comment="Compliance report version where the penalty status changed.",
    )
    line = Column(
        Integer,
        nullable=False,
        comment="Penalty summary line updated. Expected values are 11 or 21.",
    )
    field_name = Column(
        String(50),
        nullable=False,
        comment="Status field updated, such as invoice_sent or payment_received.",
    )
    previous_value = Column(
        Boolean,
        nullable=True,
        comment="Status value before the update.",
    )
    new_value = Column(
        Boolean,
        nullable=True,
        comment="Status value after the update.",
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who changed the penalty status.",
    )
    display_name = Column(
        String(255),
        nullable=True,
        comment="Display name for the user who changed the penalty status.",
    )

    summary = relationship("ComplianceReportSummary")
    user_profile = relationship("UserProfile")

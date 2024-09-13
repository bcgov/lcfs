from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel


class ComplianceReportInternalComment(BaseModel):
    __tablename__ = "compliance_report_internal_comment"
    __table_args__ = {"comment": "Associates internal comments with compliance report."}

    # Columns
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        primary_key=True,
        comment="Foreign key to compliance_report, part of the composite primary key.",
    )
    internal_comment_id = Column(
        Integer,
        ForeignKey("internal_comment.internal_comment_id"),
        primary_key=True,
        comment="Foreign key to internal_comment, part of the composite primary key.",
    )

    # Relationships
    compliance_report = relationship(
        "ComplianceReport", back_populates="compliance_report_internal_comments"
    )
    internal_comment = relationship(
        "InternalComment", back_populates="compliance_report_internal_comments"
    )

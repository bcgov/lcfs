from sqlalchemy import Column, Index, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel


class ComplianceReportInternalComment(BaseModel):
    __tablename__ = "compliance_report_internal_comment"
    __table_args__ = (
        Index(
            "idx_cr_internal_comment_group_uuid",
            "compliance_report_group_uuid",
        ),
        {"comment": "Associates internal comments with compliance report."},
    )

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
    compliance_report_group_uuid = Column(
        String(length=36),
        nullable=True,
        comment=(
            "Denormalized compliance_report.compliance_report_group_uuid so "
            "comments stay grouped across supplemental/versioned reports."
        ),
    )

    # Relationships
    compliance_report = relationship(
        "ComplianceReport", back_populates="compliance_report_internal_comments"
    )
    internal_comment = relationship(
        "InternalComment", back_populates="compliance_report_internal_comments"
    )

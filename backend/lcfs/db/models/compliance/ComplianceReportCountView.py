from sqlalchemy import Column, Integer, String
from lcfs.db.base import BaseModel


class ComplianceReportCountView(BaseModel):
    __tablename__ = "mv_compliance_report_count"
    __table_args__ = {
        "extend_existing": True,
        "comment": "Materialized view for counting compliance reports by review status",
    }

    status = Column(
        String,
        primary_key=True,
        comment="Status name (Submitted, Recommended by Analysts, Recommended by Manager)"
    )
    count = Column(
        Integer,
        comment="Count of compliance reports for this status"
    )

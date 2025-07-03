from sqlalchemy import Column, Integer, String, Date, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from lcfs.db.base import BaseModel, EffectiveDates


class ComplianceReportStatusEnum(enum.Enum):
    Draft = "Draft"
    Submitted = "Submitted"
    Analyst_adjustment = "Analyst adjustment"
    Recommended_by_analyst = "Recommended by analyst"
    Recommended_by_manager = "Recommended by manager"
    Assessed = "Assessed"

    # Historical (TFRS)
    Not_recommended_by_analyst = "Not recommended by analyst"
    Not_recommended_by_manager = "Not recommended by manager"
    Rejected = "Rejected"

    # Display purpose only
    Supplemental_requested = "Supplemental requested"

    def underscore_value(self) -> str:
        """
        Return the status as an underscored string.
        """
        return self.value.replace(" ", "_")


class ComplianceReportStatus(BaseModel, EffectiveDates):
    __tablename__ = "compliance_report_status"
    __table_args__ = {"comment": "Lookup table for compliance reports status"}

    compliance_report_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the compliance report status",
    )
    display_order = Column(
        Integer, nullable=True, comment="Display order for the compliance report status"
    )
    status = Column(
        Enum(ComplianceReportStatusEnum),
        nullable=False,
        comment="Status of the compliance report",
    )

    compliance_reports = relationship(
        "ComplianceReport", back_populates="current_status"
    )

    def __repr__(self):
        return f"<ComplianceReportStatus(id={self.compliance_report_status_id}, status={self.status})>"

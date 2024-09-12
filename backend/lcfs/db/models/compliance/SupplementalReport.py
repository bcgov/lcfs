from sqlalchemy import Column, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable
from enum import Enum


class SupplementalReportType(Enum):
    SUPPLEMENTAL = "Supplemental"
    REASSESSMENT = "Reassessment"


class SupplementalReport(BaseModel, Auditable):
    __tablename__ = "supplemental_report"
    __table_args__ = {
        "comment": "Tracks supplemental reports and reassessments for compliance reports"
    }

    supplemental_report_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the supplemental report",
    )
    original_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the original compliance report",
    )
    previous_report_id = Column(
        Integer,
        ForeignKey("supplemental_report.supplemental_report_id"),
        nullable=True,
        comment="Foreign key to the previous supplemental report",
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Foreign key to the compliance period",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Identifier for the organization",
    )
    current_status_id = Column(
        Integer,
        ForeignKey("compliance_report_status.compliance_report_status_id"),
        nullable=False,
        comment="Identifier for the compliance report status",
    )

    version = Column(
        Integer, nullable=False, comment="Version number of the supplemental report"
    )
    report_type = Column(
        SQLEnum(SupplementalReportType),
        nullable=False,
        comment="Type of supplemental report",
    )

    # Relationships
    summary = relationship(
        "ComplianceReportSummary", back_populates="supplemental_report", uselist=False
    )
    original_report = relationship(
        "ComplianceReport", back_populates="supplemental_reports"
    )
    previous_report = relationship(
        "SupplementalReport", remote_side=[supplemental_report_id]
    )
    current_status = relationship("ComplianceReportStatus")
    compliance_period = relationship("CompliancePeriod")
    organization = relationship("Organization")
    fuel_supplies = relationship("FuelSupply", back_populates="supplemental_report")
    fuel_exports = relationship("FuelExport", back_populates="supplemental_report")

    def __repr__(self):
        return f"<SupplementalReport(id={self.supplemental_report_id}, type={self.report_type}, version={self.version})>"

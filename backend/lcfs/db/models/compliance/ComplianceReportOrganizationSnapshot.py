from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class ComplianceReportOrganizationSnapshot(BaseModel, Auditable):
    __tablename__ = "compliance_report_organization_snapshot"
    __table_args__ = {
        "comment": "Contains organization snapshots that are attached to each compliance report for audit purposes."
    }

    organization_snapshot_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the organization",
    )

    compliance_report_id = Column(
        Integer, ForeignKey("compliance_report.compliance_report_id"), nullable=True
    )

    name = Column(String(500), comment="Organization's legal name")
    operating_name = Column(
        String(500), nullable=True, comment="Organization's Operating name"
    )
    email = Column(String(255), nullable=True, comment="Organization's email address")
    phone = Column(String(50), nullable=True, comment="Organization's phone number")
    bc_address = Column(
        String(500), nullable=True, comment="Organization's address in BC"
    )
    service_address = Column(
        String(500), nullable=True, comment="Organization's address for Postal Service"
    )

    is_edited = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Organization's address for Postal Service",
    )

    compliance_report = relationship(
        "ComplianceReport", back_populates="organization_snapshot"
    )

import uuid
import enum

from pydantic import computed_field
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Enum,
    Table,
    ForeignKey,
)
from sqlalchemy.orm import relationship, backref
from lcfs.db.base import BaseModel, Auditable


class ReportingFrequency(enum.Enum):
    ANNUAL = "Annual"
    QUARTERLY = "Quarterly"


class SupplementalInitiatorType(enum.Enum):
    SUPPLIER_SUPPLEMENTAL = "Supplier Supplemental"
    GOVERNMENT_REASSESSMENT = "Government Reassessment"


class Quarter(enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"


class QuantityUnitsEnum(enum.Enum):
    Litres = "L"
    Kilograms = "kg"
    Kilowatt_hour = "kWh"
    Cubic_metres = "m³"


# Association table for
compliance_report_document_association = Table(
    "compliance_report_document_association",
    BaseModel.metadata,
    Column(
        "compliance_report_id",
        Integer,
        ForeignKey("compliance_report.compliance_report_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id"),
        primary_key=True,
    ),
)


class ComplianceReport(BaseModel, Auditable):
    __tablename__ = "compliance_report"
    __table_args__ = {
        "comment": "Main tracking table for all the sub-tables associated with a supplier's compliance report"
    }

    compliance_report_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the compliance report version",
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
        nullable=True,
        comment="Identifier for the current compliance report status",
    )
    transaction_id = Column(
        Integer,
        ForeignKey("transaction.transaction_id"),
        nullable=True,
        comment="Identifier for the transaction",
    )
    compliance_report_group_uuid = Column(
        String(36),
        nullable=False,
        default=lambda: str(uuid.uuid4()),
        comment="UUID that groups all versions of a compliance report",
    )
    version = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Version number of the compliance report",
    )
    supplemental_initiator = Column(
        Enum(SupplementalInitiatorType),
        nullable=True,
        comment="Indicates whether supplier or government initiated the supplemental",
    )
    reporting_frequency = Column(
        Enum(ReportingFrequency),
        nullable=False,
        default=ReportingFrequency.ANNUAL,
        comment="Reporting frequency",
    )
    nickname = Column(
        String,
        nullable=True,
        comment="Nickname for the compliance report",
    )
    supplemental_note = Column(
        String,
        nullable=True,
        comment="Supplemental note for the compliance report",
    )

    # Relationships
    compliance_period = relationship(
        "CompliancePeriod", back_populates="compliance_reports"
    )
    organization = relationship("Organization", back_populates="compliance_reports")
    current_status = relationship("ComplianceReportStatus")
    transaction = relationship("Transaction")

    # Tracking relationships
    summary = relationship(
        "ComplianceReportSummary", back_populates="compliance_report", uselist=False
    )
    history = relationship(
        "ComplianceReportHistory", back_populates="compliance_report"
    )
    compliance_report_internal_comments = relationship(
        "ComplianceReportInternalComment", back_populates="compliance_report"
    )
    documents = relationship(
        "Document",
        secondary=compliance_report_document_association,
        back_populates="compliance_reports",
    )

    # Schedule relationships
    notional_transfers = relationship(
        "NotionalTransfer", back_populates="compliance_report"
    )
    fuel_supplies = relationship("FuelSupply", back_populates="compliance_report")
    fuel_exports = relationship("FuelExport", back_populates="compliance_report")
    allocation_agreements = relationship(
        "AllocationAgreement", back_populates="compliance_report"
    )
    other_uses = relationship("OtherUses", back_populates="compliance_report")
    final_supply_equipment = relationship(
        "FinalSupplyEquipment", back_populates="compliance_report"
    )

    def __repr__(self):
        return f"<ComplianceReport(id={self.compliance_report_id}, version={self.version})>"

    @computed_field
    @property
    def has_supplemental(self):
        return self.version > 0

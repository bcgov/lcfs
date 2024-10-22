import enum
from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Table
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable


class ReportingFrequency(enum.Enum):
    ANNUAL = "Annual"
    QUARTERLY = "Quarterly"


class SupplementalInitiatorType(enum.Enum):
    SUPPLIER_INITIATED_SUPPLEMENTAL = "Supplier Initiated"
    GOVERNMENT_INITIATED_REASSESSMENT = "Government Initiated"


class Quarter(enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"


class ChangeType(enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class QuantityUnitsEnum(enum.Enum):
    Litres = "L"
    Kilograms = "kg"
    Kilowatt_hour = "kWh"
    Cubic_metres = "m3"


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
        "comment": "Main tracking table for all the sub-tables associated with a supplier's annual compliance report"
    }

    compliance_report_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the compliance report",
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

    # Supplemental Reporting Fields
    original_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the original compliance report",
    )
    previous_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=True,
        comment="Foreign key to the previous compliance report",
    )
    chain_index = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Position of the report in the chain of related reports",
    )
    supplemental_initiator = Column(
        Enum(SupplementalInitiatorType),
        nullable=True,
        comment="Whether supplier or gov initiated the supplemental.",
    )

    reporting_frequency = Column(
        Enum(ReportingFrequency), nullable=False, default=ReportingFrequency.ANNUAL
    )
    nickname = Column(
        String, nullable=True, comment="Nickname for the compliance report"
    )
    supplemental_note = Column(
        String, nullable=True, comment="Supplemental note for the compliance report"
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
    compliance_report_internal_comments = relationship(
        "ComplianceReportInternalComment", back_populates="compliance_report"
    )

    documents = relationship(
        "Document",
        secondary=compliance_report_document_association,
        back_populates="compliance_reports",
    )

    # Original Report: Always the first in the chain
    original_report = relationship(
        "ComplianceReport",
        remote_side=[compliance_report_id],
        back_populates="supplemental_reports",
        foreign_keys=[original_report_id],
    )
    # Previous Report: Points to the immediate previous report
    previous_report = relationship(
        "ComplianceReport",
        remote_side=[compliance_report_id],
        foreign_keys=[previous_report_id],
    )
    # Supplemental Reports: All reports after the original
    supplemental_reports = relationship(
        "ComplianceReport",
        back_populates="original_report",
        foreign_keys=[original_report_id],
        primaryjoin="ComplianceReport.original_report_id == ComplianceReport.compliance_report_id",
        order_by="ComplianceReport.chain_index",
    )

    def __repr__(self):
        return f"<ComplianceReport(id={self.compliance_report_id}, nickname={self.nickname})>"

from sqlalchemy import Column, Integer, String, ForeignKey, Enum, BigInteger
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, Versioning
import enum


class ReceivedOrTransferredEnum(enum.Enum):
    Received = "Received"
    Transferred = "Transferred"


class NotionalTransfer(BaseModel, Auditable, Versioning):
    __tablename__ = "notional_transfer"
    __table_args__ = {"comment": "Records notional transfers for compliance reports."}

    notional_transfer_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the notional transfer",
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the compliance report",
    )

    # Quantity fields - main quantity for regular reports, quarterly for early issuance
    quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel being notionally transferred (no early issuance)",
    )
    q1_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel being notionally transferred in Q1 (early issuance only)",
    )
    q2_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel being notionally transferred in Q2 (early issuance only)",
    )
    q3_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel being notionally transferred in Q3 (early issuance only)",
    )
    q4_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel being notionally transferred in Q4 (early issuance only)",
    )

    legal_name = Column(
        String, nullable=False, comment="Legal name of the trading partner"
    )
    address_for_service = Column(
        String, nullable=False, comment="Address for service of the trading partner"
    )
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Foreign key to the fuel category",
    )
    received_or_transferred = Column(
        Enum(ReceivedOrTransferredEnum),
        nullable=False,
        comment="Indicates whether the transfer is Received or Transferred",
    )

    compliance_report = relationship(
        "ComplianceReport", back_populates="notional_transfers"
    )
    fuel_category = relationship("FuelCategory")

    def __repr__(self):
        return f"<NotionalTransfer(id={self.notional_transfer_id}, legal_name={self.legal_name})>"

from lcfs.db.base import BaseModel, Auditable
from sqlalchemy import (
    Column,
    Integer,
    Text,
    ForeignKey,
    Double,
    DateTime,
)
from sqlalchemy.orm import relationship
from datetime import datetime


# Association table for charging equipment, ComplianceReport, and Organization with additional data
class ComplianceReportChargingEquipment(BaseModel, Auditable):
    """
    Association table linking Charging Equipment, Compliance Report, and Organization
    with supply period and usage data
    """

    __tablename__ = "compliance_report_charging_equipment"
    __table_args__ = {
        "comment": "Association between Charging Equipment, Compliance Report, and Organization with supply data"
    }

    # Primary key
    charging_equipment_compliance_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the charging equipment compliance association",
    )

    # Foreign keys to the three main entities
    charging_equipment_id = Column(
        Integer,
        ForeignKey("charging_equipment.charging_equipment_id", ondelete="CASCADE"),
        nullable=False,
        comment="Reference to charging equipment",
        index=True,
    )

    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id", ondelete="CASCADE"),
        nullable=False,
        comment="Reference to compliance report",
        index=True,
    )

    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Reference to organization",
        index=True,
    )

    # Required data columns
    date_of_supply_from = Column(
        DateTime,
        nullable=False,
        comment="Start date of the supply period",
    )

    date_of_supply_to = Column(
        DateTime,
        nullable=False,
        comment="End date of the supply period",
    )

    # Optional data columns
    kwh_usage = Column(
        Double,
        nullable=True,
        comment="kWh usage during the supply period (optional)",
    )

    compliance_notes = Column(
        Text,
        nullable=True,
        comment="Optional notes about compliance for this association",
    )

    # Relationships
    charging_equipment = relationship(
        "ChargingEquipment", back_populates="compliance_associations"
    )
    compliance_report = relationship(
        "ComplianceReport", back_populates="charging_equipment_associations"
    )
    organization = relationship(
        "Organization", back_populates="charging_equipment_compliance_associations"
    )

    def __repr__(self):
        return (
            f"<ComplianceReportChargingEquipment("
            f"id={self.charging_equipment_compliance_id}, "
            f"charging_equipment_id={self.charging_equipment_id}, "
            f"compliance_report_id={self.compliance_report_id}, "
            f"organization_id={self.organization_id}, "
            f"supply_period={self.date_of_supply_from} to {self.date_of_supply_to}"
            f")>"
        )

    @property
    def supply_period_days(self):
        """Calculate the number of days in the supply period."""
        if self.date_of_supply_from and self.date_of_supply_to:
            return (self.date_of_supply_to - self.date_of_supply_from).days + 1
        return None

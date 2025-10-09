from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship


class FSEComplianceReporting(BaseModel, Auditable):
    __tablename__ = "fse_compliance_reporting"
    __table_args__ = (
        UniqueConstraint(
            "charging_equipment_id",
            "supply_from_date",
            "supply_to_date",
            name="uix_fse_compliance_reporting_equipment_dates",
        ),
        UniqueConstraint(
            "compliance_period_id",
            "compliance_report_id",
            "charging_equipment_id",
            "organization_id",
            name="uix_fse_compliance_reporting_period_by_org",
        ),
        CheckConstraint(
            "supply_to_date >= supply_from_date", name="check_supply_date_order"
        ),
        {"comment": "FSE compliance reporting"},
    )

    fse_compliance_reporting_id = Column(Integer, primary_key=True, autoincrement=True)
    supply_from_date = Column(Date, nullable=False)
    supply_to_date = Column(Date, nullable=False)
    kwh_usage = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)

    # Foreign key columns
    charging_equipment_id = Column(
        Integer, ForeignKey("charging_equipment.charging_equipment_id"), nullable=False
    )
    organization_id = Column(
        Integer, ForeignKey("organization.organization_id"), nullable=False
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
    )

    # Add relationships
    charging_equipment = relationship(
        "ChargingEquipment", back_populates="fse_compliance_reports"
    )
    organization = relationship("Organization", back_populates="fse_compliance_reports")
    compliance_report = relationship(
        "ComplianceReport", back_populates="fse_compliance_reports"
    )
    compliance_period = relationship("CompliancePeriod")

    def __repr__(self):
        return (
            f"<FSEComplianceReporting("
            f"fse_compliance_reporting_id={self.fse_compliance_reporting_id}, "
            f"supply_from_date={self.supply_from_date}, "
            f"supply_to_date={self.supply_to_date}, "
            f"kwh_usage={self.kwh_usage})>"
        )

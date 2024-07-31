from sqlalchemy import Column, Integer, Float, ForeignKey, Enum, DateTime, Boolean
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable
from datetime import datetime

class ComplianceReportSummary(BaseModel, Auditable):
    __tablename__ = 'compliance_report_summary'
    __table_args__ = (
        {'comment': "Summary of all compliance calculations displaying the compliance units credits or debits over a compliance period"}
    )
    
    summary_id = Column(Integer, primary_key=True, autoincrement=True)
    compliance_report_id = Column(Integer, ForeignKey('compliance_report.compliance_report_id'), nullable=False)
    quarter = Column(Integer, nullable=True)  # Null for annual reports
    version = Column(Integer, nullable=False, default=1)
    is_locked = Column(Boolean, default=False)

    # Helper function to create columns for each fuel type
    def create_columns(line_number, description):
        prefix = f"line_{line_number}_{description}"
        return [
            Column(f"{prefix}_gasoline", Float, nullable=False, default=0),
            Column(f"{prefix}_diesel", Float, nullable=False, default=0),
            Column(f"{prefix}_jet_fuel", Float, nullable=False, default=0),
        ]

    # Renewable fuel target summary 
    create_columns(1, "fossil_derived_base_fuel")
    create_columns(2, "eligible_renewable_fuel_supplied")
    create_columns(3, "total_tracked_fuel_supplied")
    create_columns(4, "eligible_renewable_fuel_required")
    create_columns(5, "net_notionally_transferred")
    create_columns(6, "renewable_fuel_retained")
    create_columns(7, "previously_retained")
    create_columns(8, "obligation_deferred")
    create_columns(9, "obligation_added")
    create_columns(10, "net_renewable_fuel_supplied")
    create_columns(11, "non_compliance_penalty")

    # Low carbon fuel target summary columns
    Column("line_12_low_carbon_fuel_required", Float, nullable=False, default=0)
    Column("line_13_low_carbon_fuel_supplied", Float, nullable=False, default=0)
    Column("line_14_low_carbon_fuel_surplus", Float, nullable=False, default=0)
    Column("line_15_banked_units_used", Float, nullable=False, default=0)
    Column("line_16_banked_units_remaining", Float, nullable=False, default=0)
    Column("line_17_non_banked_units_used", Float, nullable=False, default=0)
    Column("line_18_units_to_be_banked", Float, nullable=False, default=0)
    Column("line_19_units_to_be_exported", Float, nullable=False, default=0)
    Column("line_20_surplus_deficit_units", Float, nullable=False, default=0)
    Column("line_21_surplus_deficit_ratio", Float, nullable=False, default=0)
    Column("line_22_compliance_units_issued", Float, nullable=False, default=0)

    # Non-compliance penalty summary columns
    Column("line_11_fossil_derived_base_fuel_gasoline", Float, nullable=False, default=0)
    Column("line_11_fossil_derived_base_fuel_diesel", Float, nullable=False, default=0)
    Column("line_11_fossil_derived_base_fuel_jet_fuel", Float, nullable=False, default=0)
    Column("line_11_fossil_derived_base_fuel_total", Float, nullable=False, default=0)
    Column("line_21_non_compliance_penalty_payable", Float, nullable=False, default=0)
    Column("total_non_compliance_penalty_payable", Float, nullable=False, default=0)

    compliance_report = relationship('ComplianceReport', back_populates='summaries')

    def __repr__(self):
        return f"<ComplianceReportSummary(id={self.summary_id}, quarter={self.quarter}, version={self.version})>"

    # method to annualize a report once all four quarters are approved?
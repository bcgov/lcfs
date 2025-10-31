from sqlalchemy import Column, Integer, Float, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class ComplianceReportSummary(BaseModel, Auditable):
    __tablename__ = "compliance_report_summary"
    __table_args__ = {
        "comment": "Summary of all compliance calculations displaying the compliance units over a compliance period"
    }

    summary_id = Column(Integer, primary_key=True, autoincrement=True)
    compliance_report_id = Column(
        Integer, ForeignKey("compliance_report.compliance_report_id"), nullable=True
    )
    quarter = Column(Integer, nullable=True)  # Null for annual reports
    is_locked = Column(Boolean, default=False)

    # Renewable fuel target summary
    line_1_fossil_derived_base_fuel_gasoline = Column(Float, nullable=False, default=0)
    line_1_fossil_derived_base_fuel_diesel = Column(Float, nullable=False, default=0)
    line_1_fossil_derived_base_fuel_jet_fuel = Column(Float, nullable=False, default=0)

    line_2_eligible_renewable_fuel_supplied_gasoline = Column(
        Float, nullable=False, default=0
    )
    line_2_eligible_renewable_fuel_supplied_diesel = Column(
        Float, nullable=False, default=0
    )
    line_2_eligible_renewable_fuel_supplied_jet_fuel = Column(
        Float, nullable=False, default=0
    )

    line_3_total_tracked_fuel_supplied_gasoline = Column(
        Float, nullable=False, default=0
    )
    line_3_total_tracked_fuel_supplied_diesel = Column(Float, nullable=False, default=0)
    line_3_total_tracked_fuel_supplied_jet_fuel = Column(
        Float, nullable=False, default=0
    )

    line_4_eligible_renewable_fuel_required_gasoline = Column(
        Float, nullable=False, default=0
    )
    line_4_eligible_renewable_fuel_required_diesel = Column(
        Float, nullable=False, default=0
    )
    line_4_eligible_renewable_fuel_required_jet_fuel = Column(
        Float, nullable=False, default=0
    )

    line_5_net_notionally_transferred_gasoline = Column(
        Float, nullable=False, default=0
    )
    line_5_net_notionally_transferred_diesel = Column(Float, nullable=False, default=0)
    line_5_net_notionally_transferred_jet_fuel = Column(
        Float, nullable=False, default=0
    )

    line_6_renewable_fuel_retained_gasoline = Column(Float, nullable=False, default=0)
    line_6_renewable_fuel_retained_diesel = Column(Float, nullable=False, default=0)
    line_6_renewable_fuel_retained_jet_fuel = Column(Float, nullable=False, default=0)

    line_7_previously_retained_gasoline = Column(Float, nullable=False, default=0)
    line_7_previously_retained_diesel = Column(Float, nullable=False, default=0)
    line_7_previously_retained_jet_fuel = Column(Float, nullable=False, default=0)

    line_8_obligation_deferred_gasoline = Column(Float, nullable=False, default=0)
    line_8_obligation_deferred_diesel = Column(Float, nullable=False, default=0)
    line_8_obligation_deferred_jet_fuel = Column(Float, nullable=False, default=0)

    line_9_obligation_added_gasoline = Column(Float, nullable=False, default=0)
    line_9_obligation_added_diesel = Column(Float, nullable=False, default=0)
    line_9_obligation_added_jet_fuel = Column(Float, nullable=False, default=0)

    line_10_net_renewable_fuel_supplied_gasoline = Column(
        Float, nullable=False, default=0
    )
    line_10_net_renewable_fuel_supplied_diesel = Column(
        Float, nullable=False, default=0
    )
    line_10_net_renewable_fuel_supplied_jet_fuel = Column(
        Float, nullable=False, default=0
    )

    line_11_non_compliance_penalty_gasoline = Column(Float, nullable=True, default=0)
    line_11_non_compliance_penalty_diesel = Column(Float, nullable=True, default=0)
    line_11_non_compliance_penalty_jet_fuel = Column(Float, nullable=True, default=0)

    # Low carbon fuel target summary columns
    line_12_low_carbon_fuel_required = Column(Float, nullable=False, default=0)
    line_13_low_carbon_fuel_supplied = Column(Float, nullable=False, default=0)
    line_14_low_carbon_fuel_surplus = Column(Float, nullable=False, default=0)
    line_15_banked_units_used = Column(Float, nullable=False, default=0)
    line_16_banked_units_remaining = Column(Float, nullable=False, default=0)
    line_17_non_banked_units_used = Column(Float, nullable=False, default=0)
    line_18_units_to_be_banked = Column(Float, nullable=False, default=0)
    line_19_units_to_be_exported = Column(Float, nullable=False, default=0)
    line_20_surplus_deficit_units = Column(Float, nullable=False, default=0)
    line_21_surplus_deficit_ratio = Column(Float, nullable=False, default=0)
    line_22_compliance_units_issued = Column(Float, nullable=False, default=0)

    # Non-compliance penalty summary columns
    line_11_fossil_derived_base_fuel_gasoline = Column(Float, nullable=False, default=0)
    line_11_fossil_derived_base_fuel_diesel = Column(Float, nullable=False, default=0)
    line_11_fossil_derived_base_fuel_jet_fuel = Column(Float, nullable=False, default=0)
    line_11_fossil_derived_base_fuel_total = Column(Float, nullable=False, default=0)
    line_21_non_compliance_penalty_payable = Column(Float, nullable=False, default=0)
    total_non_compliance_penalty_payable = Column(Float, nullable=False, default=0)

    # Penalty override fields for IDIR Director
    penalty_override_enabled = Column(Boolean, nullable=False, default=False, comment="Whether penalty override is enabled (checkbox state)")
    renewable_penalty_override = Column(Float, nullable=True, comment="Director override value for Line 11 renewable fuel penalty")
    low_carbon_penalty_override = Column(Float, nullable=True, comment="Director override value for Line 21 low carbon fuel penalty")
    penalty_override_date = Column(DateTime(timezone=True), nullable=True, comment="Timestamp when penalty was last overridden")
    penalty_override_user = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who made the penalty override"
    )

    # Legacy TFRS Columns
    credits_offset_a = Column(Integer)
    credits_offset_b = Column(Integer)
    credits_offset_c = Column(Integer)

    # Early Issuance Columns
    early_issuance_credits_q1 = Column(Integer)
    early_issuance_credits_q2 = Column(Integer)
    early_issuance_credits_q3 = Column(Integer)
    early_issuance_credits_q4 = Column(Integer)

    compliance_report = relationship("ComplianceReport", back_populates="summary")
    penalty_override_user_profile = relationship("UserProfile", foreign_keys=[penalty_override_user])

    @property
    def total_renewable_fuel_supplied(self):
        return (
            self.line_2_eligible_renewable_fuel_supplied_gasoline +
            self.line_2_eligible_renewable_fuel_supplied_diesel +
            self.line_2_eligible_renewable_fuel_supplied_jet_fuel
        )

    def __repr__(self):
        return (
            f"<ComplianceReportSummary(id={self.summary_id}, quarter={self.quarter})>"
        )

    # method to annualize a report once all four quarters are approved?

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, EffectiveDates


class CompliancePeriod(BaseModel, EffectiveDates):
    __tablename__ = "compliance_period"
    __table_args__ = {
        "comment": "The compliance year associated with compliance reports and other related tables. The description field should be the year."
    }

    compliance_period_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the compliance period",
    )
    description = Column(
        String, nullable=False, comment="Year description for the compliance period"
    )
    display_order = Column(
        Integer, nullable=True, comment="Display order for the compliance period"
    )

    compliance_reports = relationship(
        "ComplianceReport", back_populates="compliance_period"
    )

    additional_carbon_intensities = relationship(
        "AdditionalCarbonIntensity",
        back_populates="compliance_period",
        cascade="all, delete-orphan",
    )

    energy_density = relationship(
        "EnergyDensity",
        back_populates="compliance_period",
        cascade="all, delete-orphan",
    )

    early_issuance_by_years = relationship(
        "OrganizationEarlyIssuanceByYear", back_populates="compliance_period"
    )

    def __repr__(self):
        return f"<CompliancePeriod(id={self.compliance_period_id}, description={self.description})>"

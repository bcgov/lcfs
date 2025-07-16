from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class OrganizationEarlyIssuanceByYear(BaseModel, Auditable):
    __tablename__ = "organization_early_issuance_by_year"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "compliance_period_id",
            name="uq_organization_early_issuance_by_year",
        ),
        {
            "comment": "Tracks early issuance reporting eligibility by organization and compliance year"
        },
    )

    early_issuance_by_year_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the early issuance by year record",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Foreign key to the organization",
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Foreign key to the compliance period",
    )
    has_early_issuance = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if the organization can create early issuance reports for this compliance year",
    )

    # Relationships
    organization = relationship(
        "Organization", back_populates="early_issuance_by_years"
    )
    compliance_period = relationship(
        "CompliancePeriod", back_populates="early_issuance_by_years"
    )

    def __repr__(self):
        return f"<OrganizationEarlyIssuanceByYear(organization_id={self.organization_id}, compliance_period_id={self.compliance_period_id}, has_early_issuance={self.has_early_issuance})>"

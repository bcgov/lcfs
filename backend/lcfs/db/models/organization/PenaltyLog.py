from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class PenaltyLog(BaseModel, Auditable):
    __tablename__ = "penalty_log"
    __table_args__ = (
        {
            "comment": "Records penalty assessments applied to organizations for a given compliance period.",
        },
    )

    penalty_log_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the penalty log entry.",
    )
    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Organization associated with the penalty entry.",
    )
    compliance_period_id = Column(
        Integer,
        ForeignKey("compliance_period.compliance_period_id"),
        nullable=False,
        comment="Compliance period that the penalty relates to.",
    )
    contravention_type = Column(
        Enum(
            "Single contravention", "Continuous contravention", name="contravention_enum"
        ),
        nullable=False,
        comment="Type of penalty assessed (e.g., 'Single contravention', 'Continuous contravention').",
    )
    offence_history = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Indicates if prior offences exist for the organization.",
    )
    deliberate = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Indicates if the violation was deliberate.",
    )
    efforts_to_correct = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Indicates if efforts were made to correct the violation.",
    )
    economic_benefit_derived = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Indicates if an economic benefit was derived from the violation.",
    )
    efforts_to_prevent_recurrence = Column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Indicates if efforts were made to prevent recurrence of the violation.",
    )
    notes = Column(
        Text,
        nullable=True,
        comment="Additional notes about the penalty assessment.",
    )
    penalty_amount = Column(
        Numeric(12, 2),
        nullable=False,
        server_default=text("0"),
        comment="Penalty amount assessed in dollars.",
    )

    organization = relationship("Organization")
    compliance_period = relationship("CompliancePeriod")

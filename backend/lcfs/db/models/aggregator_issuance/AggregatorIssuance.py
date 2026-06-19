from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates


class AggregatorIssuance(BaseModel, Auditable, EffectiveDates):
    """
    Government-to-organization compliance unit issuance recorded to support
    aggregator-related historical data entry (originally the 2022 / 2023
    compliance periods).

    Mirrors the ``initiative_agreement`` / ``admin_adjustment`` pattern: each row
    links to a ``transaction`` row and is surfaced as its own
    ``AggregatorIssuance`` type in the ``mv_transaction_aggregate`` materialized
    view. This distinguishes these records from generic legacy / migrated
    standalone transactions, which remain labelled "Legacy Transaction".
    """

    __tablename__ = "aggregator_issuance"
    __table_args__ = (
        {
            "comment": (
                "Government to organization compliance unit issuance recorded for "
                "aggregator historical data entry; distinguishes these records from "
                "generic legacy / migrated standalone transactions."
            )
        },
    )

    aggregator_issuance_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the aggregator issuance",
    )
    compliance_units = Column(BigInteger, comment="Compliance Units")
    transaction_effective_date = Column(
        DateTime,
        nullable=True,
        comment="Agreement / effective date of the issuance; its year drives the "
        "compliance period surfaced in the transaction views.",
    )
    recorded_date = Column(
        DateTime,
        nullable=True,
        comment="Date the issuance was recorded, if applicable.",
    )
    gov_comment = Column(
        String(1500), comment="Comment from the government to organization"
    )
    to_organization_id = Column(
        Integer, ForeignKey("organization.organization_id"), index=True
    )
    transaction_id = Column(
        Integer, ForeignKey("transaction.transaction_id"), index=True
    )

    to_organization = relationship("Organization")
    transaction = relationship("Transaction")

    def __repr__(self):
        return (
            f"<AggregatorIssuance(id={self.aggregator_issuance_id}, "
            f"transaction_id={self.transaction_id}, units={self.compliance_units})>"
        )

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, DisplayOrder


class InitiativeAgreementLifecycleStatus(BaseModel, Auditable, DisplayOrder):
    """
    Lifecycle status of an initiative agreement (#4804).

    Deliberately separate from ``initiative_agreement_status``, which is the
    legacy credit-award transaction status consumed by
    ``transaction_status_view`` and ``mv_transaction_aggregate``. Adding
    lifecycle values to that table breaks the Transactions status filter.
    """

    __tablename__ = "initiative_agreement_lifecycle_status"
    __table_args__ = {
        "comment": (
            "Lookup for initiative agreement lifecycle statuses. Separate "
            "from initiative_agreement_status, which feeds "
            "transaction_status_view and the transaction materialized views."
        )
    }

    initiative_agreement_lifecycle_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the lifecycle status",
    )
    status = Column(
        String(100),
        nullable=False,
        comment="Status value (e.g. Draft, Underway, Completed, Terminated)",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Optional description of the status",
    )

    initiative_agreements = relationship(
        "InitiativeAgreement", back_populates="lifecycle_status"
    )

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class InitiativeAgreementLifecycleHistory(BaseModel, Auditable):
    """
    Append-only record of the lifecycle statuses an agreement has entered,
    starting with the one it was created in (#5186).

    Deliberately not ``initiative_agreement_history``: that table records
    the legacy credit-award statuses, and ``mv_transaction_aggregate`` reads
    it for award approval dates.
    """

    __tablename__ = "initiative_agreement_lifecycle_history"
    __table_args__ = {
        "comment": (
            "Append-only history of the lifecycle statuses an initiative "
            "agreement has entered, beginning with its initial status."
        )
    }

    initiative_agreement_lifecycle_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the history record",
    )
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id"),
        nullable=False,
        index=True,
        comment="Agreement whose status this records",
    )
    lifecycle_status_id = Column(
        Integer,
        ForeignKey(
            "initiative_agreement_lifecycle_status."
            "initiative_agreement_lifecycle_status_id"
        ),
        nullable=False,
        comment="Lifecycle status the agreement entered",
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User whose action set the status; null for system changes",
    )
    display_name = Column(
        String(255),
        nullable=True,
        comment="Name of that user when the status was set",
    )

    initiative_agreement = relationship(
        "InitiativeAgreement", back_populates="lifecycle_history"
    )
    lifecycle_status = relationship("InitiativeAgreementLifecycleStatus")
    user_profile = relationship("UserProfile")

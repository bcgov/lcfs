from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, Versioning

# Documents attach to a concrete action row; change-order-aware reads
# resolve across the group_uuid group like every other child (#4840).
designated_action_document_association = Table(
    "designated_action_document_association",
    BaseModel.metadata,
    Column(
        "designated_action_id",
        Integer,
        ForeignKey("designated_action.designated_action_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id"),
        primary_key=True,
    ),
)


class DesignatedAction(BaseModel, Auditable, Versioning):
    """
    Designated action within an initiative agreement (Schedule B) (#4805).

    Change orders (#5555) keep this row and its id: it always holds the
    accepted terms, and its children (evidence requirements and
    submissions, comments, documents, the credit transaction) stay attached
    to it. A change order's edits wait in designated_action_version until
    the Director accepts; then ``version`` is the accepted version and
    ``action_type`` what the last accepted change did (DELETE retires the
    action). An action a change order adds carries pending_change_order_id
    until acceptance. group_uuid groups any version rows written before
    that design; the current-version reads still resolve across it.
    """

    __tablename__ = "designated_action"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_id",
            "action_number",
            "version",
            name="uq_designated_action_agreement_number_version",
        ),
        Index("ix_designated_action_group_uuid", "group_uuid"),
        # Prevent shared transactions; row locks prevent duplicate issuance.
        Index(
            "uq_designated_action_transaction_id",
            "transaction_id",
            unique=True,
            postgresql_where=text("transaction_id IS NOT NULL"),
        ),
        {
            "comment": (
                "Designated actions defined in Schedule B of an initiative "
                "agreement: milestones with credit allocations, completion "
                "and determination tracking."
            )
        },
    )

    designated_action_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the designated action",
    )
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id"),
        nullable=False,
        index=True,
        comment="Parent initiative agreement",
    )
    action_number = Column(
        Integer,
        nullable=False,
        comment=(
            "Action number within the agreement; displayed as " "DA{n}-IA{agreement id}"
        ),
    )
    name = Column(String(500), nullable=False, comment="Designated action name/title")
    description = Column(
        Text,
        nullable=True,
        comment="Detailed description of the designated action",
    )
    specified_date = Column(
        Date,
        nullable=True,
        comment="Specified completion date from Schedule B",
    )
    completed_date = Column(Date, nullable=True, comment="Actual completion date")
    determination_date = Column(
        Date, nullable=True, comment="Date the determination was made"
    )
    credit_allocation = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        comment="Compliance units allocated to this action ('up to' amount)",
    )
    recommended_credits = Column(
        BigInteger,
        nullable=True,
        comment=(
            "Compliance units the analyst recommends issuing for this action. "
            "NULL until a recommendation is made — 0 is itself a meaningful "
            "recommendation. Bounded by credit_allocation at the API layer."
        ),
    )
    current_status_id = Column(
        Integer,
        ForeignKey("designated_action_status.designated_action_status_id"),
        nullable=False,
        index=True,
        comment="Current completion status",
    )
    determination = Column(
        String(100),
        nullable=True,
        comment=(
            "Determination result (e.g. Compliant, Non-Compliant, Waived); "
            "validated at the API layer"
        ),
    )
    assigned_analyst_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        index=True,
        comment="IDIR analyst assigned to this designated action",
    )
    transaction_id = Column(
        Integer,
        ForeignKey("transaction.transaction_id"),
        nullable=True,
        index=True,
        comment=(
            "Ledger transaction created when credits were issued for this "
            "action; set by consolidation of legacy award records and by "
            "automatic issuance on director approval"
        ),
    )

    pending_change_order_id = Column(
        Integer,
        ForeignKey(
            "initiative_agreement_change_order.initiative_agreement_change_order_id"
        ),
        nullable=True,
        index=True,
        comment=(
            "Change order that added this record, while it is not part of the "
            "accepted package. NULL for every accepted record; acceptance "
            "clears it (#5555)."
        ),
    )

    initiative_agreement = relationship(
        "InitiativeAgreement", back_populates="designated_actions"
    )
    current_status = relationship(
        "DesignatedActionStatus", back_populates="designated_actions"
    )
    assigned_analyst = relationship("UserProfile", foreign_keys=[assigned_analyst_id])
    transaction = relationship("Transaction")
    history = relationship(
        "DesignatedActionHistory", back_populates="designated_action"
    )
    evidence_requirements = relationship(
        "EvidenceRequirement", back_populates="designated_action"
    )
    evidence_submissions = relationship(
        "EvidenceSubmission", back_populates="designated_action"
    )
    da_eoc_submissions = relationship("DaEocSubmission", back_populates="designated_action")
    documents = relationship(
        "Document",
        secondary=designated_action_document_association,
        back_populates="designated_actions",
    )
    designated_action_internal_comments = relationship(
        "DesignatedActionInternalComment", back_populates="designated_action"
    )

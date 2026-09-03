from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

# Values accepted by initiative_agreement.agreement_type. Held as a plain
# String column rather than a PG enum: the taxonomy will grow, and a postgres
# enum cannot drop or reorder a value once shipped. Validated at the API layer,
# as designated_action.determination already is.
AGREEMENT_TYPE_INITIATIVE_AGREEMENT = "Initiative Agreement"
AGREEMENT_TYPE_P3A = "P3A"
AGREEMENT_TYPES = (AGREEMENT_TYPE_INITIATIVE_AGREEMENT, AGREEMENT_TYPE_P3A)

# Discriminates the agreement-management records from the legacy one-row-per
# credit-award records that share this table until the transaction-flow
# cutover. Grids and the agreement API filter on 'agreement'.
RECORD_KIND_LEGACY_AWARD = "legacy_award"
RECORD_KIND_AGREEMENT = "agreement"
RECORD_KINDS = (RECORD_KIND_LEGACY_AWARD, RECORD_KIND_AGREEMENT)

initiative_agreement_document_association = Table(
    "initiative_agreement_document_association",
    BaseModel.metadata,
    Column(
        "initiative_agreement_id",
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id"),
        primary_key=True,
    ),
)


class InitiativeAgreement(BaseModel, Auditable, EffectiveDates):
    """
    Initiative Agreement (s.15, Low Carbon Fuels Act).

    Parent record of the agreement-management hierarchy:
    initiative_agreement -> designated_action -> evidence_requirement /
    evidence_submission.

    This table predates the agreement-management module: it originally stored
    single director-approved credit awards. The award-era columns remain
    functional for the outgoing transaction flow and are planned to move to
    designated-action-level issuance at cutover (#4840); the agreement
    management columns are the go-forward schema (#4804).
    """

    __tablename__ = "initiative_agreement"
    __table_args__ = (
        {
            "comment": (
                "Initiative agreements (s.15 Low Carbon Fuels Act): parent "
                "record for designated actions and evidence tracking. Also "
                "holds legacy credit-award fields until the transaction-flow "
                "cutover."
            )
        },
    )

    initiative_agreement_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the initiative_agreement",
    )

    # --- Award-era fields (outgoing transaction flow; planned to move to
    # --- designated-action-level issuance at cutover, see #4840) ----------
    compliance_units = Column(BigInteger, comment="Compliance Units")
    transaction_effective_date = Column(
        DateTime, nullable=True, comment="Transaction effective date"
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
    current_status_id = Column(
        Integer,
        ForeignKey("initiative_agreement_status.initiative_agreement_status_id"),
        index=True,
    )

    # --- Agreement management fields (#4804) ------------------------------
    ia_code = Column(
        String(50),
        nullable=True,
        unique=True,
        comment=(
            "Agreement code, e.g. IA-25AZU1; unique when set. Backfilled for "
            "migrated legacy records at cutover."
        ),
    )
    agreement_type = Column(
        String(100),
        nullable=False,
        server_default=AGREEMENT_TYPE_INITIATIVE_AGREEMENT,
        comment=(
            "Kind of agreement: 'Initiative Agreement' or migrated legacy "
            "'P3A'. Validated at the API layer."
        ),
    )
    record_kind = Column(
        String(50),
        nullable=False,
        server_default=RECORD_KIND_LEGACY_AWARD,
        index=True,
        comment=(
            "'agreement' for agreement-management records, 'legacy_award' for "
            "the pre-existing one-row-per-credit-award records that share this "
            "table until the transaction-flow cutover. Agreement grids and "
            "APIs filter on 'agreement'."
        ),
    )
    lifecycle_status_id = Column(
        Integer,
        ForeignKey(
            "initiative_agreement_lifecycle_status."
            "initiative_agreement_lifecycle_status_id"
        ),
        nullable=True,
        index=True,
        comment=(
            "Agreement lifecycle status. Nullable: legacy award records have "
            "no lifecycle. Deliberately NOT current_status_id, which is the "
            "credit-award transaction status feeding transaction_status_view "
            "and the transaction materialized views."
        ),
    )
    title = Column(String(500), nullable=True, comment="Project title of the agreement")
    project_description = Column(
        Text, nullable=True, comment="Agreement brief / project summary"
    )
    contact_name = Column(
        String(500), nullable=True, comment="Agreement contact person name"
    )
    contact_email = Column(
        String(255), nullable=True, comment="Agreement contact email"
    )
    contact_phone = Column(String(50), nullable=True, comment="Agreement contact phone")
    entry_date = Column(
        Date,
        nullable=True,
        comment="Date the agreement was entered into the tracker",
    )
    agreement_start_date = Column(Date, nullable=True, comment="Agreement start date")
    agreement_end_date = Column(Date, nullable=True, comment="Agreement end date")
    total_credits_allocated = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        comment=(
            "Denormalized cache of the agreement's total allocation; "
            "reconciles against sum(designated_action.credit_allocation) "
            "where actions exist. Never read for balance calculations."
        ),
    )
    total_credits_issued = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        comment=(
            "Denormalized cache of sum(transaction.compliance_units) over "
            "this agreement's designated actions; reconciled by test, never "
            "read for balance. transaction.compliance_units is the only "
            "authority for issued credits."
        ),
    )

    to_organization = relationship(
        "Organization", back_populates="initiative_agreements"
    )
    designated_actions = relationship(
        "DesignatedAction", back_populates="initiative_agreement"
    )
    transaction = relationship("Transaction")
    history = relationship(
        "InitiativeAgreementHistory", back_populates="initiative_agreement"
    )
    current_status = relationship("InitiativeAgreementStatus")
    lifecycle_status = relationship(
        "InitiativeAgreementLifecycleStatus", back_populates="initiative_agreements"
    )
    initiative_agreement_internal_comments = relationship(
        "InitiativeAgreementInternalComment", back_populates="initiative_agreement"
    )

    documents = relationship(
        "Document",
        secondary=initiative_agreement_document_association,
        back_populates="initiative_agreements",
    )

    def __repr__(self):
        return self.compliance_units

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
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

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

# Kind of agreement held in a row of this table. Legacy Part 3 Agreements
# (P3A) migrated from the pre-LCFS system share the table with current
# Initiative Agreements. The type is created/dropped by migration.
agreement_type_enum = ENUM(
    "Initiative Agreement",
    "P3A",
    name="agreement_type_enum",
    create_type=False,
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
        agreement_type_enum,
        nullable=False,
        server_default="Initiative Agreement",
        comment=(
            "Kind of agreement: current Initiative Agreement or migrated "
            "legacy P3A."
        ),
    )
    title = Column(
        String(500), nullable=True, comment="Project title of the agreement"
    )
    project_description = Column(
        Text, nullable=True, comment="Agreement brief / project summary"
    )
    contact_name = Column(
        String(500), nullable=True, comment="Agreement contact person name"
    )
    contact_email = Column(
        String(255), nullable=True, comment="Agreement contact email"
    )
    contact_phone = Column(
        String(50), nullable=True, comment="Agreement contact phone"
    )
    entry_date = Column(
        Date,
        nullable=True,
        comment="Date the agreement was entered into the tracker",
    )
    agreement_start_date = Column(
        Date, nullable=True, comment="Agreement start date"
    )
    agreement_end_date = Column(Date, nullable=True, comment="Agreement end date")
    total_credits_allocated = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        comment=(
            "Total compliance units allocated under the agreement. "
            "Authoritative value, not derived from designated actions "
            "(legacy agreements may lack an action breakdown)."
        ),
    )
    total_credits_issued = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        comment=(
            "Total compliance units issued to date under the agreement. "
            "Authoritative value, not derived."
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

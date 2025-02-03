from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime, String, Table
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


class InitiativeAgreement(BaseModel, Auditable, EffectiveDates):
    __tablename__ = "initiative_agreement"
    __table_args__ = (
        {"comment": "Goverment to organization compliance units initiative agreement"},
    )

    initiative_agreement_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the initiative_agreement",
    )
    compliance_units = Column(BigInteger, comment="Compliance Units")
    transaction_effective_date = Column(
        DateTime, nullable=True, comment="Transaction effective date"
    )
    gov_comment = Column(
        String(1500), comment="Comment from the government to organization"
    )
    to_organization_id = Column(Integer, ForeignKey("organization.organization_id"))
    transaction_id = Column(Integer, ForeignKey("transaction.transaction_id"))
    current_status_id = Column(
        Integer,
        ForeignKey("initiative_agreement_status.initiative_agreement_status_id"),
    )

    to_organization = relationship(
        "Organization", back_populates="initiative_agreements"
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

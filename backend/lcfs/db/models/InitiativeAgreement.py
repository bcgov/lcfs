from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime, String
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class InitiativeAgreement(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'initiative_agreement'
    __table_args__ = (UniqueConstraint('initiative_agreement_id'),
                      {'comment': "Goverment to organization compliance units initiative agreement"}
    )

    initiative_agreement_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the initiative_agreement")
    compliance_units = Column(BigInteger, comment="Compliance Units")
    transaction_effective_date = Column(DateTime, nullable=True, comment='Transaction effective date')
    gov_comment = Column(String(1500), comment="Comment from the government to organization")
    to_organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'))
    current_status_id = Column(Integer, ForeignKey('initiative_agreement_status.initiative_agreement_status_id'))

    to_organization = relationship('Organization', back_populates='initiative_agreements')
    transaction = relationship('Transaction')
    history = relationship('InitiativeAgreementHistory', back_populates='initiative_agreement')
    current_status = relationship('InitiativeAgreementStatus')
    initiative_agreement_internal_comments = relationship('InitiativeAgreementInternalComment', back_populates='initiative_agreement')

    def __repr__(self):
        return self.compliance_units

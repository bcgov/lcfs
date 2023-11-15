from sqlalchemy import Column, Integer, Sequence, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class IssuanceHistory(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'issuance_history'
    __table_args__ = {'comment': "History record for issuance from governmnent to Organization"}


    id = Column(Integer, Sequence('issuance_id'), comment="Unique identifier for the issuance", primary_key=True, autoincrement=True)
    compliance_units = Column(BigInteger, comment='Issued compliance units record')
    issuance_id = Column(Integer, ForeignKey('issuance.id'))
    organization_id = Column(Integer, ForeignKey('organization.id'))
    transaction_id = Column(Integer, ForeignKey('transaction.id'))
    transaction_effective_date = Column(DateTime, comment="Transaction Effective date")
    # compliance_period = Column(Integer, )
    comment_id = Column(Integer, ForeignKey('comment.id'))

    organizations = relationship('Organization', back_populates='organizations')
    transaction = relationship('Transaction', back_populates='issuance_history')
    comment = relationship('Comment', back_populates='issuance_history')
    issuance = relationship('Issuance', back_populates='issuance_history')

    def __repr__(self):
        return self.compliance_units


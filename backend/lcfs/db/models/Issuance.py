from sqlalchemy import Column, Integer, Sequence, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Issuance(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'issuance'
    __table_args__ = {'comment': "Goverment to organization compliance units issuance"}


    id = Column(Integer, Sequence('issuance_id'), comment="Unique identifier for the issuance", primary_key=True, autoincrement=True)
    compliance_units = Column(BigInteger, comment="Compliance Units")
    organization_id = Column(Integer, ForeignKey('organization.id'))
    # compliance_period = Column(Integer )
    transaction_effective_date = Column(DateTime, comment='Transaction effective date')
    transaction_id = Column(Integer, ForeignKey('transaction.id'))
    comment_id = Column(Integer, ForeignKey('comment.id'))

    organizations = relationship('Organization', back_populates='transaction')
    transactions = relationship('Transaction', back_populates='issuance')
    comment = relationship('Comment', back_populates='issuance')
    issuance_history = relationship('IssuanceHistory', back_populates='issuance')

    def __repr__(self):
        return self.compliance_units


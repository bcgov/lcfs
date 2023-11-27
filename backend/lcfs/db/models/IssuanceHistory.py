from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class IssuanceHistory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'issuance_history'
    __table_args__ = (UniqueConstraint('issuance_history_id'),
                      {'comment': "History record for issuance from governmnent to Organization"}
    )

    issuance_history_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the issuance")
    compliance_units = Column(BigInteger, comment='Issued compliance units record')
    issuance_id = Column(Integer, ForeignKey('issuance.issuance_id'))
    organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    transaction_id = Column(Integer, ForeignKey('transaction.transaction_id'))
    transaction_effective_date = Column(DateTime, comment="Transaction Effective date")
    # compliance_period = Column(Integer, )

    issuance = relationship('Issuance', back_populates='issuance_history_records')
    transaction = relationship('Transaction', back_populates='issuance_history_record')
    organization = relationship('Organization')
    # issuance_status = relationship('IssuanceStatus') Missing table

    def __repr__(self):
        return self.compliance_units


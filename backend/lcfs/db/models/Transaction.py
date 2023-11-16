from sqlalchemy import Column, Integer, Sequence, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Transaction(BaseModel,Auditable, EffectiveDates):
    __tablename__ = 'transaction'
    __table_args__ = (UniqueConstraint('transaction_id'),
        {'comment': "Contains a list of all of the government to organization and Organization to Organization transaction."}
    )


    transaction_id = Column(Integer, Sequence('transaction_id'), comment="Unique identifier for the transactions", primary_key=True, autoincrement=True)
    compliance_units = Column(BigInteger, comment="Compliance Units")
    issuance_id = Column(Integer, ForeignKey('issuance.issuance_id'))
    transfer_id = Column(Integer, ForeignKey('transfer.transfer_id'))
    transaction_type = Column(Integer, ForeignKey('transaction_type.transaction_type_id'))
    organization = Column(Integer, ForeignKey('organization.id'))

    organizations = relationship('Organization', back_populates='transaction')
    issuance = relationship('Issuance', back_populates='transactions')
    transfer = relationship('Transfer', back_populates='transactions')
    transaction_type = relationship('TransactionType', back_populates='transactions')
    issuance_history = relationship('IssuanceHistory', back_populates='transaction')
    transfer_history = relationship('TransferHistory', back_populates='transaction')

    def __repr__(self):
        return self.compliance_units


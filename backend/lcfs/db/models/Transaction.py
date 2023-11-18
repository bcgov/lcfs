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
    transaction_type_id = Column(Integer, ForeignKey('transaction_type.transaction_type_id'))
    organization_id = Column(Integer, ForeignKey('organization.organization_id'))

    organization = relationship('Organization', back_populates='transactions')
    transaction_type = relationship('TransactionType')
    issuance_history_record = relationship('IssuanceHistory', back_populates='transaction')
    transfer_history_record = relationship('TransferHistory', back_populates='transaction')

    def __repr__(self):
        return self.compliance_units


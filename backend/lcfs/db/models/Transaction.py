import enum

from sqlalchemy import Column, Integer, BigInteger, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint

from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class TransactionActionEnum(enum.Enum):
    Adjustment = "Adjustment"
    Reserved = "Reserved"
    Released = "Released"

class Transaction(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transaction'
    __table_args__ = (UniqueConstraint('transaction_id'),
        {'comment': "Contains a list of all of the government to organization and Organization to Organization transaction."}
    )

    transaction_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the transactions")
    compliance_units = Column(BigInteger, comment="Compliance Units")
    organization_id = Column(Integer, ForeignKey('organization.organization_id'))
    transaction_action = Column(Enum(TransactionActionEnum, name="transaction_action_enum", create_type=True), comment="Action type for the transaction, e.g., Adjustment, Reserved, or Released.")

    organization = relationship('Organization', back_populates='transactions')
    admin_adjustment_record = relationship('AdminAdjustment', back_populates='transaction')
    initiative_agreement_record = relationship('InitiativeAgreement', back_populates='transaction')
    transfer_record = relationship('Transfer', back_populates='transaction')

    def __repr__(self):
        return self.compliance_units

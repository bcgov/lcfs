from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Sequence
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum

class TransactionTypeEnum(enum.Enum):
    administrative_adjustment = "Administrative Adjustment"
    initiative_agreement = "Initiative Agreement"
    assessment = "Assessment"
    transfer = "Transfer"

class TransactionType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'transaction_type'
    __table_args__ = {'comment': "Represents a Transaction types"}

    transaction_type_id = Column(Integer, Sequence('transaction_type_id'), primary_key=True, autoincrement=True)
    type = Column(Enum(TransactionTypeEnum, name="transaction_type_enum", create_type=True), comment="Transaction Types")

    transactions = relationship('Transaction', back_populates='transaction_type')

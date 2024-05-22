from sqlalchemy import Column, Integer, String, Date
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, EffectiveDates, DisplayOrder

class AllocationTransactionType(BaseModel, EffectiveDates, DisplayOrder):
    __tablename__ = 'allocation_transaction_type'
    __table_args__ = (
        {'comment': "Lookup table for allocation transaction types."}
    )
    
    allocation_transaction_type_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the allocation transaction type")
    type = Column(String, nullable=False, comment="Type of the allocation transaction")
    description = Column(String, nullable=True, comment="Description of the allocation transaction type")

    def __repr__(self):
        return f"<AllocationTransactionType(id={self.allocation_transaction_type_id}, type={self.type})>"

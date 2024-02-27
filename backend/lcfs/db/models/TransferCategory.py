from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class TransferCategory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transfer_category'
    __table_args__ = (UniqueConstraint('transfer_category_id'),
                      {'comment': "Transfer Category"}
    )

    transfer_category_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the transfer category")
    category = Column(String(500), comment="Transfer category")

    def __repr__(self):
        return self.category

from sqlalchemy import Column, Integer, Sequence, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Category(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'category'
    __table_args__ = (UniqueConstraint('category_id'),
                      {'comment': "Transfer Category"}
    )


    category_id = Column(Integer, Sequence('issuance_id'), comment="Unique identifier for the transfer category", primary_key=True, autoincrement=True)
    category = Column(String(500), comment="Transfer category")

    transfer = relationship('Transfer', back_populates='category')
    transfer_history = relationship('TransferHistory', back_populates='transfer_category')


    def __repr__(self):
        return self.category


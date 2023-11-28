from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class Category(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'category'
    __table_args__ = (UniqueConstraint('category_id'),
                      {'comment': "Transfer Category"}
    )


    category_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the transfer category")
    category = Column(String(500), comment="Transfer category")

    transfer = relationship('Transfer', back_populates='category')
    transfer_history = relationship('TransferHistory', back_populates='transfer_category')


    def __repr__(self):
        return self.category


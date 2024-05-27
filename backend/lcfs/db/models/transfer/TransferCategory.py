from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates
import enum


class TransferCategoryEnum(enum.Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class TransferCategory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transfer_category'
    __table_args__ = (UniqueConstraint('transfer_category_id'),
                      {'comment': "Transfer Category"}
                      )

    transfer_category_id = Column(Integer, primary_key=True, autoincrement=True,
                                  comment="Unique identifier for the transfer category")
    category = Column(
        Enum(TransferCategoryEnum, create_type=True), comment="Transfer category")

    def __repr__(self):
        return self.category

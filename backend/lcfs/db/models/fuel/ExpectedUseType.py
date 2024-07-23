from sqlalchemy import Column, Integer, Text
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder, EffectiveDates

class ExpectedUseType(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    __tablename__ = "expected_use_type"
    __table_args__ = {
        "comment": "Represents an expected use type for other fuels"
    }

    expected_use_type_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the expected use type")
    name = Column(Text, nullable=False, comment="Name of the expected use type")
    description = Column(Text, nullable=True, comment="Description of the expected use type")

    other_uses = relationship('OtherUses', back_populates='expected_use')

    def __repr__(self):
        return f"<ExpectedUseType(id={self.expected_use_type_id}, name={self.name})>"

from sqlalchemy import Column, Integer, Text, Boolean
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class FuelType(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'fuel_type'
    __table_args__ = {'comment': "Represents a Fuel Type"}

    fuel_type_id = Column(
        Integer, primary_key=True, autoincrement=True)
    fuel_type = Column(Text, nullable=False)
    fossil_derived = Column(Boolean, default=False)

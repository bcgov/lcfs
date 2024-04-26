from sqlalchemy import Column, Integer, Text
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class FuelCodePrefix(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'fuel_code_prefix'
    __table_args__ = {'comment': "Represents a Fuel code prefix"}

    fuel_code_prefix_id = Column(
        Integer, primary_key=True, autoincrement=True)
    prefix = Column(Text, nullable=False)

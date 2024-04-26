from sqlalchemy import Column, Integer, Text
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class TransportMode(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'transport_mode'
    __table_args__ = {'comment': "Represents a Transport Mode Type"}

    transport_mode_id = Column(
        Integer, primary_key=True, autoincrement=True)
    transport_mode = Column(Text, nullable=False)

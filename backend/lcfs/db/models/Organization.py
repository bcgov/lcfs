from sqlalchemy import Column, String, Boolean, Integer
from lcfs.db.base import Auditable

class Organization(Auditable):
    __tablename__ = 'organization'
    __table_args__ = {'comment': 'Organizations'}

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, comment="Organization Name")

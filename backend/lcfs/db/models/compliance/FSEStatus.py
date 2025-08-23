from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class FSEStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "fse_status"
    __table_args__ = {"comment": "Status values for final supply equipment"}

    fse_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the final supply equipment status",
    )
    status = Column(String(50), nullable=False, unique=True, comment="FSE status")
    description = Column(String(500), nullable=True, comment="Status description")

    fse = relationship("FSE", back_populates="status")

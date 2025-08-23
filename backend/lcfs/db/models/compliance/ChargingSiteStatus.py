from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class ChargingSiteStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "charging_site_status"
    __table_args__ = {"comment": "Status values for charging sites"}

    charging_site_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the charging site status",
    )
    status = Column(
        String(50), nullable=False, unique=True, comment="Charging site status"
    )
    description = Column(String(500), nullable=True, comment="Status description")

    charging_sites = relationship("ChargingSite", back_populates="status")

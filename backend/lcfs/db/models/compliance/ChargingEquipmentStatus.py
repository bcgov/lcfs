from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class ChargingEquipmentStatus(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "charging_equipment_status"
    __table_args__ = {"comment": "Status values for charging equipment"}

    charging_equipment_status_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the charging equipment status",
    )
    status = Column(
        String(50), nullable=False, unique=True, comment="Charging equipment status"
    )
    description = Column(String(500), nullable=True, comment="Status description")

    charging_equipment = relationship("ChargingEquipment", back_populates="status")

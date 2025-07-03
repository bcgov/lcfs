from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    JSON,
)
from lcfs.db.base import BaseModel, Auditable, Versioning
from sqlalchemy.orm import relationship


class FuelCodeHistory(BaseModel, Auditable, Versioning):
    __tablename__ = "fuel_code_history"
    __table_args__ = {"comment": "Audit trail for all fuel code changes"}

    fuel_code_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the history record",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id"),
        nullable=False,
        comment="Reference to the fuel code",
    )
    fuel_status_id = Column(
        Integer,
        ForeignKey("fuel_code_status.fuel_code_status_id"),
        comment="Fuel code status",
    )

    # Snapshot of fuel code at time of change
    fuel_code_snapshot = Column(
        JSON,
        nullable=True,
        comment="Complete snapshot of fuel code data at time of change",
    )

    # Relationships
    fuel_code = relationship(
        "FuelCode", back_populates="history_records", lazy="selectin"
    )

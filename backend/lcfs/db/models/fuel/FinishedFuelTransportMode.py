from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from lcfs.db.base import BaseModel, Auditable
from sqlalchemy.orm import relationship


class FinishedFuelTransportMode(BaseModel, Auditable):
    __tablename__ = "finished_fuel_transport_mode"
    __table_args__ = {
        "comment": "Contains a list of transport modes associated with finished fuel"
    }

    finished_fuel_transport_mode_id = Column(
        Integer, primary_key=True, autoincrement=True, comment="Unique identifier"
    )

    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id", ondelete="CASCADE"),
        comment="Fuel code identifier",
    )

    transport_mode_id = Column(
        Integer,
        ForeignKey("transport_mode.transport_mode_id", ondelete="CASCADE"),
        comment="Transport mode identifier",
    )
    # Define relationships
    finished_fuel_code = relationship(
        "FuelCode", back_populates="finished_fuel_transport_modes"
    )
    finished_fuel_transport_mode = relationship(
        "TransportMode", back_populates="finished_fuel_transport_modes"
    )

    # Add unique constraint on fuel_code_id and transport_mode_id
    __table_args__ = (
        UniqueConstraint("fuel_code_id", "transport_mode_id"),
        __table_args__,
    )

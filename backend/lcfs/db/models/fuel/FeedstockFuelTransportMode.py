from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from lcfs.db.base import BaseModel, Auditable
from sqlalchemy.orm import relationship


class FeedstockFuelTransportMode(BaseModel, Auditable):
    __tablename__ = "feedstock_fuel_transport_mode"
    __table_args__ = {
        "comment": "Contains a list of transport modes associated with feedstock fuel"
    }

    feedstock_fuel_transport_mode_id = Column(
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
    feedstock_fuel_code = relationship("FuelCode", back_populates="feedstock_fuel_transport_modes")
    feedstock_fuel_transport_mode = relationship(
        "TransportMode", back_populates="feedstock_fuel_transport_modes"
    )

    # Add unique constraint on fuel_code_id and transport_mode_id
    __table_args__ = (
        UniqueConstraint("fuel_code_id", "transport_mode_id"),
        __table_args__,
    )

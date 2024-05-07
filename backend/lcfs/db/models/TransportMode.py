from sqlalchemy import Column, Integer, Text
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship


class TransportMode(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "transport_mode"
    __table_args__ = {"comment": "Represents a Transport Mode Type"}

    transport_mode_id = Column(Integer, primary_key=True, autoincrement=True)
    transport_mode = Column(Text, nullable=False)

    # Define relationships
    feedstock_fuel_transport_modes = relationship(
        "FeedstockFuelTransportMode",
        back_populates="feedstock_fuel_transport_mode",
        primaryjoin="TransportMode.transport_mode_id == FeedstockFuelTransportMode.transport_mode_id"
    )

    finished_fuel_transport_modes = relationship(
        "FinishedFuelTransportMode",
        back_populates="finished_fuel_transport_mode",
        primaryjoin="TransportMode.transport_mode_id == FinishedFuelTransportMode.transport_mode_id"
    )

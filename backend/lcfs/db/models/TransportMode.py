from sqlalchemy import Column, Integer, Text
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from lcfs.db.models.FuelCode import FuelCode
from sqlalchemy.orm import relationship


class TransportMode(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "transport_mode"
    __table_args__ = {"comment": "Represents a Transport Mode Type"}

    transport_mode_id = Column(Integer, primary_key=True, autoincrement=True)
    transport_mode = Column(Text, nullable=False)

    # Relationship with feedstock_transport_mode
    feedstock_fuel_codes = relationship(
        "FuelCode",
        back_populates="feedstock_transport_mode",
        foreign_keys=[FuelCode.feedstock_transport_mode_id],
    )

    # Relationship with finished_fuel_transport_mode
    finished_fuel_codes = relationship(
        "FuelCode",
        back_populates="finished_fuel_transport_mode",
        foreign_keys=[FuelCode.finished_fuel_transport_mode_id],
    )

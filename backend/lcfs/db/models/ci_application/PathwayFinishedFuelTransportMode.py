from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class PathwayFinishedFuelTransportMode(BaseModel, Auditable):
    __tablename__ = "pathway_finished_fuel_transport_mode"
    __table_args__ = (
        UniqueConstraint("pathway_id", "transport_mode_id"),
        {
            "comment": "Transport modes and distances associated with pathway finished fuel"
        },
    )

    pathway_finished_fuel_transport_mode_id = Column(
        Integer, primary_key=True, autoincrement=True, comment="Unique identifier"
    )
    pathway_id = Column(
        Integer,
        ForeignKey("pathway.pathway_id", ondelete="CASCADE"),
        nullable=False,
        comment="Pathway identifier",
    )
    transport_mode_id = Column(
        Integer,
        ForeignKey("transport_mode.transport_mode_id", ondelete="CASCADE"),
        nullable=False,
        comment="Transport mode identifier",
    )
    distance = Column(
        Integer,
        nullable=False,
        comment="Distance in kilometres for this finished fuel transport mode",
    )

    pathway = relationship("Pathway", back_populates="finished_fuel_transport_modes")
    transport_mode = relationship("TransportMode")

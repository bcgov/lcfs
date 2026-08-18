from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class PathwayFeedstockTransportMode(BaseModel, Auditable):
    __tablename__ = "pathway_feedstock_transport_mode"
    __table_args__ = (
        UniqueConstraint("pathway_id", "transport_mode_id"),
        {"comment": "Transport modes and distances associated with pathway feedstock"},
    )

    pathway_feedstock_transport_mode_id = Column(
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
        comment=(
            "Distance in kilometres for this feedstock transport mode. CI pathway "
            "applications require mode-level distances."
        ),
    )

    pathway = relationship("Pathway", back_populates="feedstock_transport_modes")
    transport_mode = relationship("TransportMode")

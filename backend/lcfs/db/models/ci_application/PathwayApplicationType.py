from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class PathwayApplicationType(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "pathway_application_type"
    __table_args__ = {
        "comment": "Lookup table for CI application pathway types (New or Renewal)"
    }

    pathway_application_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the pathway application type",
    )
    type = Column(
        String(100),
        nullable=False,
        comment="Pathway application type value (e.g. New, Renewal)",
    )
    description = Column(
        String(500), nullable=True, comment="Optional description of the type"
    )

    pathways = relationship("Pathway", back_populates="application_type")

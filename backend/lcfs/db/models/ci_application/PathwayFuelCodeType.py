from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder


class PathwayFuelCodeType(BaseModel, Auditable, DisplayOrder):
    __tablename__ = "pathway_fuel_code_type"
    __table_args__ = {
        "comment": "Lookup table for CI pathway fuel code duration types"
    }

    pathway_fuel_code_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the pathway fuel code type",
    )
    type = Column(
        String(100),
        nullable=False,
        comment="Fuel code duration type value (e.g. 1-year provisional, 3-year)",
    )
    description = Column(
        String(500), nullable=True, comment="Optional description of the type"
    )

    pathways = relationship("Pathway", back_populates="fuel_code_type")

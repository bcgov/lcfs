from sqlalchemy import Column, Integer, Enum, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum


class FuelCodeStatusEnum(enum.Enum):
    Draft: str = "Draft"
    Recommended: str = "Recommended"
    Approved: str = "Approved"
    Deleted: str = "Deleted"


class FuelCodeStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "fuel_code_status"
    __table_args__ = {"comment": "Represents fuel code status"}

    fuel_code_status_id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(
        Enum(FuelCodeStatusEnum, name="fuel_code_status_enum", create_type=True),
        comment="Fuel code status",
    )
    description = Column(String(500), nullable=True, comment="Organization description")

    fuel_codes = relationship("FuelCode", back_populates="fuel_code_status")

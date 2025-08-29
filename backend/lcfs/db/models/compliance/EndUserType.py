from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel


class EndUserType(BaseModel):
    """
    Model representing the end user type for the final supply equipment.
    """

    __tablename__ = "end_user_type"
    __table_args__ = {"comment": "Types of intended users for supply equipment"}

    end_user_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="The unique identifier for the end user type.",
    )
    type_name = Column(
        String, nullable=False, unique=True, comment="The name of the end user type."
    )
    intended_use = Column(Boolean, nullable=False, default=True)

    # Establish bidirectional relationship with FinalSupplyEquipment
    final_supply_equipments = relationship(
        "FinalSupplyEquipment",
        secondary="final_supply_intended_user_association",
        back_populates="intended_user_types",
    )

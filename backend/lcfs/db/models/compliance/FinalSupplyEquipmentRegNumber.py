from lcfs.db.base import BaseModel
from sqlalchemy import Column, Integer, String, PrimaryKeyConstraint

class FinalSupplyEquipmentRegNumber(BaseModel):
    """
    Model representing the highest sequence number for a given postal code
    to generate unique registration numbers for final supply equipment.
    """

    __tablename__ = "final_supply_equipment_reg_number"
    __table_args__ = (
        PrimaryKeyConstraint('organization_code', 'postal_code'),
        {"comment": "Tracks the highest sequence numbers for final supply equipment registration numbers by postal code and organization code."}
    )

    organization_code = Column(String, nullable=False, comment="The organization code for the final supply equipment.")
    postal_code = Column(String, nullable=False, comment="The postal code for the final supply equipment.")
    current_sequence_number = Column(Integer, nullable=False, comment="Current sequence number used for the postal code.")

from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import Column, Date, Double, Integer, String, Table, Text
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

# Association table for many-to-many relationship
final_supply_intended_use_association = Table(
    'final_supply_intended_use_association',
    BaseModel.metadata,
    Column('final_supply_equipment_id', Integer, ForeignKey('final_supply_equipment.final_supply_equipment_id', ondelete='CASCADE'), primary_key=True),
    Column('end_use_type_id', Integer, ForeignKey('end_use_type.end_use_type_id'), primary_key=True)
)
class FinalSupplyEquipment(BaseModel, Auditable):
    """
    Model representing a final supply equipment.
    """

    __tablename__ = "final_supply_equipment"
    __table_args__ = {"comment": "Final Supply Equipment"}

    final_supply_equipment_id = Column(Integer, primary_key=True, autoincrement=True, comment="The unique identifier for the final supply equipment.")
    compliance_report_id = Column(Integer, ForeignKey("compliance_report.compliance_report_id"), nullable=False, comment="The foreign key referencing the compliance report.", index=True)
    supply_from_date = Column(Date, nullable=False, comment="The date from which the equipment is supplied.")
    supply_to_date = Column(Date, nullable=False, comment="The date until which the equipment is supplied.")
    serial_nbr = Column(String, nullable=False, comment="The serial number of the equipment.")
    manufacturer = Column(String, nullable=False, comment="The manufacturer of the equipment.")
    level_of_equipment_id = Column(Integer, ForeignKey("level_of_equipment.level_of_equipment_id"), nullable=False, comment="The foreign key referencing the level of equipment.", index=True)
    fuel_measurement_type_id = Column(Integer, ForeignKey("fuel_measurement_type.fuel_measurement_type_id"), nullable=False, comment="The foreign key referencing the fuel measurement type.", index=True)
    street_address = Column(String, nullable=False, comment="The street address of the equipment location.")
    city = Column(String, nullable=False, comment="The city of the equipment location.")
    postal_code = Column(String, nullable=False, comment="The postcode of the equipment location.")
    latitude = Column(Double, nullable=False, comment="The latitude of the equipment location.")
    longitude = Column(Double, nullable=False, comment="The longitude of the equipment location.")
    notes = Column(Text, comment="Any additional notes related to the equipment.")

    # relationships
    compliance_report = relationship("ComplianceReport", back_populates="final_supply_equipment")
    level_of_equipment = relationship("LevelOfEquipment", back_populates="final_supply_equipment")
    fuel_measurement_type = relationship("FuelMeasurementType", back_populates="final_supply_equipment")
    intended_use_types = relationship("EndUseType", secondary=final_supply_intended_use_association, back_populates="final_supply_equipments")
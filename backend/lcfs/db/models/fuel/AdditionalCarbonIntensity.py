from sqlalchemy import Column, Integer, Float
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey


class AdditionalCarbonIntensity(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "additional_carbon_intensity"
    __table_args__ = {
        "comment": "Additional carbon intensity attributable to the use of fuel. UCIs are added to the recorded carbon intensity of the fuel to account for additional carbon intensity attributed to the use of the fuel."
    }
    # if both fuel type and end use type id's are null, then this is a default uci
    additional_uci_id = Column(Integer, primary_key=True, autoincrement=True)
    fuel_type_id = Column(Integer, ForeignKey("fuel_type.fuel_type_id"), nullable=True)
    end_use_type_id = Column(
        Integer, ForeignKey("end_use_type.end_use_type_id"), nullable=True
    )
    uom_id = Column(Integer, ForeignKey("unit_of_measure.uom_id"), nullable=False)
    intensity = Column(Float(10, 2), nullable=False)

    fuel_type = relationship("FuelType", back_populates="additional_carbon_intensity")
    end_use_type = relationship("EndUseType", back_populates="additional_carbon_intensity")
    uom = relationship("UnitOfMeasure", back_populates="additional_carbon_intensity")
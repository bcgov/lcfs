from sqlalchemy import Column, Float, Integer, String
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, EffectiveDates, DisplayOrder
from sqlalchemy import ForeignKey


class CustomFuelType(BaseModel, EffectiveDates, DisplayOrder):
    __tablename__ = "custom_fuel_type"
    __table_args__ = {"comment": "Lookup table for custom fuel types."}

    custom_fuel_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the custom fuel type",
    )
    type = Column(String, nullable=False, comment="Type of the custom fuel")
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Foreign key to fuel_category table",
    )
    provision_of_the_act_id = Column(
        Integer,
        ForeignKey("provision_of_the_act.provision_of_the_act_id"),
        nullable=False,
        comment="Foreign key to provision_of_the_act table",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id"),
        nullable=False,
        comment="Foreign key to fuel_code table",
    )
    unit = Column(String, nullable=False, comment="Units of fuel quantity")
    energy_density = Column(
        Float(10, 2), nullable=False, comment="Energy density of the fuel"
    )

    description = Column(
        String, nullable=True, comment="Description of the custom fuel type"
    )

    fuel_supplies = relationship("FuelSupply", back_populates="custom_fuel_type")
    fuel_exports = relationship("FuelExport", back_populates="custom_fuel_type")
    fuel_category = relationship("FuelCategory")
    provisoin_of_the_act = relationship("ProvisionOfTheAct")
    fuel_code = relationship("FuelCode")

    def __repr__(self):
        return f"<CustomFuelType(id={self.custom_fuel_type_id}, type={self.type})>"

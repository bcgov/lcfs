import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text
from lcfs.db.base import BaseModel, Auditable, Versioning
from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum


class FuelSupply(BaseModel, Auditable, Versioning):
    __tablename__ = "fuel_supply"
    __table_args__ = {
        "comment": "Records the supply of fuel for compliance purposes, including changes in supplemental reports"
    }

    fuel_supply_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the fuel supply version",
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the compliance report",
    )

    # Data columns
    quantity = Column(Integer, nullable=False, comment="Quantity of fuel supplied")
    units = Column(
        Enum(QuantityUnitsEnum), nullable=False, comment="Units of fuel quantity"
    )
    compliance_units = Column(Integer, nullable=True, comment="Compliance units")
    target_ci = Column(Numeric(10, 2), nullable=True, comment="Target Carbon Intensity")
    ci_of_fuel = Column(Numeric(10, 2), nullable=True, comment="CI of the fuel")
    energy_density = Column(Numeric(10, 2), nullable=True, comment="Energy density")
    eer = Column(Numeric(10, 2), nullable=True, comment="Energy Effectiveness Ratio")
    energy = Column(Integer, nullable=True, comment="Energy content")

    # Relational columns
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Foreign key to the fuel category",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id"),
        nullable=True,
        comment="Foreign key to the fuel code",
    )
    fuel_type_id = Column(
        Integer,
        ForeignKey("fuel_type.fuel_type_id"),
        nullable=False,
        comment="Foreign key to the fuel type",
    )
    provision_of_the_act_id = Column(
        Integer,
        ForeignKey("provision_of_the_act.provision_of_the_act_id"),
        nullable=False,
        comment="Foreign key to the provision of the act",
    )
    custom_fuel_id = Column(
        Integer,
        ForeignKey("custom_fuel_type.custom_fuel_type_id"),
        nullable=True,
        comment="Foreign key to the custom fuel type",
    )
    end_use_id = Column(
        Integer,
        ForeignKey("end_use_type.end_use_type_id"),
        nullable=True,
        comment="Foreign key to the end use type",
    )

    # Relationships
    compliance_report = relationship("ComplianceReport", back_populates="fuel_supplies")
    fuel_category = relationship("FuelCategory")
    fuel_code = relationship("FuelCode")
    fuel_type = relationship("FuelType")
    provision_of_the_act = relationship("ProvisionOfTheAct")
    custom_fuel_type = relationship("CustomFuelType")
    end_use_type = relationship("EndUseType")

    def __repr__(self):
        return f"<FuelSupply(id={self.fuel_supply_id}>"

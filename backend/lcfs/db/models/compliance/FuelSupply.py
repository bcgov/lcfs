from sqlalchemy import Column, Integer, ForeignKey, Enum, String, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text
from lcfs.db.base import BaseModel, Auditable
from lcfs.db.models.compliance.ComplianceReport import (
    ChangeType,
    Quarter,
    QuantityUnitsEnum,
)


class FuelSupply(BaseModel, Auditable):
    __tablename__ = "fuel_supply"
    __table_args__ = {
        "comment": "Records the supply of fuel for compliance purposes, including changes in supplemental reports"
    }

    fuel_supply_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the fuel supply",
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the compliance report",
    )
    supplemental_report_id = Column(
        Integer,
        ForeignKey("supplemental_report.supplemental_report_id"),
        nullable=True,
        comment="Foreign key to the supplemental report",
    )
    previous_fuel_supply_id = Column(
        Integer,
        ForeignKey("fuel_supply.fuel_supply_id"),
        nullable=True,
        comment="Foreign key to the previous fuel supply record",
    )
    change_type = Column(
        Enum(ChangeType),
        nullable=False,
        server_default=text("'CREATE'"),
        comment="Action type for this record",
    )

    # data columns
    quarter = Column(
        Enum(Quarter), nullable=True, comment="Quarter for quarterly reports"
    )
    quantity = Column(Integer, nullable=False, comment="Quantity of fuel supplied")
    units = Column(
        Enum(QuantityUnitsEnum), nullable=False, comment="Units of fuel quantity"
    )
    compliance_units = Column(
        Integer, nullable=True, comment="Compliance units for the fuel supply"
    )
    target_ci = Column(
        Numeric(10, 2), nullable=True, comment="Target CI for the fuel supply"
    )
    ci_of_fuel = Column(
        Numeric(10, 2), nullable=True, comment="CI of fuel for the fuel supply"
    )
    energy_density = Column(
        Numeric(10, 2), nullable=True, comment="Energy density of the fuel supplied"
    )
    eer = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Energy effectiveness ratio of the fuel supplied",
    )
    energy = Column(
        Integer, nullable=True, comment="Energy content of the fuel supplied"
    )
    fuel_type_other = Column(
        String(1000), nullable=True, comment="Other fuel type is one provided"
    )

    # relational columns
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

    compliance_report = relationship("ComplianceReport", back_populates="fuel_supplies")
    supplemental_report = relationship(
        "SupplementalReport", back_populates="fuel_supplies"
    )
    previous_fuel_supply = relationship("FuelSupply", remote_side=[fuel_supply_id])

    fuel_category = relationship("FuelCategory")
    fuel_code = relationship("FuelCode")
    fuel_type = relationship("FuelType")
    provision_of_the_act = relationship("ProvisionOfTheAct")
    custom_fuel_type = relationship("CustomFuelType")
    end_use_type = relationship("EndUseType")

    def __repr__(self):
        return f"<FuelSupply(id={self.fuel_supply_id}, quantity={self.quantity})>"

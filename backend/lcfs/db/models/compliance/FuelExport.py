from sqlalchemy import Column, Date, Integer, ForeignKey, Enum, String, Numeric, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text

from lcfs.db.base import BaseModel, Auditable, Versioning
from lcfs.db.models.compliance.ComplianceReport import (
    Quarter,
    QuantityUnitsEnum,
)


class FuelExport(BaseModel, Auditable, Versioning):
    __tablename__ = "fuel_export"
    __table_args__ = {
        "comment": "Records the supply of fuel for compliance purposes, including changes in supplemental reports"
    }

    fuel_export_id = Column(
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

    # data columns
    export_date = Column(Date, nullable=True, comment="Date of fuel supply")
    quarter = Column(
        Enum(Quarter), nullable=True, comment="Quarter for quarterly reports"
    )
    quantity = Column(BigInteger, nullable=False, comment="Quantity of fuel supplied")
    units = Column(
        Enum(QuantityUnitsEnum), nullable=False, comment="Units of fuel quantity"
    )
    compliance_units = Column(
        Numeric(13, 5), nullable=True, comment="Compliance units for the fuel supply"
    )
    target_ci = Column(
        Numeric(13, 5), nullable=True, comment="CI limit for the fuel supply"
    )
    ci_of_fuel = Column(
        Numeric(10, 2), nullable=True, comment="CI of fuel for the fuel supply"
    )
    uci = Column(Numeric(10, 2), nullable=True, comment="Additional Carbon Intensity")
    energy_density = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Energy density of the fuel supplied",
    )
    eer = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Energy effectiveness ratio of the fuel supplied",
    )
    energy = Column(
        Numeric(12, 2),
        nullable=True,
        comment="Energy content of the fuel supplied",
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
    end_use_id = Column(
        Integer,
        ForeignKey("end_use_type.end_use_type_id"),
        nullable=True,
        comment="Foreign key to the end use type",
    )
    fuel_type_other = Column(
        String(1000), nullable=True, comment="Other fuel type if one provided"
    )

    compliance_report = relationship("ComplianceReport", back_populates="fuel_exports")
    fuel_category = relationship("FuelCategory")
    fuel_code = relationship("FuelCode")
    fuel_type = relationship("FuelType")
    provision_of_the_act = relationship("ProvisionOfTheAct")
    end_use_type = relationship("EndUseType")

    def __repr__(self):
        return f"<FuelExport(id={self.fuel_export_id}, quantity={self.quantity})>"

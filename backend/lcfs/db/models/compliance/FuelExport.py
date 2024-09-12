from sqlalchemy import Column, Date, Integer, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text
from lcfs.db.base import BaseModel, Auditable
from lcfs.db.models.compliance.ComplianceReport import (
    ChangeType,
    Quarter,
    QuantityUnitsEnum,
)


class FuelExport(BaseModel, Auditable):
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
    supplemental_report_id = Column(
        Integer,
        ForeignKey("supplemental_report.supplemental_report_id"),
        nullable=True,
        comment="Foreign key to the supplemental report",
    )
    previous_fuel_export_id = Column(
        Integer,
        ForeignKey("fuel_export.fuel_export_id"),
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
    export_date = Column(Date, nullable=False, comment="Date of fuel supply")
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
    target_ci = Column(Float, nullable=True, comment="CI limit for the fuel supply")
    ci_of_fuel = Column(Float, nullable=True, comment="CI of fuel for the fuel supply")
    energy_density = Column(
        Float, nullable=True, comment="Energy density of the fuel supplied"
    )
    eer = Column(
        Float, nullable=True, comment="Energy effectiveness ratio of the fuel supplied"
    )
    energy = Column(Float, nullable=True, comment="Energy content of the fuel supplied")

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

    compliance_report = relationship("ComplianceReport", back_populates="fuel_exports")
    supplemental_report = relationship(
        "SupplementalReport", back_populates="fuel_exports"
    )
    previous_fuel_export = relationship("FuelExport", remote_side=[fuel_export_id])

    fuel_category = relationship("FuelCategory")
    fuel_code = relationship("FuelCode")
    fuel_type = relationship("FuelType")
    provision_of_the_act = relationship("ProvisionOfTheAct")
    custom_fuel_type = relationship("CustomFuelType")
    end_use_type = relationship("EndUseType")

    def __repr__(self):
        return f"<FuelExport(id={self.fuel_export_id}, quantity={self.quantity})>"

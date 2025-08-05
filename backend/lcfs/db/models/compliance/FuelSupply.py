from sqlalchemy import Column, Integer, ForeignKey, Enum, String, Numeric, BigInteger
from sqlalchemy.orm import relationship
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
    quantity = Column(
        BigInteger, nullable=True, comment="Quantity of fuel supplied (no early issuance)"
    )
    q1_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel supplied in Q1 (early issuance only)",
    )
    q2_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel supplied in Q2 (early issuance only)",
    )
    q3_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel supplied in Q3 (early issuance only)",
    )
    q4_quantity = Column(
        BigInteger,
        nullable=True,
        comment="Quantity of fuel supplied in Q4 (early issuance only)",
    )
    units = Column(
        Enum(QuantityUnitsEnum), nullable=False, comment="Units of fuel quantity"
    )
    compliance_units = Column(Numeric(13, 5), nullable=True, comment="Compliance units")
    target_ci = Column(Numeric(13, 5), nullable=True, comment="Target Carbon Intensity")
    ci_of_fuel = Column(Numeric(10, 2), nullable=True, comment="CI of the fuel")
    energy_density = Column(Numeric(10, 2), nullable=True, comment="Energy density")
    eer = Column(Numeric(10, 2), nullable=True, comment="Energy Effectiveness Ratio")
    uci = Column(Numeric(10, 2), nullable=True, comment="Additional Carbon Intensity")
    energy = Column(BigInteger, nullable=True, comment="Energy content")
    fuel_type_other = Column(
        String(1000), nullable=True, comment="Other fuel type if one provided"
    )

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
    end_use_type = relationship("EndUseType")

    def __repr__(self):
        return f"<FuelSupply(id={self.fuel_supply_id}, fuel_type_id={self.fuel_type_id}, quantity={self.quantity})>"

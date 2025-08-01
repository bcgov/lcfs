from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, BigInteger
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, Versioning


class OtherUses(BaseModel, Auditable, Versioning):
    __tablename__ = "other_uses"
    __table_args__ = {
        "comment": "Records other uses of fuels that are subject to renewable requirements but do not earn credits."
    }

    other_uses_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the other uses record",
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the compliance report",
    )
    fuel_type_id = Column(
        Integer,
        ForeignKey("fuel_type.fuel_type_id"),
        nullable=False,
        comment="Foreign key to the fuel type",
    )
    fuel_category_id = Column(
        Integer,
        ForeignKey("fuel_category.fuel_category_id"),
        nullable=False,
        comment="Foreign key to the fuel category",
    )
    provision_of_the_act_id = Column(
        Integer,
        ForeignKey("provision_of_the_act.provision_of_the_act_id"),
        nullable=False,
        comment="Foreign key to the provision of the act",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id"),
        nullable=True,
        comment="Foreign key to the fuel code",
    )
    ci_of_fuel = Column(
        Numeric(10, 2), nullable=False, comment="The Carbon intesity of fuel"
    )
    quantity_supplied = Column(
        BigInteger, nullable=False, comment="Quantity of fuel used. Cannot be negative."
    )
    units = Column(
        String,
        nullable=False,
        comment="Units of the fuel quantity. Auto-selected, locked field.",
    )
    expected_use_id = Column(
        Integer,
        ForeignKey("expected_use_type.expected_use_type_id"),
        nullable=False,
        comment="Foreign key to the expected use type",
    )
    rationale = Column(
        String,
        nullable=True,
        comment="Rationale for the use of the fuel, required if 'Other' is selected as expected use",
    )

    compliance_report = relationship("ComplianceReport", back_populates="other_uses")
    fuel_type = relationship("FuelType")
    fuel_category = relationship("FuelCategory")
    expected_use = relationship("ExpectedUseType")
    provision_of_the_act = relationship("ProvisionOfTheAct")
    fuel_code = relationship("FuelCode")

    def __repr__(self):
        return f"<OtherUses(id={self.other_uses_id}, quantity_supplied={self.quantity_supplied})>"

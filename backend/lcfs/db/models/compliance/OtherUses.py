from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable


class OtherUses(BaseModel, Auditable):
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
    quantity_supplied = Column(
        Integer, nullable=False, comment="Quantity of fuel used. Cannot be negative."
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

    def __repr__(self):
        return f"<OtherUses(id={self.other_uses_id}, quantity_supplied={self.quantity_supplied})>"

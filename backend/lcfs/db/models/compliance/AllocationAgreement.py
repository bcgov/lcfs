from sqlalchemy import Column, Integer, String, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, DisplayOrder, Versioning


class AllocationAgreement(BaseModel, Auditable, Versioning, DisplayOrder):
    __tablename__ = "allocation_agreement"
    __table_args__ = {
        "comment": "Records allocation agreements where the reporting obligation is passed from one party to another. Each party must report their end of the transaction."
    }

    allocation_agreement_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the allocation agreement",
    )
    transaction_partner = Column(
        String, nullable=False, comment="Partner involved in the transaction"
    )
    postal_address = Column(
        String, nullable=False, comment="Postal address of the transaction partner"
    )
    transaction_partner_email = Column(
        String, nullable=True, comment="Transaction Partner email"
    )
    transaction_partner_phone = Column(
        String, nullable=True, comment="Transaction Partner phone number"
    )
    ci_of_fuel = Column(
        Numeric(10, 2), nullable=True, comment="The Carbon intensity of fuel"
    )
    quantity = Column(
        Integer,
        nullable=True,
        comment="Quantity of fuel involved in the transaction",
    )
    q1_quantity = Column(
        Integer,
        nullable=True,
        comment="Quantity of fuel involved in Q1 (early issuance only)",
    )
    q2_quantity = Column(
        Integer,
        nullable=True,
        comment="Quantity of fuel involved in Q2 (early issuance only)",
    )
    q3_quantity = Column(
        Integer,
        nullable=True,
        comment="Quantity of fuel involved in Q3 (early issuance only)",
    )
    q4_quantity = Column(
        Integer,
        nullable=True,
        comment="Quantity of fuel involved in Q4 (early issuance only)",
    )
    quantity_not_sold = Column(
        Integer,
        nullable=True,
        comment="Quantity not sold or supplied within the compliance period",
        default=0,
    )
    units = Column(
        String,
        nullable=False,
        comment="Units of the fuel quantity. Auto-selected, locked field.",
    )
    fuel_type_other = Column(
        String(1000), nullable=True, comment="Other fuel type if one provided"
    )

    allocation_transaction_type_id = Column(
        Integer,
        ForeignKey("allocation_transaction_type.allocation_transaction_type_id"),
        nullable=False,
        comment="Foreign key to the transaction type",
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
        nullable=True,
        comment="Foreign key to the fuel category",
    )
    provision_of_the_act_id = Column(
        Integer,
        ForeignKey("provision_of_the_act.provision_of_the_act_id"),
        nullable=True,
        comment="Foreign key to the provision of the act",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id"),
        nullable=True,
        comment="Foreign key to the fuel code",
    )
    compliance_report_id = Column(
        Integer,
        ForeignKey("compliance_report.compliance_report_id"),
        nullable=False,
        comment="Foreign key to the compliance report",
    )

    allocation_transaction_type = relationship(
        "AllocationTransactionType", lazy="joined"
    )
    fuel_type = relationship("FuelType", lazy="joined")
    fuel_category = relationship("FuelCategory", lazy="joined")
    provision_of_the_act = relationship("ProvisionOfTheAct", lazy="joined")
    fuel_code = relationship("FuelCode", lazy="joined")
    compliance_report = relationship(
        "ComplianceReport", back_populates="allocation_agreements"
    )

    def __repr__(self):
        return f"<AllocationAgreement(id={self.allocation_agreement_id}, transaction_partner={self.transaction_partner})>"

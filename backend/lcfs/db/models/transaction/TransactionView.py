import enum
from sqlalchemy import Column, Integer, String, Float, DateTime
from lcfs.db.base import BaseModel


class TransactionViewTypeEnum(enum.Enum):
    Transfer = "Transfer"
    InitiativeAgreement = "InitiativeAgreement"
    AdminAdjustment = "AdminAdjustment"
    ComplianceReport = "ComplianceReport"


# This class represents a database view for transactions. It is intended to consolidate
# and simplify access to various transaction-related data by providing a unified interface
# to query against. The view combines data from multiple underlying tables, making
# easier retrieval of transaction details such as type, organizations involved, quantities,
# and statuses without requiring complex joins in every query.
class TransactionView(BaseModel):
    # Table name for the SQLAlchemy model, matching the database view name
    __tablename__ = "mv_transaction_aggregate"

    # Allows modification of the class definition without requiring a restart,
    # useful for dynamic schema changes or when working with database views.
    __table_args__ = {"extend_existing": True}

    # Columns definitions mapping to the database fields
    # id, type and description columns are defined as a composite primary key.
    transaction_id = Column(
        Integer,
        primary_key=True,
        comment="Unique identifier for the transaction.",
    )
    transaction_type = Column(
        String,
        primary_key=True,
        comment="Type of transaction (e.g., Transfer, InitiativeAgreement).",
    )
    description = Column(
        String,
        comment="Brief description of the transaction.",
    )
    compliance_period = Column(
        String,
        comment="Compliance period associated with the transaction (year).",
    )
    from_organization_id = Column(
        Integer,
        comment="Identifier of the organization initiating the transaction.",
    )
    from_organization = Column(
        String,
        comment="Name of the organization initiating the transaction.",
    )
    to_organization_id = Column(
        Integer,
        comment="Identifier of the organization receiving the transaction.",
    )
    to_organization = Column(
        String,
        comment="Name of the organization receiving the transaction.",
    )
    quantity = Column(
        Integer,
        comment="Quantity of units involved in the transaction.",
    )
    price_per_unit = Column(
        Float,
        comment="Price per unit of the transaction.",
    )
    status = Column(
        String,
        comment="Status of the transaction (e.g., Approved, Pending).",
    )
    from_org_comment = Column(
        String,
        comment="Comments made by the sending org.",
    )
    to_org_comment = Column(
        String,
        comment="Comments made by the receiving org.",
    )
    government_comment = Column(
        String,
        comment="Comments made by government.",
    )
    category = Column(
        String,
        comment="Category of the transaction.",
    )
    transaction_effective_date = Column(
        DateTime,
        comment="Date the transaction becomes effective.",
    )
    recorded_date = Column(
        DateTime,
        comment="Date the transaction was recorded.",
    )
    approved_date = Column(
        DateTime,
        comment="Date the transaction was approved.",
    )
    create_date = Column(
        DateTime,
        comment="Date the transaction record was created.",
    )
    update_date = Column(
        DateTime,
        comment="Date the transaction record was last updated.",
    )

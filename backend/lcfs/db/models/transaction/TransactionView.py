import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from lcfs.db.base import BaseModel

class TransactionViewTypeEnum(enum.Enum):
    Transfer = "Transfer"
    InitiativeAgreement = "InitiativeAgreement"
    AdminAdjustment = "AdminAdjustment"

# This class represents a database view for transactions. It is intended to consolidate
# and simplify access to various transaction-related data by providing a unified interface
# to query against. The view combines data from multiple underlying tables, making
# easier retrieval of transaction details such as type, organizations involved, quantities,
# and statuses without requiring complex joins in every query.
class TransactionView(BaseModel):
    # Table name for the SQLAlchemy model, matching the database view name
    __tablename__ = 'mv_transaction_aggregate'

    # Allows modification of the class definition without requiring a restart,
    # useful for dynamic schema changes or when working with database views.
    __table_args__ = {'extend_existing': True}

    # Columns definitions mapping to the database fields
    # id and type columns are defined as a composite primary key.
    transaction_id = Column(Integer, primary_key=True)
    transaction_type = Column(String, primary_key=True)
    from_organization_id = Column(Integer)
    from_organization = Column(String)
    to_organization_id = Column(Integer)
    to_organization = Column(String)
    quantity = Column(Integer)
    price_per_unit = Column(Float)
    status = Column(String)
    compliance_period = Column(String)
    comment = Column(String)
    category = Column(String)
    approval_date = Column(DateTime)
    transaction_effective_date = Column(DateTime)
    create_date = Column(DateTime)
    update_date = Column(DateTime)

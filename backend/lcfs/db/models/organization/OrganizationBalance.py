from sqlalchemy import create_engine, MetaData, Table, Column, BigInteger, Integer
from sqlalchemy.orm import mapper
from sqlalchemy.orm import registry

metadata = MetaData()

# Define the SQLAlchemy view for OrganizationBalance
organization_balance_view = Table(
    "organization_balance_view",
    metadata,
    Column("organization_id", Integer, primary_key=True),
    Column(
        "compliance_units",
        BigInteger,
        comment="The actual balance of validated Low Carbon Fuel credits held by a fuel supplier between the effective_date and the expiration_date. If expiration_date is NULL then we assume that it is the current balance.",
    ),
)


# Create a class to map to the view
class OrganizationBalanceView:
    def __init__(self, organization_id, compliance_units):
        self.organization_id = organization_id
        self.compliance_units = compliance_units


# Create a registry
registry = registry()

# Map the class to the view using map_imperatively
organization_balance_mapper = registry.map_imperatively(
    OrganizationBalanceView, organization_balance_view
)

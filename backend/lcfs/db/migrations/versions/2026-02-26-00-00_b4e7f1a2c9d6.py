"""Change fuel_supply.energy column from BigInteger to Numeric(20,2)

The energy column was incorrectly defined as BigInteger, causing decimal
truncation during TFRS data migration (e.g., 35.40 stored as 35).

Revision ID: b4e7f1a2c9d6
Revises: a7c9e2f8b3d1
Create Date: 2026-02-13 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "b4e7f1a2c9d6"
down_revision = "a7c9e2f8b3d1"
branch_labels = None
depends_on = None

# All fuel_supply views that must be recreated after column alter
SECTIONS_TO_EXECUTE = [
    "Fuel Supply Analytics Base View",
    "Fuel Supply Base View",
    "Compliance Report Fuel Supply Base View",
    "Fuel Supply Fuel Code Base View",
    "Fuel Supply Map View",
]


def _drop_fuel_supply_views():
    """Drop all views that depend on the fuel_supply table."""
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_map CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_analytics_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_compliance_report_fuel_supply_base CASCADE;")
    op.execute("DROP VIEW IF EXISTS vw_fuel_supply_fuel_code_base CASCADE;")


def _recreate_fuel_supply_views():
    """Recreate all fuel_supply views from metabase.sql."""
    create_role_if_not_exists()
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, SECTIONS_TO_EXECUTE)


def upgrade() -> None:
    _drop_fuel_supply_views()

    op.alter_column(
        "fuel_supply",
        "energy",
        existing_type=sa.BigInteger(),
        type_=sa.Numeric(precision=20, scale=2),
        existing_nullable=True,
        comment="Energy content",
    )

    _recreate_fuel_supply_views()


def downgrade() -> None:
    _drop_fuel_supply_views()

    op.alter_column(
        "fuel_supply",
        "energy",
        existing_type=sa.Numeric(precision=20, scale=2),
        type_=sa.BigInteger(),
        existing_nullable=True,
        comment="Energy content",
    )

    _recreate_fuel_supply_views()

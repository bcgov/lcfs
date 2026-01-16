"""Add latitude and longitude to organization snapshot for fuel supply mapping

Revision ID: a1b2c3d4e5f8
Revises: 5897848af3c9
Create Date: 2025-01-05 12:00:00.000000

This migration adds latitude/longitude columns to compliance_report_organization_snapshot
for the Fuel Supply Map feature in Metabase.

To populate existing records with coordinates:
    1. Run: poetry run python -m lcfs.scripts.geocode_org_snapshots
    2. Execute the generated org_snapshot_coordinates.sql against the database
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f8"
down_revision = "5897848af3c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add latitude column for mapping organization locations
    op.add_column(
        "compliance_report_organization_snapshot",
        sa.Column(
            "latitude",
            sa.Float(),
            nullable=True,
            comment="Latitude coordinate for mapping (from records_address, service_address, or head_office_address)",
        ),
    )
    # Add longitude column for mapping organization locations
    op.add_column(
        "compliance_report_organization_snapshot",
        sa.Column(
            "longitude",
            sa.Float(),
            nullable=True,
            comment="Longitude coordinate for mapping (from records_address, service_address, or head_office_address)",
        ),
    )


def downgrade() -> None:
    op.drop_column("compliance_report_organization_snapshot", "longitude")
    op.drop_column("compliance_report_organization_snapshot", "latitude")

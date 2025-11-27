"""Add co-ordinates to charging equipment

Revision ID: 9e083b743595
Revises: 1909a3e5fafd
Create Date: 2025-11-05 13:14:56.886278

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9e083b743595"
down_revision = "1909a3e5fafd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "charging_equipment",
        sa.Column(
            "latitude",
            sa.Double(),
            nullable=True,
            comment="Latitude coordinate of the charging equipment location",
        ),
    )
    op.add_column(
        "charging_equipment",
        sa.Column(
            "longitude",
            sa.Double(),
            nullable=True,
            comment="Longitude coordinate of the charging equipment location",
        ),
    )
    
    # Copy coordinates from charging_site to charging_equipment
    op.execute("""
        UPDATE charging_equipment 
        SET latitude = cs.latitude, longitude = cs.longitude
        FROM charging_site cs 
        WHERE charging_equipment.charging_site_id = cs.charging_site_id
    """)


def downgrade() -> None:
    op.drop_column("charging_equipment", "longitude")
    op.drop_column("charging_equipment", "latitude")
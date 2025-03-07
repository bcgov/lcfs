"""Increase NUMERIC precision for fuel_export.energy

Revision ID: 937c793bf7b8
Revises: 173179aeed95
Create Date: 2025-03-05 17:20:42.573152

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "937c793bf7b8"
down_revision = "4a34a52085f2"
branch_labels = None
depends_on = None


def upgrade():
    """Increase the NUMERIC precision of the 'energy' column in 'fuel_export' table"""
    op.alter_column('fuel_export', 'energy',
                    existing_type=sa.Numeric(10, 2),
                    type_=sa.Numeric(12, 2))

def downgrade():
    """Revert the NUMERIC precision of the 'energy' column"""
    op.alter_column('fuel_export', 'energy',
                    existing_type=sa.Numeric(12, 2),
                    type_=sa.Numeric(10, 2))

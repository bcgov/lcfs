"""Add C-PROXY fuel code prefix

Revision ID: 7ca5289dff90
Revises: 64ab3b361bde
Create Date: 2025-12-19 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7ca5289dff90"
down_revision = "64ab3b361bde"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add C-PROXY prefix for Canadian proxy fuel codes
    connection = op.get_bind()

    insert_prefix_sql = sa.text("""
        INSERT INTO fuel_code_prefix (fuel_code_prefix_id, prefix)
        VALUES (:prefix_id, :prefix)
        ON CONFLICT (fuel_code_prefix_id) DO NOTHING
    """)

    connection.execute(insert_prefix_sql, {
        'prefix_id': 4,
        'prefix': 'C-PROXY'
    })


def downgrade() -> None:
    # Remove C-PROXY prefix
    connection = op.get_bind()

    delete_prefix_sql = sa.text("""
        DELETE FROM fuel_code_prefix
        WHERE fuel_code_prefix_id = :prefix_id AND prefix = :prefix
    """)

    connection.execute(delete_prefix_sql, {
        'prefix_id': 4,
        'prefix': 'C-PROXY'
    })

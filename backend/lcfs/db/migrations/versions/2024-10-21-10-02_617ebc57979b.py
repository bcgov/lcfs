"""Add JSON delta function

Revision ID: 617ebc57979b
Revises: 2270f3602839
Create Date: 2024-10-21 10:28:08.152293

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "617ebc57979b"
down_revision = "2270f3602839"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE OR REPLACE FUNCTION generate_json_delta(
        old_row JSONB,
        new_row JSONB
    ) RETURNS JSONB AS $$
    BEGIN
        RETURN jsonb_diff(old_row, new_row);
    END;
    $$ LANGUAGE plpgsql;
    """)


def downgrade():
    op.execute("""
    DROP FUNCTION IF EXISTS generate_json_delta;
    """)

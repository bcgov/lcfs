"""JSONB_DIFF FUNCTION

Revision ID: 2270f3602839
Revises: f44f01a35fc6
Create Date: 2024-10-23 17:36:01.451916

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2270f3602839"
down_revision = "f44f01a35fc6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
    CREATE OR REPLACE FUNCTION jsonb_diff(
        old_row JSONB,
        new_row JSONB
    ) RETURNS JSONB AS $$
    BEGIN
        RETURN (
            SELECT jsonb_object_agg(key, value)
            FROM (
                SELECT key, value
                FROM jsonb_each(new_row)
                EXCEPT
                SELECT key, value
                FROM jsonb_each(old_row)
            ) diff
        );
    END;
    $$ LANGUAGE plpgsql;

    """
    )


def downgrade():
    op.execute(
        """
    DROP FUNCTION IF EXISTS jsonb_diff;
    """
    )

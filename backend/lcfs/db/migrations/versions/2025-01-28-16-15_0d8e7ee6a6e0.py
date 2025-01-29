"""Update intended use flags

Revision ID: 0d8e7ee6a6e0
Revises: 26bb41f15dc4
Create Date: 2025-01-28 16:15:20.208093

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0d8e7ee6a6e0"
down_revision = "26bb41f15dc4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure that only the specified types have intended_use set to TRUE
    op.execute(
        """
        UPDATE end_use_type
        SET intended_use = CASE
            WHEN type IN (
                'Light duty motor vehicles',
                'Battery bus',
                'Battery truck',
                'Cargo handling equipment',
                'Fixed guiderail',
                'Ground support equipment',
                'Heavy forklift',
                'Marine',
                'Shore power',
                'Trolley bus',
                'Other',
                'Any',
                'Aircraft'
            ) THEN TRUE
            ELSE FALSE
        END;
        """
    )


def downgrade() -> None:
    pass

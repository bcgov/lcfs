"""add marine end use

Revision ID: 998929392c8b
Revises: 5163af6ba4a4
Create Date: 2025-01-07 19:35:00.064999

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "998929392c8b"
down_revision = "5163af6ba4a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO end_use_type (end_use_type_id, type, intended_use)
        VALUES (25, 'Marine', TRUE)
        ON CONFLICT (end_use_type_id) DO NOTHING;
        """
    )
    # Energy Effectiveness Ratios
    op.execute(
        """
        INSERT INTO energy_effectiveness_ratio (
            eer_id, fuel_category_id, fuel_type_id, end_use_type_id, ratio, effective_status
        )
        VALUES (44, 2, 3, 25, 2.5, TRUE)
        ON CONFLICT (eer_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM energy_effectiveness_ratio
        WHERE eer_id = 44;
        """
    )
    op.execute(
        """
        DELETE FROM end_use_type
        WHERE end_use_type_id = 25;
        """
    )

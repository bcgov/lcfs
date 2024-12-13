"""Update default_carbon_intensity for 'Other diesel' fuel type

Revision ID: 5d729face5ab
Revises: 7ae38a8413ab
Create Date: 2024-12-12 21:43:01.414475
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "5d729face5ab"
down_revision = "7ae38a8413ab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE fuel_type
        SET default_carbon_intensity = 100.21
        WHERE fuel_type_id = 20
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE fuel_type
        SET default_carbon_intensity = 94.38
        WHERE fuel_type_id = 20
        """
    )

"""Replace 'Other' with detailed description in 'level_of_equipment' table

Revision ID: aeaa26f5cdd5
Revises: b4da565bb711
Create Date: 2024-12-02 22:52:12.302543

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "aeaa26f5cdd5"
down_revision = "b4da565bb711"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update the 'name' column in the 'level_of_equipment' table
    op.execute(
        """
        UPDATE level_of_equipment
        SET name = 'Other - Additional information provided in notes field'
        WHERE name = 'Other'
        """
    )


def downgrade() -> None:
    # Revert the 'name' column update in the 'level_of_equipment' table
    op.execute(
        """
        UPDATE level_of_equipment
        SET name = 'Other'
        WHERE name = 'Other - Additional information provided in notes field'
        """
    )

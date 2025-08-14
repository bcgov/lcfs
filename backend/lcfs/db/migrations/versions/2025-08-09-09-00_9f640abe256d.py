"""revert incorrect fossil_derived changes from migration b1c2d3e4f5g6

Revision ID: 9f640abe256d
Revises: 76ffd24d72fb
Create Date: 2025-08-09 09:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "9f640abe256d"
down_revision = "76ffd24d72fb"
branch_labels = None
depends_on = None


def upgrade():
    """Revert the incorrect fossil_derived changes from migration b1c2d3e4f5g6

    These fuel types are biofuels/renewable fuels and should be fossil_derived=FALSE
    so they can access fuel code provisions under section 19(b)(i).
    """
    op.execute(
        """
        UPDATE fuel_type
        SET fossil_derived = FALSE
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Ethanol', 
            'Renewable gasoline',
            'Renewable naphtha',
            'Biodiesel',
            'HDRD',
            'Other diesel fuel'
        );
        """
    )


def downgrade():
    """No downgrade - the previous state was incorrect"""
    pass

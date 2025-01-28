"""Update end_use_type_id in energy_effectiveness_ratio

Revision ID: 26bb41f15dc4
Revises: 66b4ae533e8d
Create Date: 2025-01-27 13:28:15.607968

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "26bb41f15dc4"
down_revision = "66b4ae533e8d"
branch_labels = None
depends_on = None


def upgrade():
    """Update end_use_type_id for specific records"""
    op.execute("""
        UPDATE energy_effectiveness_ratio 
        SET end_use_type_id = 24
        WHERE fuel_category_id = 2 AND fuel_type_id = 13;
    """)

    op.execute("""
        UPDATE energy_effectiveness_ratio 
        SET end_use_type_id = 24
        WHERE fuel_category_id = 3 AND fuel_type_id = 3;
    """)

    op.execute("""
        UPDATE energy_effectiveness_ratio 
        SET end_use_type_id = 24
        WHERE fuel_category_id = 3 AND fuel_type_id = 11;
    """)

def downgrade():
    """Revert changes (Replace NULL with original values if known)"""
    op.execute("""
        UPDATE energy_effectiveness_ratio 
        SET end_use_type_id = NULL  -- Modify if the original values are known
        WHERE fuel_category_id = 2 AND fuel_type_id = 13;
    """)

    op.execute("""
        UPDATE energy_effectiveness_ratio 
        SET end_use_type_id = NULL
        WHERE fuel_category_id = 3 AND fuel_type_id = 3;
    """)

    op.execute("""
        UPDATE energy_effectiveness_ratio 
        SET end_use_type_id = NULL
        WHERE fuel_category_id = 3 AND fuel_type_id = 11;
    """)

"""Update fuel type name

Revision ID: bfa7bbb1eea3
Revises: 9329e38396e1
Create Date: 2025-01-03 13:24:19.525006

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "bfa7bbb1eea3"
down_revision = "9329e38396e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update fuel type name
    op.execute("""
    UPDATE fuel_type
    SET fuel_type = 'Other diesel fuel',
        provision_1_id = 3  -- Change from prescribed (1) to default (3)
    WHERE fuel_type = 'Other diesel';
    """)

    
def downgrade() -> None:
    # Revert fuel type name update
    op.execute("""
    UPDATE fuel_type
    SET fuel_type = 'Other diesel',
        provision_1_id = 1  -- Change from default (3) to prescribed (1)
    WHERE fuel_type = 'Other diesel fuel';
    """)


"""Update prefix for Canadian produced fuel

Revision ID: 1909a3e5fafd
Revises: 1f3ce398db1c
Create Date: 2025-10-29 13:11:28.997677

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1909a3e5fafd"
down_revision = "1f3ce398db1c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    update_bc_sql = sa.text(f"""
        UPDATE fuel_code SET prefix_id = 3
        WHERE fuel_production_facility_country = 'Canada' AND prefix_id <> 3;
    """
    )
    connection.execute(update_bc_sql)


def downgrade() -> None:
    pass

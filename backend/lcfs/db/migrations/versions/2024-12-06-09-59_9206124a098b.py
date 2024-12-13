"""Add Organization name to FSE

Revision ID: 9206124a098b
Revises: aeaa26f5cdd5
Create Date: 2024-12-04 09:59:22.876386

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "9206124a098b"
down_revision = "26ab15f8ab18"
branch_labels = None
depends_on = None


def upgrade():
    # Add the column 'organization_name' to 'final_supply_equipment' table with a default value
    op.add_column(
        "final_supply_equipment",
        sa.Column("organization_name", sa.String(), nullable=False, server_default=""),
    )

    # Update existing rows to have the default value
    op.execute(
        "UPDATE final_supply_equipment SET organization_name = '' WHERE organization_name IS NULL"
    )

    # Remove the server default to prevent future rows from automatically getting the default value
    op.alter_column("final_supply_equipment", "organization_name", server_default=None)


def downgrade():
    # Remove the column 'organization_name' from 'final_supply_equipment' table
    op.drop_column("final_supply_equipment", "organization_name")
